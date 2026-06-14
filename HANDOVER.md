# 引き継ぎドキュメント（HANDOVER.md）

## 1. 目的とゴール
- **当初の目的**: 昨今の金利上昇を背景に、住宅ローン（変動金利）の変動によって「支払い総額の差分」「月々の支払額の内訳」「未払利息」の発生状況を視覚化できるシミュレーションツールの作成。
- **最終ゴール**: ユーザーが夫・妻それぞれのペアローン条件を入力し、世帯合算での推移をグラフで直感的に確認できるモダンなWebアプリを構築・提供すること。

## 2. 現在のコンテキストと前提条件
- **技術スタック**: React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Recharts 3, lucide-react, React Hook Form 7, Zod 4, @hookform/resolvers 5
- **環境・制約**: `tasks/loan-simulator` ディレクトリ配下にて作業中（`.gitignore` で除外されている）。
- **主要な関連ファイル**:
  - `src/lib/loanCalculator.ts`: 住宅ローンの計算エンジン（5年ルール、125%ルール、未払利息の計算ロジック）
  - `src/lib/loanMerger.ts`: ペアローンの個別計算結果を世帯合算するロジック
  - `src/lib/utils.ts`: `calculatePayment()`（元利均等返済の月額計算）などのユーティリティ関数
  - `src/ts/modelInterfaces.ts`: `LoanConditions`, `MonthlyDetail`, `InterestRateScenario` の型定義
  - `src/schema/zodSchema.ts`: フォームバリデーションスキーマ（`formSchema`, `personSchema`, `customNumber`）
  - `src/components/LoanForm.tsx`: フォーム全体の管理（RHF + zodResolver）、`toLoanConditions()` によるフォーム値→計算エンジン入力の変換
  - `src/components/PersonalLoanForm.tsx`: 夫・妻それぞれの個人ローン入力フォーム（LoanFormから分離）
  - `src/components/LoanChart.tsx`: Rechartsによる月々の内訳・残高推移の描画コンポーネント
  - `src/components/PaymentHistory.tsx`: 月別明細の表示コンポーネント
  - `src/components/TooltipIcon.tsx`: ツールチップアイコンコンポーネント
  - `src/App.tsx`: フォームとグラフを統合・制御するメインコンポーネント

## 3. ここまでの経緯（タイムライン）

### フェーズ1〜4（前回セッション以前）
- 基本的な計算エンジンの作成からグラフ描画、ペアローンUIの統合、ドキュメント化までを完了。
- 「支払額を固定する（繰り上げ返済シミュレーション）」機能の分離、合算時の金利表示調整、Zodバリデーション追加等の改修を実施。
- Playwright MCP を用いたE2E検証を完了。

### フェーズ5（今回セッション: リファクタリング・コードレビュー・新機能実装）

#### 5-1. LoanForm.tsx のリファクタリング
- **PersonalLoanForm.tsx の分離**: 夫・妻の個人フォーム部分を `PersonalLoanForm.tsx` として独立コンポーネントに切り出し。
- **zodSchema.ts の分離**: Zodスキーマ定義を `src/schema/zodSchema.ts` に移動（`formSchema`, `personSchema`, `customNumber`, `scenarioSchema`）。
- **型定義の整理**: `FormValues`, `PersonValues` を zodSchema.ts からエクスポート。

#### 5-2. zodSchema.ts の修正
- `customNumber` の `maxVal` 条件: `if (maxVal && maxMsg)` → `if (maxVal !== undefined && maxMsg !== undefined)` に修正（`maxVal = 0` の場合に falsy 判定されるバグを防止）。
- `z.nan()` のコメント追記: `fixedPaymentAmount` の union 型で `z.nan()` が必要な理由（固定モード OFF 時に空欄 input が返す NaN をスキーマ段階で通過させ、superRefine で状態判定する設計）を詳細に記述。
- `superRefine` 内の条件: `!data.fixedPaymentAmount` → `data.fixedPaymentAmount === undefined` に修正（falsy チェックでは `0` が誤判定される可能性があるため、明示的な undefined チェックに変更）。
- Zod エラーコード: `z.ZodIssueCode.custom`（非推奨警告）→ `code: "custom"` に変更。

#### 5-3. コードコメントの整備
- `FieldErrors<FormValues>` のネスト構造に関する解説コメントを `PersonalLoanForm.tsx` の `personErrors` 定義箇所に追記。RHF が FormValues の型構造から自動的にネストしたエラー型を構築するため、zodSchema 側に特別なキー定義は不要である旨を明記。
- 全ファイルにわたるコードコメントの包括的なレビューと修正を実施。

#### 5-4. `initialMonthlyPayment` の新規実装（月々の支払額のユーザー入力値を計算に反映）

