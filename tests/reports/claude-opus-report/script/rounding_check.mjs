// シナリオA 丸め問題の詳細確認

function calculatePMT_noRound(principal, annualRate, remainingMonths) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / remainingMonths;
  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function calculatePMT(principal, annualRate, remainingMonths) {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / remainingMonths;
  const factor = Math.pow(1 + monthlyRate, remainingMonths);
  return Math.round((principal * monthlyRate * factor) / (factor - 1));
}

// シナリオA: リファレンス仕様との比較
console.log("===== 丸め方式の比較 =====");
const raw = calculatePMT_noRound(30000000, 1.0, 420);
console.log(`PMT raw (丸めなし): ${raw}`);
console.log(`Math.round: ${Math.round(raw)}`);
console.log(`Math.floor: ${Math.floor(raw)}`);
console.log(`Math.ceil:  ${Math.ceil(raw)}`);

// 指示書のリファレンス値は 84,685円。現実装はMath.roundで84,686円。
// → PMT raw が 84685.5... のような値で、roundで繰り上がっている可能性

// シナリオC: 60ヶ月目の検証
// 未払利息が60月目「のみ」で発生 → 「24〜60ヶ月の間のいずれか」に該当するか
console.log("\n===== シナリオC: 未払利息詳細 =====");
console.log("60ヶ月目に未払い利息が発生 → 仕様では「24〜60ヶ月の間のいずれか」");
console.log("→ 60は範囲内なのでOK");

// 61ヶ月目: 5年ルールが適用され、返済額が見直される
// 見直し月は61 → 合致
// 新返済額 129,792 = floor(103834 * 1.25) = floor(129792.5) = 129792 → 125%ルール上限ぴったり
console.log("\n===== 125%ルール計算詳細 =====");
console.log(`前回返済額: 103834`);
console.log(`1.25倍（Math.floor）: ${Math.floor(103834 * 1.25)}`);
console.log(`1.25倍（そのまま）: ${103834 * 1.25}`);

// シナリオA: 5年ルールの再計算で返済額が変化する月を特定
console.log("\n===== シナリオA: 5年ルール見直しの影響 =====");
// 固定金利なので、5年後の見直しでは残高と残月数に基づいて再計算される
// 丸め誤差の蓄積により、再計算結果がわずかに変わる可能性がある
const pmt1 = calculatePMT(30000000, 1.0, 420);
console.log(`初期PMT: ${pmt1}`);

// 61ヶ月目時点の仮残高を計算
let bal = 30000000;
let rate = 1.0 / 12 / 100;
for (let m = 1; m <= 60; m++) {
  const interest = Math.round(bal * rate);
  const principal = pmt1 - interest;
  bal -= principal;
}
console.log(`60ヶ月目後の残高: ${bal}`);
const pmt2 = calculatePMT(bal, 1.0, 360);
console.log(`61ヶ月目再計算PMT: ${pmt2}`);
console.log(`変化: ${pmt2 - pmt1}円`);

// 121ヶ月目
for (let m = 61; m <= 120; m++) {
  const interest = Math.round(bal * rate);
  const principal = pmt2 - interest;
  bal -= principal;
}
console.log(`\n120ヶ月目後の残高: ${bal}`);
const pmt3 = calculatePMT(bal, 1.0, 300);
console.log(`121ヶ月目再計算PMT: ${pmt3}`);
console.log(`変化: ${pmt3 - pmt2}円`);

// 181ヶ月目
for (let m = 121; m <= 180; m++) {
  const interest = Math.round(bal * rate);
  const principal = pmt3 - interest;
  bal -= principal;
}
console.log(`\n180ヶ月目後の残高: ${bal}`);
const pmt4 = calculatePMT(bal, 1.0, 240);
console.log(`181ヶ月目再計算PMT: ${pmt4}`);
console.log(`変化: ${pmt4 - pmt3}円`);
