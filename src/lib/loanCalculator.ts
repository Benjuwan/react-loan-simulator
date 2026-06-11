import type { InterestRateScenario, LoanConditions, MonthlyDetail } from "../ts/modelInterfaces";
import { calculatePayment } from "./utils";

// 指定月の適用金利を取得するヘルパー関数
function _getRateForMonth(month: number, scenarios: InterestRateScenario[]): number {
  // monthOffsetの昇順にソート
  const sorted = [...scenarios].sort((a, b) => a.monthOffset - b.monthOffset);

  // デフォルトは最初のシナリオの金利
  // ※後述のフロー（ループ処理内の条件分岐）でスキップされる場合
  // ＝未来分は（未確定なので）借り入れ初期時のデフォルト金利が適用される
  let rate = sorted[0].interestRate;

  for (const s of sorted) {
    if (month >= s.monthOffset) {
      // monthがmonthOffset以上であればそのシナリオの金利を適用
      // ＝その月時点で有効な金利を適用
      rate = s.interestRate;
    }
  }

  return rate;
}

/**
 * 住宅ローンのシミュレーションを計算する（元利均等返済方式）
 * 
 * 【主な仕様・考慮事項】
 * - 5年ルール: 金利が変動しても、5年間は月々の返済額（元金＋利息）を変更しないルール。
 * - 125%ルール: 5年ごとの返済額見直し時、新しい返済額は直前の返済額の「1.25倍」を上限とするルール。
 * - 未払い利息: 金利が急上昇し、月々の固定された返済額よりも「その月に発生した利息」が上回った場合、
 *              払い切れなかった利息が「未払い利息」として蓄積される仕組み。
*/
export function calculateLoan(conditions: LoanConditions): MonthlyDetail[] {
  const { principal, termYears, scenarios } = conditions;
  const totalMonths = termYears * 12;
  const details: MonthlyDetail[] = [];

  let currentBalance = principal;    // 現在の元金残高
  let accumulatedUnpaidInterest = 0; // 未払い利息の累積額

  // 初期シナリオの金利を取得 (month = 1： 借り入れ開始 1か月目)
  const currentAnnualRate = _getRateForMonth(1, scenarios);

  // 初期の返済額（元利均等返済の基本公式に基づく）を計算
  let currentPayment = calculatePayment(currentBalance, currentAnnualRate, totalMonths);

  // 手動設定された月々の返済額がある場合は、初期の返済額を上書きしてから処理スタート
  if (conditions.customMonthlyPayment && conditions.customMonthlyPayment > 0) {
    currentPayment = conditions.customMonthlyPayment;
  }

  // 5年ルールの適用: 返済額の見直しは 61ヶ月目(6年目の最初の月)、121ヶ月目... に行われる
  let nextPaymentReviewMonth = 61;

  for (let month = 1; month <= totalMonths; month++) {
    // 1. 当月の適用金利を取得
    const appliedAnnualRate = _getRateForMonth(month, scenarios);
    const monthlyRate = appliedAnnualRate / 12 / 100;

    // 2. 5年ごとの返済額見直し (5年ルール ＆ 125%ルール適用)
    if (month === nextPaymentReviewMonth) {
      const remainingMonths = totalMonths - month + 1;  // +1は当月も含めるための補正

      if (conditions.customMonthlyPayment && conditions.customMonthlyPayment > 0) {
        // 手動設定された月々の返済額がある場合は、再計算による下方・上方修正を行わず、指定額を維持する
        currentPayment = conditions.customMonthlyPayment;
      } else {
        // 元利均等返済の毎月の返済額： 現在の残高と最新の金利に基づいて、本来必要な「新しい返済額」を再計算する
        const recalculatedPayment = calculatePayment(currentBalance, appliedAnnualRate, remainingMonths);

        // 125%ルール: 金利がいくら暴騰しても、新しい返済額は前の返済額の1.25倍を上限とする（激変緩和措置）
        const maxAllowedPayment = Math.floor(currentPayment * 1.25);

        // 再計算された額と、上限額（1.25倍）のうち、低い方を新しい返済額として採用
        currentPayment = Math.min(recalculatedPayment, maxAllowedPayment);
      }

      // 5年ルールの更新: 次回の見直しはさらに5年後（60ヶ月後）
      nextPaymentReviewMonth += 60;
    }

    // 3. 利息の計算
    // 当月の発生利息 = 現在の元金残高 × 月利
    const monthlyInterest = Math.round(currentBalance * monthlyRate);

    // ESLintが「変数の初期化値が直後で上書きされることを警告してくる」ので型指定に留める
    let principalPayment: number; // 当月の元金充当分（返済額から利息を引いた残り）
    let interestPayment: number;  // 当月の利息充当分（当月発生した利息のうち、返済額で支払われる部分）

    let newUnpaidInterest = 0;

    // 4. 返済額の充当と未払い利息の処理
    // 異常事態：未払い利息が発生する場合（発生した利息が返済額を上回る）
    if (monthlyInterest > currentPayment) {
      // この場合、返済額はすべて利息の支払いに消え、元金は1円も減らない。
      interestPayment = currentPayment; // 返済額全額を利息に充てる
      principalPayment = 0; // 元金充当はゼロ

      // 払い切れなかった利息分が「未払い利息」として借金に追加蓄積される
      newUnpaidInterest = monthlyInterest - currentPayment;
      accumulatedUnpaidInterest += newUnpaidInterest;

      console.error(`未払利息発生！\n未払利息累積分： ${accumulatedUnpaidInterest.toLocaleString()}, 今月発生した未払利息： ${newUnpaidInterest.toLocaleString()}`);
    }

    // 正常事態：返済額が利息を上回る場合
    else {
      interestPayment = monthlyInterest; // 当月の利息として確定

      // 当月利息を払った余りが、元金や過去の未払い利息の返済に充てられる
      let remainingPayment = currentPayment - interestPayment;

      // 過去に溜まった「未払利息累積分」が存在する場合
      if (accumulatedUnpaidInterest > 0) {
        // ※未払利息累積分は元金よりも優先して充当（返済）される

        // 未払い利息を全額完済できる場合
        if (remainingPayment >= accumulatedUnpaidInterest) {
          remainingPayment -= accumulatedUnpaidInterest;
          accumulatedUnpaidInterest = 0;
          principalPayment = remainingPayment; // 余った分をやっと元金に充当

          console.warn(`未払利息が完済されました！\n残りの返済額： ${remainingPayment.toLocaleString()}`);
        }

        // 未払い利息の一部しか返済できない場合
        else {
          accumulatedUnpaidInterest -= remainingPayment;
          principalPayment = 0; // 元金充当は依然としてゼロのまま

          console.warn(`未払利息の一部が返済されました。\n残った未払利息累積分： ${accumulatedUnpaidInterest.toLocaleString()}`);
        }
      }

      // 未払い利息がない健全な状態であれば、残りはすべて元金に充当される
      else {
        principalPayment = remainingPayment;
      }
    }

    // 最終支払いで元金以上の過剰な支払いにならないように調整
    if (principalPayment > currentBalance) {
      const extraPrincipal = principalPayment - currentBalance;
      principalPayment = currentBalance;
      // 最終回の実際の返済額を補正（利息 + 未払利息充当分 + 元金の合計）
      currentPayment -= extraPrincipal;
    }

    // 元金残高を更新
    currentBalance -= principalPayment;

    // 計算上の丸め誤差等でマイナスになる場合は0に補正
    if (currentBalance < 0) {
      currentBalance = 0;
    }

    // 月次データを記録
    details.push({
      month,
      interestRate: appliedAnnualRate,
      paymentAmount: currentPayment,
      interestPayment,
      principalPayment,
      principalBalance: currentBalance,
      unpaidInterest: newUnpaidInterest,
      accumulatedUnpaidInterest
    });

    if (currentBalance === 0 && accumulatedUnpaidInterest === 0) {
      break; // 完済したらループ終了
    }
  }

  // ※注意：期間終了時（例：360ヶ月目）に未払い利息や残債が残っている場合、
  // 現実のローンでは最終月に一括清算（またはリスケジュール）が求められますが、
  // 本シミュレータでは「どれだけの負債が残ってしまったか」を可視化するため、残った状態のまま結果を返します。
  return details;
}
