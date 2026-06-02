import type { MonthlyDetail } from './loanCalculator';

/**
 * 指定した月番号に対応する空の月次詳細を返します。
 * 片方のスケジュールが短い場合に、0 で埋めるために使用します。
 */
function createEmptyMonthlyDetail(month: number): MonthlyDetail {
  return {
    month,
    interestRate: 0,
    paymentAmount: 0,
    interestPayment: 0,
    principalPayment: 0,
    principalBalance: 0,
    unpaidInterest: 0,
    accumulatedUnpaidInterest: 0,
  };
}

/**
 * 2つのローン計算結果を月ごとに合算します。
 *
 * 2 つの月別詳細配列の長さが異なる場合、短い方に不足する月は 0 で埋めます。
 * 表示上の金利は、2 つの金利のうち高い方を参考値として採用します。
 */
export function mergeMonthlyDetails(
  firstSchedule: MonthlyDetail[],
  secondSchedule: MonthlyDetail[]
): MonthlyDetail[] {
  const mergedLength = Math.max(firstSchedule.length, secondSchedule.length);
  const mergedDetails: MonthlyDetail[] = [];

  for (let index = 0; index < mergedLength; index++) {
    const firstMonthlyDetail = firstSchedule[index] || createEmptyMonthlyDetail(index + 1);
    const secondMonthlyDetail = secondSchedule[index] || createEmptyMonthlyDetail(index + 1);

    mergedDetails.push({
      month: index + 1,
      interestRate: Math.max(firstMonthlyDetail.interestRate, secondMonthlyDetail.interestRate),
      paymentAmount: firstMonthlyDetail.paymentAmount + secondMonthlyDetail.paymentAmount,
      interestPayment: firstMonthlyDetail.interestPayment + secondMonthlyDetail.interestPayment,
      principalPayment: firstMonthlyDetail.principalPayment + secondMonthlyDetail.principalPayment,
      principalBalance: firstMonthlyDetail.principalBalance + secondMonthlyDetail.principalBalance,
      unpaidInterest: firstMonthlyDetail.unpaidInterest + secondMonthlyDetail.unpaidInterest,
      accumulatedUnpaidInterest:
        firstMonthlyDetail.accumulatedUnpaidInterest + secondMonthlyDetail.accumulatedUnpaidInterest,
    });
  }

  return mergedDetails;
}
