// 金額を日本の通貨形式（円）にフォーマットする関数（例: 100000 -> "￥100,000"）
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * 元利均等返済の毎月の返済額を計算する
 * @param principal 借入残高
 * @param annualRate 年利(%)
 * @param remainingMonths 残り返済回数(月)
 * @returns 毎月の返済額
*/
export function calculatePayment(
  principal: number,
  annualRate: number,
  remainingMonths: number
): number {
  if (remainingMonths <= 0) {
    console.warn(`残り返済回数： ${remainingMonths}.`);
    return 0;
  }

  // 月利を算出
  const monthlyRate = annualRate / 12 / 100;

  // 元利均等返済の公式: P = (r * PV * (1+r)^n) / ((1+r)^n - 1)
  // 月利に1を足してn乗したものを分母に持つ形で計算する
  const factor = Math.pow(1 + monthlyRate, remainingMonths);

  // 毎月の返済額：
  // 分子: 借入残高(`principal`) × 月利(`monthlyRate`) × (1+月利)^n(`factor`)
  // 分母: (1+月利)^n(`factor`) - 1
  return Math.round((principal * monthlyRate * factor) / (factor - 1));
}
