# Loan Simulator — 検証レポート

作成日: 2026-06-02

## 概要
本レポートは `src/lib/loanCalculator.ts` の計算ロジックを Node スクリプトで実行し、現実的な入力および異常系（未払利息発生）を想定した挙動検証結果をまとめたものです。目的は他の AI やエンジニアが再現・テストできるようにすることです。

## 再現手順
1. リポジトリのルートで以下を実行してください。

```bash
node scripts/run-simulations.mjs
```

2. 出力に各ケースのサマリとサンプル月次データが表示されます。

## 実行したテストケース
- Single realistic (30,000,000円, 35年, 初期金利 0.84%)
- Pair realistic (夫 30,000,000円 + 妻 20,000,000円, 両者 35年, 初期金利 0.84%)
- Unpaid interest scenario (20,000,000円, 30年, 初期 0.5% -> 24ヶ月目に 50% に急上昇)

## 実行結果サマリ
（スクリプト実行時の出力をそのまま抜粋）

### Single realistic (30M, 35y, 0.84%)
- months simulated: 420
- final principal: 9
- final accumulated unpaid interest: 0
- totalPaid: 34,636,200
- totalInterestPaid: 4,636,209

### Pair realistic (30M + 20M)
- months simulated: 420
- final principal: 9
- final accumulated unpaid interest: 0
- totalPaid: 57,727,008
- totalInterestPaid: 7,727,017

### Unpaid interest scenario (rate spike to 50% at month 24)
- months simulated: 360
- final principal: 18,809,945
- final accumulated unpaid interest: 225,077,590
- totalPaid: 40,421,760
- totalInterestPaid: 39,231,705

また、各ケースで最初3ヶ月と最後3ヶ月分のサンプル月次データが出力されています（スクリプト参照）。

## 観察・解析
- 基本挙動: 元利均等返済、5年ルール（返済額見直しは61,121,...月）、125%ルール、そして未払利息の蓄積ロジックが実装されており、住宅ローンの代表的な振る舞いを再現しています。
- 正常ケース: 0.84% の現実的金利では、想定どおり完済に至り、累積未払利息は発生しませんでした。
- 異常ケース: 金利を 24ヶ月目に 50% へ急上昇させると、月々の発生利息が返済額を上回り未払利息が累積。最終まで大量の未払利息が残る結果となり、シミュレータは“最終期に負債が残る”挙動を正しく可視化しました。
- 数値処理: 月利や支払額は `Math.round` で丸めており、長期累積で小さな丸め誤差が生じますが、挙動の妥当性には影響しない範囲です。

## 推奨と改善案
- UI 表示: 未払利息が発生した場合に分かりやすい警告バナー、詳細な数値（最終一括返済額）と推奨アクションを UI 側に追加してください。
- テスト自動化: `scripts/run-simulations.mjs` をベースに、Jest 等で数値的アサーションを追加すると将来の改修での回帰検知に有効です。
- 丸め戦略: 超精密な会計用途では銀行の丸めルール（端数切捨て/切上げ）に合わせた丸めへ変更検討。
- 最終処理: 期間終了時に残債や未払利息がある場合の自動一括清算シナリオ（リファイナンス／一括返済）をシミュレーションに追加すると、より実務的な解析が可能になります。

## 作成・参照ファイル
- スクリプト: `scripts/run-simulations.mjs`
- レポート: `tests/simulation-report.md` (このファイル)
- 関連ソース: `src/lib/loanCalculator.ts`, `src/lib/loanMerger.ts`, `src/components/LoanChart.tsx`, `src/components/LoanForm.tsx`

## 備考
- 本検証はコードを変更せずにロジックを Node 上で再実行したものです。ブラウザ UI の E2E 確認は別途 `npm run dev` で行ってください。

---
検証者: GitHub Copilot

## ブラウザ E2E テスト（実行結果）

ローカルの開発サーバを起動し、実際にフォームに入力して「再計算」を押し、UI のグラフ表示・最終残高表示を確認しました。スクリーンショットは以下に保存しています。

- `tests/screenshots/scenario1.png` — Single realistic の画面キャプチャ（夫のみ 3000万円）
- `tests/screenshots/scenario2.png` — Pair realistic の画面キャプチャ（夫 3000万円 + 妻 2000万円）
- `tests/screenshots/scenario3.png` — 未払利息発生シナリオの画面キャプチャ（夫 2000万円、24ヶ月目に金利 50% に上昇）

簡単な自動操作手順:

```bash
npm run dev
# ブラウザで http://localhost:5173 を開く
# フォームに値を入力して「この条件で再計算する」を押す
```

備考: スクリーンショットは `tests/screenshots/` に保存済みです。
