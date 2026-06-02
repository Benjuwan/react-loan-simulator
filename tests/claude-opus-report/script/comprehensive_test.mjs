// 包括的テストスクリプト — 現実的パターン＋未払利息＋エッジケース

// === 計算エンジン（レビュー対象と同一ロジック） ===
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
    let principalPayment, interestPayment, newUnpaidInterest = 0;

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
      month, interestRate: appliedAnnualRate, paymentAmount: currentPayment,
      interestPayment, principalPayment, principalBalance: currentBalance,
      unpaidInterest: newUnpaidInterest, accumulatedUnpaidInterest
    });
    if (currentBalance === 0 && accumulatedUnpaidInterest === 0) break;
  }
  return details;
}

function mergeDetails(a, b) {
  const len = Math.max(a.length, b.length);
  const merged = [];
  for (let i = 0; i < len; i++) {
    const da = a[i] || { paymentAmount: 0, principalBalance: 0, interestPayment: 0, principalPayment: 0, unpaidInterest: 0, accumulatedUnpaidInterest: 0 };
    const db = b[i] || { paymentAmount: 0, principalBalance: 0, interestPayment: 0, principalPayment: 0, unpaidInterest: 0, accumulatedUnpaidInterest: 0 };
    merged.push({
      month: i + 1,
      paymentAmount: da.paymentAmount + db.paymentAmount,
      principalBalance: da.principalBalance + db.principalBalance,
      interestPayment: da.interestPayment + db.interestPayment,
      principalPayment: da.principalPayment + db.principalPayment,
      unpaidInterest: da.unpaidInterest + db.unpaidInterest,
      accumulatedUnpaidInterest: da.accumulatedUnpaidInterest + db.accumulatedUnpaidInterest,
    });
  }
  return merged;
}

// === 検証ヘルパー ===
function analyze(details, label, principal) {
  const last = details[details.length - 1];
  const totalPaid = details.reduce((s, d) => s + d.paymentAmount, 0);
  const totalInterest = details.reduce((s, d) => s + d.interestPayment, 0);
  const hasUnpaid = details.some(d => d.unpaidInterest > 0);
  const firstUnpaidMonth = details.find(d => d.unpaidInterest > 0)?.month ?? -1;
  const fullyRepaid = last.principalBalance === 0 && last.accumulatedUnpaidInterest === 0;

  // 基本的な整合性チェック
  const checks = [];

  // 1. 返済額が常に正の値
  const hasNegativePayment = details.some(d => d.paymentAmount < 0);
  checks.push({ name: '返済額が常に正', pass: !hasNegativePayment });

  // 2. 元金残高が負にならない
  const hasNegativeBalance = details.some(d => d.principalBalance < 0);
  checks.push({ name: '残高が非負', pass: !hasNegativeBalance });

  // 3. 利息充当 + 元金充当 ≤ 返済額（未払利息充当分を考慮）
  const paymentConsistency = details.every(d =>
    d.interestPayment + d.principalPayment <= d.paymentAmount + 1 // 丸め誤差許容
  );
  checks.push({ name: '返済額充当整合性', pass: paymentConsistency });

  // 4. 元金残高の推移（増加しないこと）
  let balanceNeverIncreases = true;
  for (let i = 1; i < details.length; i++) {
    if (details[i].principalBalance > details[i - 1].principalBalance) {
      balanceNeverIncreases = false;
      break;
    }
  }
  checks.push({ name: '残高非増加', pass: balanceNeverIncreases });

  // 5. 総返済額 >= 元金（利息がある場合）
  checks.push({ name: '総返済額≧元金', pass: totalPaid >= principal });

  // 6. 完済判定の妥当性
  const termMonths = details.length;
  const residualRatio = last.principalBalance / principal;
  const residualOk = fullyRepaid || residualRatio < 0.01; // 1%未満なら125%ルールの影響として許容
  checks.push({ name: '完済or残債<1%', pass: residualOk });

  const allPass = checks.every(c => c.pass);
  const failedChecks = checks.filter(c => !c.pass).map(c => c.name);

  return {
    label, principal, totalPaid, totalInterest, hasUnpaid, firstUnpaidMonth,
    fullyRepaid, termMonths, lastBalance: last.principalBalance,
    lastAccumUnpaid: last.accumulatedUnpaidInterest,
    firstPayment: details[0].paymentAmount,
    allPass, failedChecks, checks
  };
}