**背景**: フォームの「月々の支払額」フィールド（`monthlyPayment`）は表示のみで、`toLoanConditions()` で計算エンジンに渡されていなかった。

**設計判断**: 既存の `customMonthlyPayment` は「初期返済額の上書き」＋「5年ルール見直しの無効化」の2つの責務を持つため、流用せず新フィールド `initialMonthlyPayment` を追加して責務を分離した。

| フィールド | 初期返済額の上書き | 5年ルール見直しの無効化 |
|---|---|---|
| `initialMonthlyPayment`（新規） | ✅ | ❌（通常適用） |
| `customMonthlyPayment`（既存） | ✅ | ✅（無効化） |

**変更ファイル**:
1. `src/ts/modelInterfaces.ts` L10: `initialMonthlyPayment?: number` フィールド追加
2. `src/lib/loanCalculator.ts` L48-56: 初期返済額の決定に `else if (initialMonthlyPayment)` 分岐追加。優先順位: `customMonthlyPayment`（固定モード） > `initialMonthlyPayment`（ユーザー指定） > `calculatePayment()`（元利均等返済の公式による算出、フォールバック用）
3. `src/components/LoanForm.tsx` L111-112: `toLoanConditions()` に `initialMonthlyPayment: d.monthlyPayment` 追加
4. `src/components/PersonalLoanForm.tsx`: コードコメントの更新（旧TODO削除、実装済み説明追記）、UI注釈テキストに「条件変更時はこの値も合わせて修正してください」を追記

**既知の制約（将来の改善候補）**: `monthlyPayment` の初期値は `defaultValues` で一度だけ計算され、借入額・金利・期間を変更しても自動更新されない。条件変更後にユーザーが `monthlyPayment` を手動修正しないと、不適切な返済額でシミュレーションが実行される（例: 借入額増加時に未払利息が急増する結果になる）。将来的に `useEffect` による自動再計算の追加が検討できるが、「ユーザーが手動で変更した値を自動上書きしてよいか」というUX判断が必要。

## 4. 決定事項と確定済みの仕様
- **計算ロジックの正当性**: 途中で金利が上昇した際、一時的に「前年より利息支払い額が増加する」ことはローンの仕組み上正しい挙動として確定済み。
- **ペアローンの合算方式**: 夫・妻それぞれで独立して `MonthlyDetail[]` を計算し、最後に `mergeMonthlyDetails` を使って月ごとに値を合算（加算）して描画するアプローチで確定。
- **グラフの年次集計**: 360ヶ月（30年）のデータをそのまま描画するとグラフが潰れるため、`LoanChart.tsx` 側で12ヶ月ごとの「年間合算データ」と「年末時点の残高」にサンプリングして描画する仕様で確定。
- **ペアローンの金利**: 同時期に借入するケースがほとんどのため、合算時は同じ金利適用として表示。異なる金利の場合は「-（個別参照）」と表示。
- **`initialMonthlyPayment` と `customMonthlyPayment` の共存**: 固定モード有効時は両フィールドが同時に設定されるが、`customMonthlyPayment` が常に優先される（`initialMonthlyPayment` は無視される）。これは仕様通り。
- **zodSchema の `maxVal` 条件**: `if (maxVal !== undefined && maxMsg !== undefined)` で統一（falsy チェックは禁止。`0` が有効値となるケースに対応）。
- **zodSchema の `superRefine` 内条件**: `data.fixedPaymentAmount === undefined` で明示的に判定（`!data.fixedPaymentAmount` は `0` を誤判定するため禁止）。

## 5. 現在の状態と未解決事項（Pending）
- **現在の状態**: フェーズ5（リファクタリング・新機能実装）が完了し、ビルド（`tsc -b && vite build`）は正常通過。ただし、今回新規実装した `initialMonthlyPayment` に関するテストは未実施。
- **残タスク・未解決事項**:
  - **テストの策定・実施**: 下記セクション「テストシナリオ」に記載の網羅的テストを実施すること（最終フェーズ）。
  - **`monthlyPayment` の自動再計算（将来展望）**: 借入額・金利・期間の変更に連動して `monthlyPayment` を自動更新する `useEffect` の追加。UX判断（手動変更値の自動上書き可否）が必要。
  - **125%ルールの適用オン/オフ機能（将来展望）**: auじぶん銀行など一部ネット銀行の「新変動金利型」商品に対応するため、ルールの適用有無を切り替えるUIの追加。
  - **ボーナス返済への対応（将来展望）**: 年2回のボーナス払い併用ロジックは未実装。

## 6. テストシナリオ

以下は今回のセッションで実施した修正・新規実装を網羅的に検証するためのテストシナリオ。
dev サーバー（`npm run dev`）を起動し、ブラウザまたは Playwright でフォーム操作→計算結果を確認する。

