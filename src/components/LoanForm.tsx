// useForm: フォーム全体の状態管理（値の取得・バリデーション・送信処理）を提供するフック
import { useForm } from 'react-hook-form';

// zodResolver: Zod スキーマを RHF のバリデーションリゾルバーとして接続するアダプター（フォーム送信時に Zod スキーマによるバリデーションが自動実行される）
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * formSchema: フォーム全体の Zod バリデーションスキーマ（zodResolver に渡す）
 * FormValues: formSchema から推論されたフォーム全体の型（useForm のジェネリクスに指定）
 * PersonValues: personSchema から推論された個人（夫/妻）の入力値の型（toLoanConditions の引数型に使用）
 */
import { formSchema, type FormValues, type PersonValues } from '../schema/zodSchema';

import type { LoanConditions } from '../ts/modelInterfaces';
import { calculatePayment } from '../lib/utils';
import { PersonForm } from './PersonalLoanForm';

// LoanForm の Props 型定義
interface LoanFormProps {
  initialHusband: LoanConditions;   // 夫のローン初期条件（App.tsx の INITIAL_HUSBAND）
  initialWife: LoanConditions;      // 妻のローン初期条件（App.tsx の INITIAL_WIFE）
  initialStartDate: string;         // 借入開始年月の初期値（例: "2025-08"）
  // onCalculate: フォーム送信時に呼ばれるコールバック。変換済みの LoanConditions を親に渡し、親側で calculateLoan() → setMonthlyDetails() を実行してグラフ・テーブルを更新する
  onCalculate: (husband: LoanConditions, wife: LoanConditions, startDate: string) => void;
}

/**
 * ローンシミュレーション条件入力フォーム（メインコンポーネント）
 *【データフロー】
 * 1. App.tsx から initialHusband / initialWife を受け取り、defaultValues に変換
 * 2. ユーザーがフォーム入力・変更
 * 3. 「再計算する」ボタン押下 → handleSubmit → onSubmit → toLoanConditions で FormValues → LoanConditions に変換
 * 4. onCalculate コールバックで親に LoanConditions を渡す
 * 5. 親（App.tsx）が calculateLoan() を実行し、結果をグラフ・テーブルに反映
 */
