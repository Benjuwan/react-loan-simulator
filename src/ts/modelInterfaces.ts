export interface InterestRateScenario {
    monthOffset: number;  // 借入開始からの経過月数（1からスタート。1=1ヶ月目）
    interestRate: number; // 年利 (%)
}

export interface LoanConditions {
    principal: number;                  // 借入金額
    termYears: number;                  // 借入期間（年）
    scenarios: InterestRateScenario[];  // 金利シナリオ
    customMonthlyPayment?: number;      // 手動設定された月々の返済額
}

export interface MonthlyDetail {
    month: number;                      // 通算月
    interestRate: number;               // 当月の適用年利(%)
    paymentAmount: number;              // 当月の返済額
    interestPayment: number;            // 利息充当分
    principalPayment: number;           // 元金充当分
    principalBalance: number;           // 月末の元金残高
    unpaidInterest: number;             // 当月発生した未払い利息
    accumulatedUnpaidInterest: number;  // 累積未払い利息
}
