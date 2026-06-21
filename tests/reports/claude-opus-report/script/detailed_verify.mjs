// 詳細検証スクリプト — リファレンス実装との数値比較

function calculatePMT(principal, annualRate, remainingMonths) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / remainingMonths;
  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  return Math.round((principal * monthlyRate * factor) / (factor - 1));
}

// リファレンス実装（Math.roundなし）で検証
function calculatePMT_noRound(principal, annualRate, remainingMonths) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / remainingMonths;
  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function getRateForMonth(month, scenarios) {
  const sorted = [...scenarios].sort((a, b) => a.monthOffset - b.monthOffset);
  let rate = sorted[0].interestRate;
  for (const s of sorted) {
    if (month >= s.monthOffset) {
      rate = s.interestRate;
    }
  }
  return rate;
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

    if (currentBalance === 0 && accumulatedUnpaidInterest === 0) {
      break;
    }
  }

  return details;
}

// ===== シナリオA 詳細検証 =====
console.log("========== シナリオA 詳細検証 ==========");
const rawPMT = calculatePMT_noRound(30000000, 1.0, 420);
console.log(`PMT (丸め前): ${rawPMT}`);
console.log(`PMT (Math.round): ${Math.round(rawPMT)}`);
console.log(`PMT (Math.floor): ${Math.floor(rawPMT)}`);

const detailsA = calculateLoan({
  principal: 30000000,
  termYears: 35,
  scenarios: [{ monthOffset: 1, interestRate: 1.0 }]
});

// 返済額が変化した月を検出
const firstPayment = detailsA[0].paymentAmount;
console.log(`\n初月返済額: ${firstPayment}`);
for (let i = 1; i < detailsA.length; i++) {
  if (detailsA[i].paymentAmount !== firstPayment) {
    console.log(`月 ${detailsA[i].month}: paymentAmount=${detailsA[i].paymentAmount}, balance=${detailsA[i].principalBalance}`);
  }
}
console.log(`完済月: ${detailsA[detailsA.length - 1].month}`);
console.log(`最終月残高: ${detailsA[detailsA.length - 1].principalBalance}`);
console.log(`合計返済額: ${detailsA.reduce((s, d) => s + d.paymentAmount, 0)}`);
console.log(`合計利息: ${detailsA.reduce((s, d) => s + d.interestPayment, 0)}`);

// ===== シナリオB 詳細検証 =====
console.log("\n========== シナリオB 詳細検証 ==========");
const detailsB = calculateLoan({
  principal: 18100000,
  termYears: 30,
  scenarios: [
    { monthOffset: 1, interestRate: 0.68 },
    { monthOffset: 11, interestRate: 0.84 }
  ]
});

// 月別で金利変動付近を出力
for (let i = 8; i < 15; i++) {
  const d = detailsB[i];
  console.log(`月${d.month}: 金利=${d.interestRate}%, 返済=${d.paymentAmount}, 利息=${d.interestPayment}, 元金=${d.principalPayment}, 残高=${d.principalBalance}`);
}

// 年次利息集計
const yearlyInterestB = [];
for (let y = 0; y < 5; y++) {
  let sum = 0;
  for (let m = y * 12; m < (y + 1) * 12 && m < detailsB.length; m++) {
    sum += detailsB[m].interestPayment;
  }
  yearlyInterestB.push(sum);
  console.log(`${y + 1}年目利息合計: ${sum}`);
}

// ===== シナリオC 詳細検証 =====
console.log("\n========== シナリオC 詳細検証 ==========");
const detailsC = calculateLoan({
  principal: 40000000,
  termYears: 35,
  scenarios: [
    { monthOffset: 1, interestRate: 0.5 },
    { monthOffset: 24, interestRate: 3.0 },
    { monthOffset: 60, interestRate: 3.5 }
  ]
});

