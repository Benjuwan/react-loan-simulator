/**
 * - clsx: クラス名（string や object など）を結合して、条件付きクラス名文字列を生成するユーティリティ関数です。
 * - type ClassValue: clsx が受け取れる引数の型定義で、TypeScript で型チェックのためにインポートしています。
*/
import { type ClassValue, clsx } from "clsx";

/**
 * - twMerge: 複数の Tailwind CSS クラス名をマージして、重複や競合するユーティリティクラスを整理する関数です。たとえば px-4 px-2 のような重複があった場合、後のスタイルが優先されて不要な重複を削除します。
*/
import { twMerge } from "tailwind-merge";

/**
 * 複数の class 名を結合し、Tailwind の重複や競合を解消します。
 * @param inputs - clsx が受け取れる class 名の配列
 * @returns 正規化された class 名文字列
*/
export function cn(...inputs: ClassValue[]) {
  // clsx で truthy なクラスを結合し、twMerge で重複や競合を整理する
  return twMerge(clsx(inputs));
}

/**
 * 金額を日本の通貨形式（円）にフォーマットします。
 *
 * 例: 100000 -> "￥100,000"
*/
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * 月数を「X年Yヶ月」の形式にフォーマットします。
 *
 * 例: 25 -> "2年1ヶ月"
*/
export function formatMonthsToYears(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return `${remainingMonths}ヶ月`;
  if (remainingMonths === 0) return `${years}年`;
  return `${years}年${remainingMonths}ヶ月`;
}
