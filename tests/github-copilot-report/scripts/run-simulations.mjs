// 実行可能なシミュレーションスクリプト（Node ESM）
// TypeScript のロジックをそのまま移植して自動テストを行います。

function calculatePMT(principal, annualRate, remainingMonths) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / remainingMonths;
  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  return Math.round((principal * monthlyRate * factor) / (factor - 1));
}

function getRateForMonth(month, scenarios) {
  const sorted = [...scenarios].sort((a, b) => a.monthOffset - b.monthOffset);
  let rate = sorted[0].interestRate;
  for (const s of sorted) {
    if (month >= s.monthOffset) rate = s.interestRate;
  }
  return rate;
}

function createEmptyDetail(month) {
  return {
    month,
    interestRate: 0,
    paymentAmount: 0,
    interestPayment: 0,
    principalPayment: 0,
    principalBalance: 0,
    unpaidInterest: 0,
    accumulatedUnpaidInterest: 0
  };
}

function calculateLoan(conditions) {
  const { principal, termYears, scenarios } = conditions;
  const totalMonths = termYears * 12;
  const details = [];

  let currentBalance = principal;
  let accumulatedUnpaidInterest = 0;

  const currentAnnualRate = getRateForMonth(1, scenarios);
  let currentPayment = calculatePMT(currentBalance, currentAnnualRate, totalMonths);
  let nextPaymentReviewMonth = 61;

  for (let month = 1; month <= totalMonths; month++) {
    const appliedAnnualRate = getRateForMonth(month, scenarios);
    const monthlyRate = appliedAnnualRate / 12 / 100;

    if (month === nextPaymentReviewMonth) {
      const remainingMonths = totalMonths - month + 1;
      const recalculatedPayment = calculatePMT(currentBalance, appliedAnnualRate, remainingMonths);
      const maxAllowedPayment = Math.floor(currentPayment * 1.25);
      currentPayment = Math.min(recalculatedPayment, maxAllowedPayment);
      nextPaymentReviewMonth += 60;
    }

    const monthlyInterest = Math.round(currentBalance * monthlyRate);
    let principalPayment;
    let interestPayment;
    let newUnpaidInterest = 0;

    if (monthlyInterest > currentPayment) {
      interestPayment = currentPayment;
      principalPayment = 0;
      newUnpaidInterest = monthlyInterest - currentPayment;
      accumulatedUnpaidInterest += newUnpaidInterest;
    } else {
      interestPayment = monthlyInterest;
      let remainingPayment = currentPayment - monthlyInterest;

      if (accumulatedUnpaidInterest > 0) {
        if (remainingPayment >= accumulatedUnpaidInterest) {
          remainingPayment -= accumulatedUnpaidInterest;
          accumulatedUnpaidInterest = 0;
          principalPayment = remainingPayment;
        } else {
          accumulatedUnpaidInterest -= remainingPayment;
          principalPayment = 0;
        }
      } else {
        principalPayment = remainingPayment;
      }
    }

    if (principalPayment > currentBalance) {
      principalPayment = currentBalance;
      currentPayment = interestPayment + principalPayment;
    }

    currentBalance -= principalPayment;
    if (currentBalance < 0) currentBalance = 0;

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

    if (currentBalance === 0 && accumulatedUnpaidInterest === 0) break;
  }

  return details;
}

function summarize(details) {
  const last = details[details.length - 1] || createEmptyDetail(0);
  return {
    months: details.length,
    finalPrincipal: last.principalBalance,
    finalAccumUnpaid: last.accumulatedUnpaidInterest,
    totalPaid: details.reduce((s, d) => s + d.paymentAmount, 0),
    totalInterestPaid: details.reduce((s, d) => s + d.interestPayment, 0)
  };
}

function printSample(details, label) {
  console.log(`--- ${label} ---`);
  console.log(`months simulated: ${details.length}`);
  console.log(`final principal: ${details[details.length-1]?.principalBalance ?? 0}`);
  console.log(`final accumulated unpaid interest: ${details[details.length-1]?.accumulatedUnpaidInterest ?? 0}`);
  console.log('sample months (first 3):');
  details.slice(0,3).forEach(d => console.log(d));
  console.log('sample months (last 3):');
  details.slice(-3).forEach(d => console.log(d));
  console.log('');
}

// テストケース
const cases = [];

// 1) 現実的な単独ローン: 3000万円, 35年, 初期金利0.84%, 変動シナリオなし
cases.push({
  name: 'Single realistic (30M, 35y, 0.84%)',
  cond: { principal: 30000000, termYears: 35, scenarios: [{ monthOffset:1, interestRate:0.84 }] }
});

// 2) ペアローン: 夫30M, 妻20M, 両方35年、0.84%
cases.push({
  name: 'Pair realistic (30M + 20M)',
  cond: null,
  pair: [
    { principal: 30000000, termYears: 35, scenarios: [{ monthOffset:1, interestRate:0.84 }] },
    { principal: 20000000, termYears: 35, scenarios: [{ monthOffset:1, interestRate:0.84 }] }
  ]
});

// 3) 未払利息が発生するケース: 初期金利0.5%で支払いが小さく設定され、その後24ヶ月目に50%に急上昇
cases.push({
  name: 'Unpaid interest scenario (rate spike to 50% at month 24)',
  cond: { principal: 20000000, termYears: 30, scenarios: [{ monthOffset:1, interestRate:0.5 }, { monthOffset:24, interestRate:50 }] }
});

(async function main(){
  for (const c of cases) {
    if (c.pair) {
      const detA = calculateLoan(c.pair[0]);
      const detB = calculateLoan(c.pair[1]);
      // 合算（簡易）
      const maxLen = Math.max(detA.length, detB.length);
      const merged = [];
      for (let i=0;i<maxLen;i++) {
        const a = detA[i] || createEmptyDetail(i+1);
        const b = detB[i] || createEmptyDetail(i+1);
        merged.push({
          month: i+1,
          interestRate: Math.max(a.interestRate, b.interestRate),
          paymentAmount: a.paymentAmount + b.paymentAmount,
          interestPayment: a.interestPayment + b.interestPayment,
          principalPayment: a.principalPayment + b.principalPayment,
          principalBalance: a.principalBalance + b.principalBalance,
          unpaidInterest: a.unpaidInterest + b.unpaidInterest,
          accumulatedUnpaidInterest: a.accumulatedUnpaidInterest + b.accumulatedUnpaidInterest
        });
      }
      printSample(merged, c.name);
      console.log('summary:', summarize(merged));
    } else {
      const det = calculateLoan(c.cond);
      printSample(det, c.name);
      console.log('summary:', summarize(det));
    }
  }
})();