// 金利変動前後（22-26月目）
console.log("--- 金利変動①（0.5% → 3.0%）前後 ---");
for (let i = 21; i < 27; i++) {
  const d = detailsC[i];
  console.log(`月${d.month}: 金利=${d.interestRate}%, 返済=${d.paymentAmount}, 利息=${d.interestPayment}, 元金=${d.principalPayment}, 残高=${d.principalBalance}, 未払利息発生=${d.unpaidInterest}, 累積未払=${d.accumulatedUnpaidInterest}`);
}

// 5年ルール見直し前後（58-63月目）
console.log("\n--- 5年ルール見直し前後 ---");
for (let i = 57; i < 64; i++) {
  const d = detailsC[i];
  console.log(`月${d.month}: 金利=${d.interestRate}%, 返済=${d.paymentAmount}, 利息=${d.interestPayment}, 元金=${d.principalPayment}, 残高=${d.principalBalance}, 未払利息発生=${d.unpaidInterest}, 累積未払=${d.accumulatedUnpaidInterest}`);
}

// 未払い利息発生月
let firstUnpaidC = -1;
for (const d of detailsC) {
  if (d.unpaidInterest > 0 && firstUnpaidC === -1) {
    firstUnpaidC = d.month;
    break;
  }
}
console.log(`\n未払い利息の初発生月: ${firstUnpaidC}`);
console.log(`最終月: ${detailsC[detailsC.length - 1].month}`);
console.log(`最終残高: ${detailsC[detailsC.length - 1].principalBalance}`);
console.log(`最終累積未払: ${detailsC[detailsC.length - 1].accumulatedUnpaidInterest}`);

// 125%ルール確認
const m60 = detailsC[59];
const m61 = detailsC[60];
console.log(`\n125%ルール確認:`);
console.log(`60ヶ月目返済額: ${m60.paymentAmount}`);
console.log(`61ヶ月目返済額: ${m61.paymentAmount}`);
console.log(`1.25倍上限: ${Math.floor(m60.paymentAmount * 1.25)}`);
console.log(`適合: ${m61.paymentAmount <= Math.floor(m60.paymentAmount * 1.25)}`);

// ===== シナリオD 詳細検証 =====
console.log("\n========== シナリオD 詳細検証 ==========");
const detailsDA = calculateLoan({
  principal: 25000000,
  termYears: 35,
  scenarios: [
    { monthOffset: 1, interestRate: 0.5 },
    { monthOffset: 24, interestRate: 2.0 }
  ]
});
const detailsDB = calculateLoan({
  principal: 20000000,
  termYears: 30,
  scenarios: [
    { monthOffset: 1, interestRate: 0.5 },
    { monthOffset: 24, interestRate: 2.0 }
  ]
});

console.log(`Aさん初月返済額: ${detailsDA[0].paymentAmount}`);
console.log(`Bさん初月返済額: ${detailsDB[0].paymentAmount}`);
console.log(`合算初月返済額: ${detailsDA[0].paymentAmount + detailsDB[0].paymentAmount}`);
console.log(`Aさん最終月: ${detailsDA[detailsDA.length - 1].month}, 残高: ${detailsDA[detailsDA.length - 1].principalBalance}`);
console.log(`Bさん最終月: ${detailsDB[detailsDB.length - 1].month}, 残高: ${detailsDB[detailsDB.length - 1].principalBalance}`);

// Bさん完済後の確認
const bFinishMonth = detailsDB[detailsDB.length - 1].month;
console.log(`\nBさん完済月: ${bFinishMonth}`);
if (bFinishMonth <= 360) {
  const afterBidx = bFinishMonth; // 0-indexedでbFinishMonth番目 = bFinishMonth+1月目
  if (detailsDA[afterBidx]) {
    console.log(`Bさん完済直後(${afterBidx + 1}ヶ月目)のAさん返済額: ${detailsDA[afterBidx].paymentAmount}`);
  }
}

// 361ヶ月目の確認
if (detailsDA.length > 360) {
  console.log(`Aさん361ヶ月目返済額: ${detailsDA[360].paymentAmount}`);
  console.log(`Bさん361ヶ月目: ${detailsDB[360] ? detailsDB[360].paymentAmount : '完済済み(0)'}`);
}