function printResult(r) {
  const status = r.allPass ? '✅' : '❌';
  console.log(`\n${status} ${r.label}`);
  console.log(`  元金: ${(r.principal / 10000).toLocaleString()}万円`);
  console.log(`  初月返済額: ${r.firstPayment.toLocaleString()}円`);
  console.log(`  返済月数: ${r.termMonths}ヶ月（${Math.floor(r.termMonths / 12)}年${r.termMonths % 12}ヶ月）`);
  console.log(`  総返済額: ${r.totalPaid.toLocaleString()}円`);
  console.log(`  総利息: ${r.totalInterest.toLocaleString()}円`);
  console.log(`  利息率: ${((r.totalInterest / r.principal) * 100).toFixed(2)}%`);
  console.log(`  完済: ${r.fullyRepaid ? 'はい' : `いいえ（残高: ${r.lastBalance.toLocaleString()}円, 未払利息: ${r.lastAccumUnpaid.toLocaleString()}円）`}`);
  console.log(`  未払利息: ${r.hasUnpaid ? `発生あり（初発生: ${r.firstUnpaidMonth}ヶ月目）` : '発生なし'}`);
  if (!r.allPass) {
    console.log(`  ❌ 失敗チェック: ${r.failedChecks.join(', ')}`);
  }
}

// =============================================
// Part 1: 現実的なシングルローン（7パターン）
// =============================================
console.log('='.repeat(60));
console.log('Part 1: 現実的なシングルローン');
console.log('='.repeat(60));

const singleCases = [
  {
    name: 'S1: 超低金利・標準（3,000万, 35年, 0.4%固定）',
    cond: { principal: 30000000, termYears: 35, scenarios: [{ monthOffset: 1, interestRate: 0.4 }] }
  },
  {
    name: 'S2: 一般的（3,500万, 35年, 0.8%固定）',
    cond: { principal: 35000000, termYears: 35, scenarios: [{ monthOffset: 1, interestRate: 0.8 }] }
  },
  {
    name: 'S3: やや高金利（4,500万, 35年, 1.5%固定）',
    cond: { principal: 45000000, termYears: 35, scenarios: [{ monthOffset: 1, interestRate: 1.5 }] }
  },
  {
    name: 'S4: 短期間（2,000万, 20年, 0.8%固定）',
    cond: { principal: 20000000, termYears: 20, scenarios: [{ monthOffset: 1, interestRate: 0.8 }] }
  },
  {
    name: 'S5: 少額・短期（1,500万, 15年, 1.0%固定）',
    cond: { principal: 15000000, termYears: 15, scenarios: [{ monthOffset: 1, interestRate: 1.0 }] }
  },
  {
    name: 'S6: 高額（8,000万, 35年, 0.5%→1.2%@12ヶ月）',
    cond: { principal: 80000000, termYears: 35, scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 12, interestRate: 1.2 }
    ]}
  },
  {
    name: 'S7: 複数回変動（3,500万, 30年, 0.68%→0.84%→1.2%→1.5%）',
    cond: { principal: 35000000, termYears: 30, scenarios: [
      { monthOffset: 1, interestRate: 0.68 },
      { monthOffset: 7, interestRate: 0.84 },
      { monthOffset: 61, interestRate: 1.2 },
      { monthOffset: 121, interestRate: 1.5 }
    ]}
  },
];

const singleResults = [];
for (const c of singleCases) {
  const details = calculateLoan(c.cond);
  const result = analyze(details, c.name, c.cond.principal);
  singleResults.push(result);
  printResult(result);
}

// =============================================
// Part 2: 現実的なペアローン（3パターン）
// =============================================
console.log('\n' + '='.repeat(60));
console.log('Part 2: 現実的なペアローン');
console.log('='.repeat(60));

const pairCases = [
  {
    name: 'P1: 同条件ペア（夫3,000万+妻2,000万, 35年, 0.8%固定）',
    condA: { principal: 30000000, termYears: 35, scenarios: [{ monthOffset: 1, interestRate: 0.8 }] },
    condB: { principal: 20000000, termYears: 35, scenarios: [{ monthOffset: 1, interestRate: 0.8 }] },
  },
  {
    name: 'P2: 異なる期間（夫3,500万/35年+妻1,500万/20年, 0.68%→0.84%）',
    condA: { principal: 35000000, termYears: 35, scenarios: [
      { monthOffset: 1, interestRate: 0.68 },
      { monthOffset: 7, interestRate: 0.84 }
    ]},
    condB: { principal: 15000000, termYears: 20, scenarios: [
      { monthOffset: 1, interestRate: 0.68 },
      { monthOffset: 7, interestRate: 0.84 }
    ]},
  },
  {
    name: 'P3: 高額ペア+変動（夫5,000万/35年+妻3,000万/30年, 0.5%→1.5%@24月）',
    condA: { principal: 50000000, termYears: 35, scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 24, interestRate: 1.5 }
    ]},
    condB: { principal: 30000000, termYears: 30, scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 24, interestRate: 1.5 }
    ]},
  },
];

