import type { MonthlyDetail } from "../ts/modelInterfaces";

// 指定した月番号に対応する空の月次詳細を返す関数（片方のスケジュールが短い場合に、0で埋めるために使用）
function _createEmptyMonthlyDetail(month: number): MonthlyDetail {
  return {
    month,                         // 通算月
    interestRate: 0,               // 当月の適用年利(%)
    paymentAmount: 0,              // 当月の返済額
    interestPayment: 0,            // 利息充当分
    principalPayment: 0,           // 元金充当分
    principalBalance: 0,           // 月末の元金残高
    unpaidInterest: 0,             // 当月発生した未払い利息
    accumulatedUnpaidInterest: 0   // 累積未払い利息
  };
}

// 2つのローン計算結果を月ごとに合算する関数
export function mergeMonthlyDetails(
  firstSchedule: MonthlyDetail[],
  secondSchedule: MonthlyDetail[]
): MonthlyDetail[] {
  const mergedDetails: MonthlyDetail[] = [];

  // 支払いスケジュールの長さが異なる場合、長い方のスケジュールに合わせてループを回す（短い方は不足分を0で埋める）
  const mergedLength = Math.max(firstSchedule.length, secondSchedule.length);

  for (let index = 0; index < mergedLength; index++) {
    // 2つの月別詳細配列の長さが異なる場合、短い方に不足する月は 0 で埋める
    const firstMonthlyDetail = firstSchedule[index] || _createEmptyMonthlyDetail(index + 1);
    const secondMonthlyDetail = secondSchedule[index] || _createEmptyMonthlyDetail(index + 1);

    mergedDetails.push({
      month: index + 1, // 当月を含むため+1
      // interestRate: 表示上の金利は 2つの金利のうち高い方を参考値として採用（※楽観的観測ではなく悲観的観測での想定シミュレーションを行えるように）
      interestRate: Math.max(firstMonthlyDetail.interestRate, secondMonthlyDetail.interestRate),
      paymentAmount: firstMonthlyDetail.paymentAmount + secondMonthlyDetail.paymentAmount,
      interestPayment: firstMonthlyDetail.interestPayment + secondMonthlyDetail.interestPayment,
      principalPayment: firstMonthlyDetail.principalPayment + secondMonthlyDetail.principalPayment,
      principalBalance: firstMonthlyDetail.principalBalance + secondMonthlyDetail.principalBalance,
      unpaidInterest: firstMonthlyDetail.unpaidInterest + secondMonthlyDetail.unpaidInterest,
      accumulatedUnpaidInterest: firstMonthlyDetail.accumulatedUnpaidInterest + secondMonthlyDetail.accumulatedUnpaidInterest
    });
  }

  // 合算した月次詳細データ（配列）を返す
  return mergedDetails;
}
