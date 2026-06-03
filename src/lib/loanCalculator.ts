export interface InterestRateScenario {
  monthOffset: number; // 借入開始からの経過月数（1からスタート。1=1ヶ月目）
  interestRate: number; // 年利 (%)
}

export interface LoanConditions {
  principal: number; // 借入金額
  termYears: number; // 借入期間（年）
  scenarios: InterestRateScenario[]; // 金利シナリオ
  customMonthlyPayment?: number; // 手動設定された月々の返済額
}

export interface MonthlyDetail {
  month: number; // 通算月
  interestRate: number; // 当月の適用年利(%)
  paymentAmount: number; // 当月の返済額
  interestPayment: number; // 利息充当分
  principalPayment: number; // 元金充当分
  principalBalance: number; // 月末の元金残高
  unpaidInterest: number; // 当月発生した未払い利息
  accumulatedUnpaidInterest: number; // 累積未払い利息
}

/**
 * 元利均等返済の毎月の返済額を計算する
 * @param principal 借入残高
 * @param annualRate 年利(%)
 * @param remainingMonths 残り返済回数(月)
 * @returns 毎月の返済額
 */
export function calculatePMT(principal: number, annualRate: number, remainingMonths: number): number {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / remainingMonths;
  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  return Math.round((principal * monthlyRate * factor) / (factor - 1));
}

/**
 * 住宅ローンのシミュレーションを計算する（元利均等返済方式）
 * 
 * 【主な仕様・考慮事項】
 * - 5年ルール: 金利が変動しても、5年間は月々の返済額（元金＋利息）を変更しないルール。
 * - 125%ルール: 5年ごとの返済額見直し時、新しい返済額は直前の返済額の「1.25倍」を上限とするルール。
 * - 未払い利息: 金利が急上昇し、月々の固定された返済額よりも「その月に発生した利息」が上回った場合、
 *               払い切れなかった利息が「未払い利息」として蓄積される仕組み。
 */
export function calculateLoan(conditions: LoanConditions): MonthlyDetail[] {
  const { principal, termYears, scenarios } = conditions;
  const totalMonths = termYears * 12;
  const details: MonthlyDetail[] = [];

  let currentBalance = principal;
  let accumulatedUnpaidInterest = 0;

  // 初期シナリオの金利を取得 (month = 1)
  const currentAnnualRate = getRateForMonth(1, scenarios);

  // 初期の返済額（元利均等返済の基本公式に基づく）を計算
  let currentPayment = calculatePMT(currentBalance, currentAnnualRate, totalMonths);
  if (conditions.customMonthlyPayment && conditions.customMonthlyPayment > 0) {
    currentPayment = conditions.customMonthlyPayment;
  }

  // 5年ルールの適用: 返済額の見直しは 61ヶ月目(6年目の最初の月)、121ヶ月目... に行われる
  let nextPaymentReviewMonth = 61;

  for (let month = 1; month <= totalMonths; month++) {
    // 1. 当月の適用金利を取得
    const appliedAnnualRate = getRateForMonth(month, scenarios);
    const monthlyRate = appliedAnnualRate / 12 / 100;

    // 2. 5年ごとの返済額見直し (5年ルール ＆ 125%ルール適用)
    if (month === nextPaymentReviewMonth) {
      const remainingMonths = totalMonths - month + 1;
      
      if (conditions.customMonthlyPayment && conditions.customMonthlyPayment > 0) {
        // ユーザーが月々の支払額を任意で固定（調整）している場合は再計算による下方・上方修正を行わず、指定額を維持する
        currentPayment = conditions.customMonthlyPayment;
      } else {
        // 現在の残高と最新の金利に基づいて、本来必要な「新しい返済額」を再計算する
        const recalculatedPayment = calculatePMT(currentBalance, appliedAnnualRate, remainingMonths);

        // 125%ルール: 金利がいくら暴騰しても、新しい返済額は前の返済額の1.25倍を上限とする（激変緩和措置）
        const maxAllowedPayment = Math.floor(currentPayment * 1.25);

        // 再計算された額と、上限額（1.25倍）のうち、低い方を新しい返済額として採用
        currentPayment = Math.min(recalculatedPayment, maxAllowedPayment);
      }

      // 次回の見直しはさらに5年後（60ヶ月後）
      nextPaymentReviewMonth += 60;
    }

    // 3. 利息の計算
    // 当月の発生利息 = 現在の元金残高 × 月利
    const monthlyInterest = Math.round(currentBalance * monthlyRate);

    // ESLintが「変数の初期化値が直後で上書きされることを警告してくる」ので型指定に留める
    let principalPayment: number;
    let interestPayment: number;

    let newUnpaidInterest = 0;

    // 4. 返済額の充当と未払い利息の処理
    if (monthlyInterest > currentPayment) {
      // 異常事態：未払い利息が発生する場合（発生した利息が返済額を上回る）
      // この場合、返済額はすべて利息の支払いに消え、元金は1円も減らない。
      interestPayment = currentPayment; // 返済額全額を利息に充てる
      principalPayment = 0; // 元金充当はゼロ

      // 払い切れなかった利息分が「未払い利息」として借金に追加蓄積される
      newUnpaidInterest = monthlyInterest - currentPayment;
      accumulatedUnpaidInterest += newUnpaidInterest;
    } else {
      // 正常事態：返済額が利息を上回る場合
      interestPayment = monthlyInterest;
      // 利息を払った余りが、元金や過去の未払い利息の返済に充てられる
      let remainingPayment = currentPayment - monthlyInterest;

      if (accumulatedUnpaidInterest > 0) {
        // 過去に溜まった「未払い利息」が存在する場合は、元金よりも優先して充当（返済）しなければならない
        if (remainingPayment >= accumulatedUnpaidInterest) {
          // 未払い利息を全額完済できる場合
          remainingPayment -= accumulatedUnpaidInterest;
          accumulatedUnpaidInterest = 0;
          principalPayment = remainingPayment; // 余った分をやっと元金に充当
        } else {
          // 未払い利息の一部しか返済できない場合
          accumulatedUnpaidInterest -= remainingPayment;
          principalPayment = 0; // 元金充当は依然としてゼロのまま
        }
      } else {
        // 未払い利息がない健全な状態であれば、残りはすべて元金に充当される
        principalPayment = remainingPayment;
      }
    }

    // 最終回等で元金以上の過剰な支払いにならないように調整
    if (principalPayment > currentBalance) {
      const excessPrincipal = principalPayment - currentBalance;
      principalPayment = currentBalance;
      // 最終回の実際の返済額を補正（利息 + 未払利息充当分 + 元金の合計）
      currentPayment -= excessPrincipal;
    }

    // 元金残高を更新
    currentBalance -= principalPayment;

    // 計算上の丸め誤差等でマイナスになる場合は0に補正
    if (currentBalance < 0) currentBalance = 0;

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

/**
 * 指定月の適用金利を取得するヘルパー関数
 */
function getRateForMonth(month: number, scenarios: InterestRateScenario[]): number {
  // 月数以下で最大のmonthOffsetを持つシナリオを見つける
  // scenariosはmonthOffsetの昇順にソートされている前提
  const sorted = [...scenarios].sort((a, b) => a.monthOffset - b.monthOffset);
  let rate = sorted[0].interestRate; // デフォルトは最初のシナリオ
  for (const s of sorted) {
    if (month >= s.monthOffset) {
      rate = s.interestRate;
    }
  }
  return rate;
}