const pairResults = [];
for (const c of pairCases) {
  const detA = calculateLoan(c.condA);
  const detB = calculateLoan(c.condB);
  const merged = mergeDetails(detA, detB);
  const totalPrincipal = c.condA.principal + c.condB.principal;

  // 合算整合性チェック
  let mergeConsistent = true;
  for (let i = 0; i < merged.length; i++) {
    const a = detA[i] || { principalBalance: 0, paymentAmount: 0 };
    const b = detB[i] || { principalBalance: 0, paymentAmount: 0 };
    if (merged[i].principalBalance !== a.principalBalance + b.principalBalance) {
      mergeConsistent = false;
      break;
    }
    if (merged[i].paymentAmount !== a.paymentAmount + b.paymentAmount) {
      mergeConsistent = false;
      break;
    }
  }

  // B完済後の検証
  let afterBcorrect = true;
  if (detB.length < detA.length) {
    for (let i = detB.length; i < detA.length; i++) {
      if (merged[i].paymentAmount !== detA[i].paymentAmount) {
        afterBcorrect = false;
        break;
      }
    }
  }

  const result = analyze(merged, c.name, totalPrincipal);
  result.mergeConsistent = mergeConsistent;
  result.afterBcorrect = afterBcorrect;
  result.aMonths = detA.length;
  result.bMonths = detB.length;
  pairResults.push(result);

  printResult(result);
  console.log(`  合算整合性: ${mergeConsistent ? '✅' : '❌'}`);
  console.log(`  Aさん返済月数: ${detA.length}, Bさん返済月数: ${detB.length}`);
  if (detB.length < detA.length) {
    console.log(`  B完済後の合算=Aのみ: ${afterBcorrect ? '✅' : '❌'}`);
  }
}

// =============================================
// Part 3: 未払利息発生テスト（4パターン）
// =============================================
console.log('\n' + '='.repeat(60));
console.log('Part 3: 未払利息発生テスト');
console.log('='.repeat(60));

const unpaidCases = [
  {
    name: 'U1: 中程度上昇（4,000万, 35年, 0.5%→3.5%@24月）',
    cond: { principal: 40000000, termYears: 35, scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 24, interestRate: 3.5 }
    ]}
  },
  {
    name: 'U2: 急上昇（3,000万, 35年, 0.5%→5.0%@12月）',
    cond: { principal: 30000000, termYears: 35, scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 12, interestRate: 5.0 }
    ]}
  },
  {
    name: 'U3: 段階的上昇（4,000万, 35年, 0.5%→2.0%→4.0%→6.0%）',
    cond: { principal: 40000000, termYears: 35, scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 24, interestRate: 2.0 },
      { monthOffset: 60, interestRate: 4.0 },
      { monthOffset: 120, interestRate: 6.0 }
    ]}
  },
  {
    name: 'U4: 一時的急騰→回復（3,500万, 35年, 0.5%→5.0%→0.8%）',
    cond: { principal: 35000000, termYears: 35, scenarios: [
      { monthOffset: 1, interestRate: 0.5 },
      { monthOffset: 24, interestRate: 5.0 },
      { monthOffset: 61, interestRate: 0.8 }
    ]}
  },
];

