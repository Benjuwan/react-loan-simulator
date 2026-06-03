# 住宅ローン シミュレーター (変動金利・ペアローン対応)

## 制作経緯
昨今の円安や世界情勢に伴う住宅ローンの金利上昇傾向を受け、金利変動が「支払い総額」や「月々の支払内訳」、そして「未払利息」の発生にどのような影響を与えるかを直感的に視覚化するために開発されました。
特に、変動金利特有の「5年ルール」や「125%ルール」が引き起こすリスクを可視化することに重点を置いています。

## 技術構成
- @eslint/js@10.0.1
- @hookform/resolvers@5.4.0
- @tailwindcss/vite@4.3.0
- @types/node@25.9.1
- @types/react-dom@19.2.3
- @types/react@19.2.16
- @vitejs/plugin-react@6.0.2
- autoprefixer@10.5.0
- clsx@2.1.1
- eslint-plugin-react-hooks@7.1.1
- eslint-plugin-react-refresh@0.5.2
- eslint@10.4.1
- globals@17.6.0
- lucide-react@1.17.0
- postcss@8.5.15
- react-dom@19.2.7
- react-hook-form@7.77.0
- react@19.2.7
- recharts@3.8.1
- tailwind-merge@3.6.0
- tailwindcss@4.3.0
- typescript-eslint@8.60.1
- typescript@6.0.3
- vite@8.0.16
- zod@4.4.3

## 設計のポイント（計算ロジック）
- **変動金利シナリオの表現**: `LoanConditions.scenarios` に `monthOffset` と `interestRate` を定義し、指定月以降の適用金利を切り替えます。
- **元利均等返済の月次計算**: `calculateLoan()` は元利均等返済の支払額・利息・元金・残高を月次で計算し、支払期間中の変動を反映します。
- **5年ルール**: 初回60ヶ月経過後（61ヶ月目）に返済額を見直します。固定支払額モードが有効な場合は再計算せず、指定額を維持します。
- **125%ルール**: 返済額見直し時、新しい支払額は直前の返済額の1.25倍を上限とします。
- **未払利息の管理**: 当月の利息が月額返済額を超える場合、差額を未払利息として蓄積。以後の返済では未払利息を元金より優先して返済します。
- **夫婦それぞれの独立計算と合算表示**: `calculateLoan()` を夫・妻それぞれに実行し、`mergeMonthlyDetails()` で月ごとに合算。合算表示と個別表示を切り替えて比較できます。

## 主要ファイル構成
```
src/
├─ App.tsx                # 画面レイアウトと状態管理。夫婦ローンの計算結果を保持し、表示モードを切り替えます。
├─ assets/                # 画像や静的アセット
├─ components/
│  ├─ LoanChart.tsx       # 年間支払内訳と元金残高／未払利息推移のグラフを表示します。
│  ├─ LoanForm.tsx        # 借入条件入力フォーム。金利シナリオを設定して再計算できます。
│  ├─ PaymentHistory.tsx  # 月次明細テーブル。過去・直近12ヶ月・未来を分割表示します。
│  └─ TooltipIcon.tsx     # ツールチップ表示用の小さな UI コンポーネント
└─ lib/
   ├─ loanCalculator.ts   # 住宅ローン計算エンジン。元利均等返済、5年ルール、125%ルール、未払利息を反映します。
   ├─ loanMerger.ts       # 夫婦2つのローン結果を月次で合算し、世帯合算表示用のデータを作成します。
   └─ utils.ts            # 通貨フォーマットなどの共通ユーティリティ

tests/
├─ E2E_TEST_PLAN.md             # E2E テスト方針とテストケース一覧
├─ QA_Test_Scenarios.md         # QA 向けのテストシナリオ
├─ claude-opus-report/          # Claude / Opus 向けのレビューレポートと検証スクリプト
│  ├─ loan_review_prompt.md                     # レビュー用プロンプト
│  ├─ loan_simulator_comprehensive_review.md    # 詳細レビュー用ガイド
│  ├─ loan_simulator_review_report.md           # 作成されたレビュー報告書
│  └─ script/
│     ├─ comprehensive_test.mjs  # 包括的なシミュレーション検証を実行します。
│     ├─ detailed_verify.mjs     # 詳細な検証手順を実行します。
│     ├─ rounding_check.mjs      # 端数処理や丸め誤差を確認します。
│     ├─ run-simulations.mjs     # 複数シナリオの一括実行スクリプトです。
│     ├─ verify_pure.mjs         # シンプルな検証フローを実行します。
│     └─ verify.ts               # TypeScript 版の検証スクリプトです。
└─ github-copilot-report/
   ├─ simulation-report.md      # シミュレーションレビュー報告書
   └─ scripts/
      └─ run-simulations.mjs   # GitHub Copilot 用のシミュレーション実行スクリプト
```

## 免責事項
本プロジェクトは教育目的のプロトタイプであり、金融商品や投資の助言を目的としたものではありません。以下を必ずお読みください。

- **投資助言ではないこと**: 本シミュレーション結果は参考値として提供されます。最終的な判断や契約は、必ず金融機関や専門のファイナンシャルアドバイザーに相談してください。
- **正確性の保証なし**: 計算は本リポジトリ内のアルゴリズムと丸め規則に基づいて行われますが、金融機関が実際に用いる計算方式（端数処理、手数料、税金など）と完全に一致するとは限りません。
- **個人情報の取り扱い**: テスト用の実データや個人情報を含めないでください。リポジトリを公開する前に機密情報が含まれていないことを確認してください。
- **責任の制限**: 本ソフトウェアの使用によって生じた損害について、作者は一切の責任を負いません。