### A. `initialMonthlyPayment` の基本動作

| # | テストケース | 手順 | 期待結果 |
|---|---|---|---|
| A-1 | 通常モード・monthlyPayment 未変更 | デフォルト値のまま「再計算する」ボタン押下 | 以前と完全に同じ計算結果（グラフ・テーブルの数値が一致）。`initialMonthlyPayment` = `calculatePayment()` の結果なので差異なし |
| A-2 | 通常モード・monthlyPayment を増額 | monthlyPayment を例えば 60,000円に変更して再計算 | 初期返済額が 60,000円で計算が実行される。元金充当が増え、返済期間が短縮（完済が早まる）。5年ルール・125%ルールは通常適用 |
| A-3 | 通常モード・monthlyPayment を減額 | monthlyPayment を例えば 30,000円に変更して再計算 | 初期返済額が 30,000円で計算が実行される。金利次第で利息が返済額を上回り未払利息が蓄積する可能性がある |
| A-4 | 固定モード有効時 | fixedPaymentEnabled をON、fixedPaymentAmount を 70,000円に設定して再計算 | `customMonthlyPayment = 70,000` が優先され、`initialMonthlyPayment` は無視される。5年ルールの見直しも無効化。既存の固定モードと同じ挙動 |
| A-5 | 固定モードOFF→ON→OFF | 固定モードを切り替えながら再計算 | OFF時は `initialMonthlyPayment` が使用され5年ルール通常適用。ON時は `customMonthlyPayment` が優先。状態の切り替えで不整合が発生しないこと |

### B. 条件変更時の monthlyPayment 非連動（既知の制約の確認）

| # | テストケース | 手順 | 期待結果 |
|---|---|---|---|
| B-1 | 借入額変更後に monthlyPayment 未修正 | 借入額を 1810万→3000万に変更、monthlyPayment は触らずに再計算 | 計算自体は正しく実行されるが、3000万に対して旧額（約48,614円）は不足 → 未払利息が蓄積する結果が表示される |
| B-2 | 借入額変更後に monthlyPayment を適切に修正 | 借入額を 3000万に変更、monthlyPayment も適切な額（例: 約80,000円）に修正して再計算 | 正常な返済シミュレーションが表示される |
| B-3 | UI注釈テキストの表示確認 | 月々の支払額フィールドの下部を確認 | 「※借入額や金利・期間を変更しても、この値は自動更新されません。条件変更後はこの値も合わせて修正してください。」がアンバー色で表示される |

### C. zodSchema の修正検証

| # | テストケース | 手順 | 期待結果 |
|---|---|---|---|
| C-1 | 固定モードON・固定額未入力 | fixedPaymentEnabled をON、fixedPaymentAmount を空欄のまま再計算 | 「固定モードが有効な場合、固定額を入力してください」エラーが表示される |
| C-2 | 固定モードOFF・固定額未入力 | fixedPaymentEnabled をOFF、fixedPaymentAmount を空欄 | エラーなし（superRefine の条件分岐で固定モードOFF時はスキップされる） |
| C-3 | 借入期間の範囲バリデーション | termYears に 0 または 51 を入力して再計算 | それぞれ「1以上を指定してください」「最大50年です」エラーが表示される |
| C-4 | monthlyPayment に 0 を入力 | monthlyPayment を 0 に変更して再計算 | 「1円以上を指定してください」エラーが表示される |

### D. リファクタリングの回帰テスト

| # | テストケース | 手順 | 期待結果 |
|---|---|---|---|
| D-1 | 夫のフォームリセット | 夫のフォームの「リセット」ボタン押下 | 夫のフォームのみが初期値に戻り、妻のフォームは変更されない。リセット後に自動再計算が走る |
| D-2 | 妻のフォームリセット | 妻のフォームの「リセット」ボタン押下 | 妻のフォームのみが初期値に戻り、夫のフォームは変更されない |
| D-3 | 金利変動シナリオの追加・削除 | シナリオを2つ追加→1つ削除→再計算 | 残った1つのシナリオが正しく計算に反映される |
| D-4 | ビルド通過 | `npm run build` を実行 | `tsc -b && vite build` がエラーなく完了 |

## 7. 次のAIへの初期プロンプト（依頼文）
> 「`tasks/loan-simulator/HANDOVER.md` を確認してください。フェーズ5（リファクタリング・新機能実装）が完了しています。まず HANDOVER.md のセクション6「テストシナリオ」に記載されたテストケース（A-1〜A-5, B-1〜B-3, C-1〜C-4, D-1〜D-4）を dev サーバーを起動して順次実施し、全ケースの結果を報告してください。」