const unpaidResults = [];
for (const c of unpaidCases) {
  const details = calculateLoan(c.cond);
  const result = analyze(details, c.name, c.cond.principal);

  // 未払利息の詳細分析
  const unpaidMonths = details.filter(d => d.unpaidInterest > 0);
  const maxAccum = Math.max(...details.map(d => d.accumulatedUnpaidInterest));
  const maxAccumMonth = details.find(d => d.accumulatedUnpaidInterest === maxAccum)?.month;

  // 未払利息発生月の元金充当がゼロか確認
  const unpaidPrincipalZero = unpaidMonths.every(d => d.principalPayment === 0);

  // 5年ルール見直し後の125%ルール適用チェック
  const reviewMonths = [61, 121, 181, 241, 301, 361];
  let rule125ok = true;
  for (const rm of reviewMonths) {
    const idx = rm - 1;
    const prevIdx = rm - 2;
    if (idx < details.length && prevIdx >= 0) {
      // 見直し前の返済額
      const prevPayment = details[prevIdx].paymentAmount;
      const newPayment = details[idx].paymentAmount;
      if (newPayment > Math.floor(prevPayment * 1.25) + 1) { // +1は丸め許容
        rule125ok = false;
        console.log(`  ❌ 125%ルール違反: ${rm}ヶ月目 ${prevPayment}→${newPayment} (上限: ${Math.floor(prevPayment * 1.25)})`);
      }
    }
  }

  result.unpaidMonthCount = unpaidMonths.length;
  result.maxAccum = maxAccum;
  result.maxAccumMonth = maxAccumMonth;
  result.unpaidPrincipalZero = unpaidPrincipalZero;
  result.rule125ok = rule125ok;
  unpaidResults.push(result);

  printResult(result);
  console.log(`  未払利息発生月数: ${unpaidMonths.length}ヶ月`);
  console.log(`  累積未払利息ピーク: ${maxAccum.toLocaleString()}円（${maxAccumMonth}ヶ月目）`);
  console.log(`  未払発生月の元金充当=0: ${unpaidPrincipalZero ? '✅' : '❌'}`);
  console.log(`  125%ルール遵守: ${rule125ok ? '✅' : '❌'}`);
}

// =============================================
// Part 4: エッジケース（適切性検証）
// =============================================
console.log('\n' + '='.repeat(60));
console.log('Part 4: エッジケース（適切性検証）');
console.log('='.repeat(60));

const edgeCases = [
  {
    name: 'E1: 金利0%（無利息）',
    cond: { principal: 10000000, termYears: 10, scenarios: [{ monthOffset: 1, interestRate: 0 }] }
  },
  {
    name: 'E2: 非常に小額（100万, 10年, 1.0%）',
    cond: { principal: 1000000, termYears: 10, scenarios: [{ monthOffset: 1, interestRate: 1.0 }] }
  },
  {
    name: 'E3: 高額・長期（1億, 35年, 0.5%固定）',
    cond: { principal: 100000000, termYears: 35, scenarios: [{ monthOffset: 1, interestRate: 0.5 }] }
  },
  {
    name: 'E4: 最短期間（500万, 5年, 1.0%）',
    cond: { principal: 5000000, termYears: 5, scenarios: [{ monthOffset: 1, interestRate: 1.0 }] }
  },
];

for (const c of edgeCases) {
  const details = calculateLoan(c.cond);
  const result = analyze(details, c.name, c.cond.principal);
  printResult(result);

  // 金利0%の特別チェック
  if (c.name.includes('金利0%')) {
    const expectedPayment = Math.round(c.cond.principal / (c.cond.termYears * 12));
    console.log(`  期待返済額: ${expectedPayment}円/月`);
    console.log(`  利息ゼロ確認: ${details.every(d => d.interestPayment === 0) ? '✅' : '❌'}`);
  }
}

// =============================================
// 総合サマリー
// =============================================
console.log('\n' + '='.repeat(60));
console.log('総合サマリー');
console.log('='.repeat(60));

const allResults = [...singleResults, ...pairResults, ...unpaidResults];
const passCount = allResults.filter(r => r.allPass).length;
const failCount = allResults.filter(r => !r.allPass).length;

console.log(`\n  合計テスト数: ${allResults.length}`);
console.log(`  ✅ PASS: ${passCount}`);
console.log(`  ❌ FAIL: ${failCount}`);

if (failCount > 0) {
  console.log('\n  失敗したテスト:');
  for (const r of allResults.filter(r => !r.allPass)) {
    console.log(`    ❌ ${r.label}: ${r.failedChecks.join(', ')}`);
  }
}

// ペアローン固有チェック
const pairAllOk = pairResults.every(r => r.mergeConsistent && r.afterBcorrect);
console.log(`\n  ペアローン合算整合性: ${pairAllOk ? '✅ 全て一致' : '❌ 不一致あり'}`);

// 未払利息固有チェック
const unpaidLogicOk = unpaidResults.every(r => r.unpaidPrincipalZero && r.rule125ok);
console.log(`  未払利息ロジック: ${unpaidLogicOk ? '✅ 全て正常' : '❌ 異常あり'}`);