export function LoanForm({
  initialHusband,
  initialWife,
  initialStartDate,
  onCalculate
}: LoanFormProps) {
  // LoanConditions.scenarios（計算エンジン用の形式）をフォーム用の形式に変換する
  const mapInitialScenarios = (scenarios: LoanConditions['scenarios']) => {
    // scenarios[0]（= 当初金利）は initialRate フィールドで別管理するため slice(1) で除外
    const mapped = scenarios.slice(1).map(s => ({
      // { monthOffset, interestRate } → { changeMonth, newRate } にプロパティ名を変換
      changeMonth: s.monthOffset,
      newRate: s.interestRate
    }));

    // デフォルト値は空配列
    return mapped.length > 0 ? mapped : [];
  };

  // RHF用のデフォルトフォーム値
  const defaultValues: FormValues = {
    startDate: initialStartDate,
    // 夫のローン
    husband: {
      // 円 → 万円（計算エンジン側は「円」単位だが、フォーム上は「万円」単位で入力するために / 10000 する）
      principal: initialHusband.principal / 10000,
      termYears: initialHusband.termYears,
      // 当初金利（scenarios の先頭要素）
      initialRate: initialHusband.scenarios[0].interestRate,
      // 月々の返済額[円]: calculatePayment(借入額[円], 年利[%], 返済回数[月])で元利均等返済の月額を自動算出して初期値とする
      monthlyPayment: calculatePayment(initialHusband.principal, initialHusband.scenarios[0].interestRate, initialHusband.termYears * 12),
      // customMonthlyPayment が設定されていれば true（`!!`で boolean 変換）
      // - customMonthlyPayment: fixedPaymentEnabled（固定モード： 繰り上げ返済シミュレーション）が true の場合のみ fixedPaymentAmount（固定支払額）を設定（これにより calculateLoan() 内で5年ルールの返済額見直しが無効化され、指定額で固定返済される）
      fixedPaymentEnabled: !!initialHusband.customMonthlyPayment,
      // customMonthlyPayment があればその値、なければ自動算出値をフォールバック
      fixedPaymentAmount: initialHusband.customMonthlyPayment || calculatePayment(initialHusband.principal, initialHusband.scenarios[0].interestRate, initialHusband.termYears * 12),
      scenarios: mapInitialScenarios(initialHusband.scenarios)
    },
    // 妻のローン
    wife: {
      principal: initialWife.principal / 10000,
      termYears: initialWife.termYears,
      initialRate: initialWife.scenarios[0].interestRate,
      monthlyPayment: calculatePayment(initialWife.principal, initialWife.scenarios[0].interestRate, initialWife.termYears * 12),
      fixedPaymentEnabled: !!initialWife.customMonthlyPayment,
      fixedPaymentAmount: initialWife.customMonthlyPayment || calculatePayment(initialWife.principal, initialWife.scenarios[0].interestRate, initialWife.termYears * 12),
      scenarios: mapInitialScenarios(initialWife.scenarios)
    }
  };

  const {
    control,        // useFieldArray に渡す制御オブジェクト
    register,       // 各 input を RHF に登録する関数
    handleSubmit,   // フォーム送信時のバリデーション＆コールバック実行を制御する関数
    setValue,       // プログラム的にフォームフィールドの値を設定する関数（resetPerson で使用）
    watch,          // フォーム値をリアクティブに監視する関数（fixedPaymentEnabled の状態監視に使用）
    formState: { errors }  // Zod バリデーションエラーオブジェクト（各フィールドのエラーメッセージを含む）
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema), // zod スキーマ（`../schema/zodSchema.ts`）をバリデーション処理に適用
    defaultValues
  });

  // 送信イベントハンドラー
  /**
    * フォーム入力値（PersonValues）を計算エンジン用の LoanConditions に変換する
    *
    * 【変換内容】
    * - principal: 万円 → 円（× 10000）
    * - customMonthlyPayment: fixedPaymentEnabled（固定モード： 繰り上げ返済シミュレーション）が true の場合のみ fixedPaymentAmount（固定支払額）を設定（これにより calculateLoan() 内で5年ルールの返済額見直しが無効化され、指定額で固定返済される）
    * - scenarios: 当初金利（initialRate）を先頭要素として追加し、ユーザーが追加した変動シナリオ（changeMonth → monthOffset, newRate → interestRate）を結合。changeMonth が 0 以下のシナリオは filter で除外（無効データの安全策）
  */
  const onSubmit = (data: FormValues) => {
    const toLoanConditions = (d: PersonValues): LoanConditions => ({
      principal: d.principal * 10000,     // 万円 → 円
      termYears: d.termYears,
      // 固定モードが明示的に有効な場合のみ customMonthlyPayment を送信
      customMonthlyPayment: d.fixedPaymentEnabled ? d.fixedPaymentAmount : undefined,
      scenarios: [
        // scenarios[0]: 当初金利（borrowing 開始月 = monthOffset: 1）
        { monthOffset: 1, interestRate: d.initialRate },
        // scenarios[1+]: ユーザーが追加した金利変動シナリオ
        ...d.scenarios
          // 変動発生月が1以上のものだけを反映する
          .filter(s => Number(s.changeMonth) > 0)
          // { changeMonth, newRate } → { monthOffset, interestRate } にプロパティ名を変換
          .map(s => ({ monthOffset: s.changeMonth, interestRate: s.newRate }))
      ]
    });

    // 変換した LoanConditions を親コンポーネントのコールバックに渡す
    onCalculate(toLoanConditions(data.husband), toLoanConditions(data.wife), data.startDate);
  };

  /**
   * 個人フォームを初期値にリセットする関数
   *
   *【意図】
   * RHF の reset() ではなく setValue() を個別に呼んでいる理由:
   * reset() はフォーム全体をリセットするため、夫のリセット時に妻のフォームも初期化されてしまうが、setValue() なら prefix で指定した個人のフィールドのみを更新できる。
   */
  const resetPerson = (prefix: "husband" | "wife", defaults: LoanConditions) => {
    setValue(`${prefix}.principal`, defaults.principal / 10000);                       // 円 → 万円
    setValue(`${prefix}.termYears`, defaults.termYears);
    setValue(`${prefix}.initialRate`, defaults.scenarios[0].interestRate);             // 当初金利
    // 月々の支払額を元利均等返済の計算値にリセット
    setValue(`${prefix}.monthlyPayment`, calculatePayment(defaults.principal, defaults.scenarios[0].interestRate, defaults.termYears * 12));
    setValue(`${prefix}.fixedPaymentEnabled`, false);                                 // 固定モード解除
    // 固定額も計算値にリセット（次回固定モード有効化時のデフォルト値として機能）
    setValue(`${prefix}.fixedPaymentAmount`, calculatePayment(defaults.principal, defaults.scenarios[0].interestRate, defaults.termYears * 12));
    setValue(`${prefix}.scenarios`, mapInitialScenarios(defaults.scenarios));          // 金利変動シナリオを初期値に

    // リセット直後に現在のフォーム全体の値を使って再計算を走らせる
    // handleSubmit(onSubmit) は「バリデーション → onSubmit 実行」を返す関数で「末尾の () で即時実行関数」にしている
    handleSubmit(onSubmit)();
  };

  return (
    // handleSubmit(onSubmit): form の onSubmit イベントで Zod バリデーション → onSubmit コールバックを実行
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative">
      <h2 className="text-xl font-bold text-slate-800 mb-6">シミュレーション条件入力</h2>
      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <label className="block text-sm font-bold text-gray-700 mb-2">借入開始年月</label>
        <div className="max-w-xs">
          <input
            type="month" // 年月選択UI（YYYY-MM形式）
            className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors.startDate ? 'border-red-500' : 'border-gray-300'}`}
            // 借入開始年月は PaymentHistory.tsx で「直近12ヶ月」ブロックの基準日として使用される
            {...register('startDate')}
          />
          {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
        </div>
        <p className="text-xs text-gray-500 mt-2">※現在日時と比較し、直近1年間を月別明細で表示するための基準となります。</p>
      </div>
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <PersonForm
          label="夫のローン" prefix="husband" defaults={initialHusband}
          control={control} register={register} watch={watch} errors={errors} resetPerson={resetPerson}
        />
        <PersonForm
          label="妻のローン" prefix="wife" defaults={initialWife}
          control={control} register={register} watch={watch} errors={errors} resetPerson={resetPerson}
        />
      </div>
      <div className="text-center">
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-12 rounded-full shadow-md transition-colors"
        >
          この条件で再計算する
        </button>
      </div>
    </form>
  );
}
