import { calculateLoan } from '../../../src/lib/loanCalculator';

function verifyScenarioA() {
  const cond = {
    principal: 30000000,
    termYears: 35,
    scenarios: [{ monthOffset: 1, interestRate: 1.0 }]
  };
  const details = calculateLoan(cond);

  const firstPayment = details[0].paymentAmount;
  let paymentChanged = false;
  let interestDecreases = true;
  let principalDecreases = true;
  let hasUnpaidInterest = false;

  for (let i = 1; i < details.length; i++) {
    if (details[i].paymentAmount !== firstPayment && details[i].paymentAmount !== details[i - 1].paymentAmount + details[i].principalBalance) { // 最終月の端数調整考慮
      if (details[i].principalBalance > 0) paymentChanged = true;
    }
    if (details[i].interestPayment > details[i - 1].interestPayment) interestDecreases = false;
    if (details[i].principalBalance > details[i - 1].principalBalance) principalDecreases = false;
    if (details[i].unpaidInterest > 0) hasUnpaidInterest = true;
  }

  console.log("=== Scenario A ===");
  console.log(`First payment: ${firstPayment} (Expected: 84685)`);
  console.log(`Payment unchanged: ${!paymentChanged}`);
  console.log(`Interest monotonic decrease: ${interestDecreases}`);
  console.log(`Principal monotonic decrease: ${principalDecreases}`);
  console.log(`No unpaid interest: ${!hasUnpaidInterest}`);
}

function verifyScenarioB() {
  const cond = {
    principal: 18100000,
    termYears: 30,
    scenarios: [
      { monthOffset: 1, interestRate: 0.68 },
      { monthOffset: 11, interestRate: 0.84 }
    ]
  };
  const details = calculateLoan(cond);

  let year1Interest = 0;
  let year2Interest = 0;
  let year3Interest = 0;
  let hasUnpaidInterest = false;

  details.forEach((d) => {
    if (d.month <= 12) year1Interest += d.interestPayment;
    else if (d.month <= 24) year2Interest += d.interestPayment;
    else if (d.month <= 36) year3Interest += d.interestPayment;

    if (d.unpaidInterest > 0) hasUnpaidInterest = true;
  });

  console.log("\n=== Scenario B ===");
  console.log(`Year 1 Interest: ${year1Interest}`);
  console.log(`Year 2 Interest: ${year2Interest}`);
  console.log(`Year 3 Interest: ${year3Interest}`);
  console.log(`Year 2 > Year 1: ${year2Interest > year1Interest}`);
  console.log(`Year 3 < Year 2: ${year3Interest < year2Interest}`);
  console.log(`No unpaid interest: ${!hasUnpaidInterest}`);
}

function verifyScenarioC() {
  const cond = {
    principal: 40000000,
    termYears: 35,
    scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 24, interestRate: 3.0 },
      { monthOffset: 60, interestRate: 3.5 }
    ]
  };
  const details = calculateLoan(cond);

  let firstUnpaidMonth = -1;
  let month60Accumulated = 0;
  let month60Payment = 0;
  let month61Payment = 0;
  let unpaidPrincipalPayZero = true;

  details.forEach((d) => {
    if (d.unpaidInterest > 0 && firstUnpaidMonth === -1) {
      firstUnpaidMonth = d.month;
    }
    if (d.month === 60) {
      month60Accumulated = d.accumulatedUnpaidInterest;
      month60Payment = d.paymentAmount;
    }
    if (d.month === 61) {
      month61Payment = d.paymentAmount;
    }
    if (d.unpaidInterest > 0 && d.principalPayment > 0) {
      unpaidPrincipalPayZero = false;
    }
  });

  console.log("\n=== Scenario C ===");
  console.log(`First unpaid interest month: ${firstUnpaidMonth}`);
  console.log(`Month 60 accumulated unpaid interest: ${month60Accumulated}`);
  console.log(`Month 61 payment: ${month61Payment} (Month 60 payment: ${month60Payment})`);
  console.log(`Is month 61 payment <= 1.25 * month 60 payment: ${month61Payment <= Math.floor(month60Payment * 1.25)}`);
  console.log(`Principal payment is zero when unpaid interest generated: ${unpaidPrincipalPayZero}`);
}

function verifyScenarioD() {
  const condA = {
    principal: 25000000,
    termYears: 35,
    scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 24, interestRate: 2.0 }
    ]
  };
  const condB = {
    principal: 20000000,
    termYears: 30,
    scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 24, interestRate: 2.0 }
    ]
  };
  const detailsA = calculateLoan(condA);
  const detailsB = calculateLoan(condB);

  // ペアローン合算
  const maxLen = Math.max(detailsA.length, detailsB.length);
  const merged = [];
  for (let i = 0; i < maxLen; i++) {
    const a = detailsA[i] || { paymentAmount: 0, principalBalance: 0 };
    const b = detailsB[i] || { paymentAmount: 0, principalBalance: 0 };
    merged.push({
      month: i + 1,
      paymentAmount: a.paymentAmount + b.paymentAmount,
      principalBalance: a.principalBalance + b.principalBalance
    });
  }

  const firstMonthSum = detailsA[0].paymentAmount + detailsB[0].paymentAmount;
  const mergedFirstMonth = merged[0].paymentAmount;

  let remainderMatches = true;
  for (let i = 0; i < maxLen; i++) {
    const expectedBalance = (detailsA[i]?.principalBalance || 0) + (detailsB[i]?.principalBalance || 0);
    if (merged[i].principalBalance !== expectedBalance) remainderMatches = false;
  }

  const month361A = detailsA[360]?.paymentAmount || 0;
  const month361Merged = merged[360]?.paymentAmount || 0;

  console.log("\n=== Scenario D ===");
  console.log(`First month combined payment equals sum of both: ${mergedFirstMonth === firstMonthSum}`);
  console.log(`Combined balance equals sum of both balances: ${remainderMatches}`);
  console.log(`After B finishes (month 361), combined payment equals A only: ${month361Merged === month361A}`);
}

verifyScenarioA();
verifyScenarioB();
verifyScenarioC();
verifyScenarioD();
