// useFieldArray: 動的な配列フィールド（金利変動シナリオの追加・削除）を管理するフック
import { useFieldArray } from 'react-hook-form';

/**
 * Control: useFieldArray に渡すフォーム制御オブジェクトの型
 * UseFormRegister: 各 input を RHF に登録する register 関数の型
 * UseFormWatch: フォーム値のリアクティブな監視を行う watch 関数の型
 * FieldErrors: バリデーションエラーオブジェクトの型
 */
import type { Control, UseFormRegister, UseFormWatch, FieldErrors } from 'react-hook-form';

// FormValues: formSchema から推論されたフォーム全体の型（useForm のジェネリクスに指定）
import { type FormValues } from '../schema/zodSchema';

import { Plus, Trash2 } from 'lucide-react';
import type { LoanConditions } from '../ts/modelInterfaces';
import { TooltipIcon } from './TooltipIcon';

// PersonForm の Props 型定義
interface PersonFormProps {
    label: string;                          // フォームセクションの見出し（例: "夫のローン"）
    prefix: "husband" | "wife";             // RHF のフィールドパスプレフィックス（例: "husband.principal"）
    defaults: LoanConditions;               // リセット時に復元する初期値（App.tsx の INITIAL_HUSBAND / INITIAL_WIFE）
    control: Control<FormValues>;           // useFieldArray に渡す RHF の制御オブジェクト
    register: UseFormRegister<FormValues>;  // input 要素を RHF に登録する関数
    watch: UseFormWatch<FormValues>;        // フォーム値をリアクティブに監視する関数
    errors: FieldErrors<FormValues>;        // Zod バリデーションによるエラーオブジェクト
    resetPerson: (prefix: "husband" | "wife", defaults: LoanConditions) => void;                                   // 個人フォームを初期値にリセットする関数
}

/**
 * PersonForm 
 * 夫・妻それぞれのローン入力フォームを描画する子コンポーネント。
 * 親コンポーネント（LoanForm）から RHF の各種関数とフォーム状態を受け取り、
 * prefix（"husband" | "wife"）を使ってフォームフィールドのパスを動的に構築する。
 */
export function PersonForm({ label, prefix, defaults, control, register, watch, errors, resetPerson }: PersonFormProps) {
    // useFieldArray: 金利変動シナリオの動的配列を管理
    const {
        fields, // fields: 現在のシナリオ配列（各要素に RHF が付与した一意の id を持つ）
        append, // append: 配列末尾に新しいシナリオを追加（デフォルト値: 6ヶ月目, 1.05%） 
        remove  // remove: 指定インデックスのシナリオを削除
    } = useFieldArray({
        control,
        name: `${prefix}.scenarios`  // 例: "husband.scenarios" → FormValues.husband.scenarios に対応
    });

    // errors オブジェクトから当該個人（prefix）のエラーを抽出
    // → personErrors?.principal のようにドット記法で各フィールドのエラーにアクセスする
    //
    // 【補足】errors は FieldErrors<FormValues> 型で、FormValues の構造をミラーしたネストしたエラーオブジェクト。
    // errors["husband"] / errors["wife"] とブラケット記法でアクセスすると、
    // personSchema の各フィールド（principal, termYears 等）のエラーメッセージを個別に取得できる。
    // RHF が FormValues の型構造から自動的にネストしたエラー型を構築するため、zodSchema 側に特別なキー定義は不要。
    const personErrors = errors[prefix];

    // fixedPaymentEnabled の現在値をリアクティブに監視
    // → チェック状態に応じて夫婦それぞれ（prefix： "husband" または "wife"）の固定額入力フィールドの表示/非表示を切り替える
    const isFixedEnabled = watch(`${prefix}.fixedPaymentEnabled`);

    return (
        <div className="flex-1 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">{label}</h3>
                <button
                    type="button"
                    onClick={() => resetPerson(prefix, defaults)}
                    className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors border border-gray-300 hover:border-blue-600 rounded px-2 py-1 bg-white"
                >
                    リセット
                </button>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">借入額 (万円)</label>
                    <input
                        type="number"
                        step="any"  // 小数点の入力を許可（例: 1810.5万円 = 18,105,000円）
                        className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${personErrors?.principal ? 'border-red-500' : 'border-gray-300'}`}
                        {...register(`${prefix}.principal`, {
                            // valueAsNumber: true: フォーム値を文字列ではなく number 型で管理
                            valueAsNumber: true
                        })}
                    />
                    {/* Zod バリデーションエラーがあればエラーメッセージを表示 */}
                    {personErrors?.principal && <p className="text-red-500 text-xs mt-1">{personErrors.principal.message}</p>}
                </div>

                {/* ---- 月々の支払額（円）入力フィールド ----
        ※現状、この値はフォーム送信時の toLoanConditions() では使用されておらず、計算エンジン側で借入額・金利・期間から再計算される。
        将来的にユーザー指定の返済額を計算に反映させる場合は toLoanConditions() の修正が必要。
        ---- 初期にはテーブルやグラフは描画されていなくとも良いので、ユーザー入力値を計算に反映させたい
        */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">月々の支払額 (円)</label>
                    {/* 初期値は defaultValues で calculatePayment() により自動算出されるが、ユーザーが任意の金額に変更可能 */}
                    <input
                        type="number"
                        className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${personErrors?.monthlyPayment ? 'border-red-500' : 'border-gray-300'}`}
                        {...register(`${prefix}.monthlyPayment`, { valueAsNumber: true })}
                    />
                    {personErrors?.monthlyPayment && <p className="text-red-500 text-xs mt-1">{personErrors.monthlyPayment.message}</p>}
                    <p className="text-xs text-gray-500 mt-1">借入額・金利・期間から自動計算された初期値が設定されています。任意の金額に変更可能です。5年ルール・125%ルールが適用されます。</p>
                </div>

                {/* ---- 固定モード（繰り上げ返済シミュレーション）----
                    fixedPaymentEnabled (boolean) のチェック状態に応じて:
                    - OFF（デフォルト）: 通常の5年ルール・125%ルールに基づく返済額見直しが適用される
                    - ON: 5年ごとの見直しを無効化し、fixedPaymentAmount で指定した固定額で毎月返済するシミュレーション
                    → 通常より多い額を固定すると「繰り上げ返済」の効果（返済期間短縮・利息削減）を確認できる

                    isFixedEnabled の状態に応じて背景色・枠線色を動的に切り替え
                */}
                <div className={`p-3 rounded-lg border transition-colors ${isFixedEnabled ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
                    }`}>
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="mt-1 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            {...register(`${prefix}.fixedPaymentEnabled`)}
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-700">支払額を固定する（繰り上げ返済シミュレーション）</span>
                            <p className="text-xs text-gray-500 mt-1">チェックを入れると、5年ごとの返済額見直し（5年ルール）を適用せず、指定した金額で固定して返済した場合のシミュレーションを行います。通常より多い額を設定すると、繰り上げ返済の効果を確認できます。</p>
                        </div>
                    </label>
                    {/* 固定モード有効時のみ固定額入力フィールドを表示（条件付きレンダリング） */}
                    {isFixedEnabled &&
                        <div className="mt-3 ml-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">固定額 (円)</label>
                            <input
                                type="number"
                                className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-amber-500 focus:outline-none ${personErrors?.fixedPaymentAmount ? 'border-red-500' : 'border-gray-300'}`}
                                {...register(`${prefix}.fixedPaymentAmount`, { valueAsNumber: true })}
                            />
                            {/* fixedPaymentAmount のバリデーションは zodSchema の superRefine で実施（fixedPaymentEnabled が true の場合のみ必須チェックが走る）*/}
                            {personErrors?.fixedPaymentAmount && <p className="text-red-500 text-xs mt-1">{personErrors.fixedPaymentAmount.message}</p>}
                        </div>
                    }
                </div>

                <div>
                    {/* Zod スキーマで 1〜50年 の範囲バリデーションを設定済み */}
                    <label className="block text-sm font-medium text-gray-700 mb-1">借入期間 (年)</label>
                    <input
                        type="number"
                        className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${personErrors?.termYears ? 'border-red-500' : 'border-gray-300'}`}
                        {...register(`${prefix}.termYears`, { valueAsNumber: true })}
                    />
                    {personErrors?.termYears && <p className="text-red-500 text-xs mt-1">{personErrors.termYears.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">当初金利 (%)</label>
                    <input
                        type="number"
                        step="0.001" // 0.001% 単位の入力を許可（例: 0.625%）
                        className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${personErrors?.initialRate ? 'border-red-500' : 'border-gray-300'}`}
                        {...register(`${prefix}.initialRate`, { valueAsNumber: true })}
                    />
                    {personErrors?.initialRate && <p className="text-red-500 text-xs mt-1">{personErrors.initialRate.message}</p>}
                </div>

                <div className="pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap mb-3">
                        <p className="font-semibold text-gray-800 text-sm">金利変動シナリオ</p>
                        <TooltipIcon text="将来の段階的な金利上昇リスクをリアルにシミュレーションするため、複数回の変動予定を組み合わせて追加できます。" />
                        <p className="w-full text-xs leading-[1.8em] text-gray-600 mt-2 p-2 bg-lime-50/50 rounded-lg border border-lime-100">借入開始からの経過月数で追加していきます。例: 借入開始が2025年8月の場合は初期値が「1→2025年8月」です。その後、変動があった経過月を指定します。半年後に変動があれば「6→2026年1月」、一年後に変動があれば「12→2026年7月」です。</p>
                    </div>

                    {/* シナリオ一覧: fields 配列をイテレーションして各シナリオの入力行を描画 */}
                    {/* 各シナリオは { changeMonth: number, newRate: number } の形式で、toLoanConditions() 内で { monthOffset, interestRate } に変換されて計算エンジンに渡される。 */}
                    <div className="space-y-3">
                        {fields.map((field, index) => (
                            // group クラス: ホバー時に削除ボタンを表示するための CSS グルーピング
                            <div key={field.id} className="relative p-3 bg-white border border-gray-200 rounded-lg shadow-sm group">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* 変動発生月: 借入開始からの経過月数で指定（Zod スキーマで2ヶ月目以降に制限） */}
                                    <div>
                                        <label className="flex items-center text-xs text-gray-600 mb-1">
                                            変動発生月
                                            {index === 0 && <TooltipIcon text="借入開始からの経過月数で指定します。例: 借入開始が2025年8月の場合、1→2025年8月、6→2026年1月、12→2026年7月になります。既存シナリオは保持され、後から追加したシナリオはその月以降に適用されます。" />}
                                        </label>
                                        <div className="flex items-center">
                                            <input
                                                type="number"
                                                className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${personErrors?.scenarios?.[index]?.changeMonth ? 'border-red-500' : 'border-gray-300'}`}
                                                {...register(`${prefix}.scenarios.${index}.changeMonth`, { valueAsNumber: true })}
                                            />
                                            <span className="ml-2 text-sm text-gray-500">ヶ月</span>
                                        </div>
                                        {/* オプショナルチェーン（?.）で配列インデックスの存在を安全に確認してからエラー表示 */}
                                        {personErrors?.scenarios?.[index]?.changeMonth && <p className="text-red-500 text-xs mt-1">{personErrors.scenarios[index]?.changeMonth?.message}</p>}
                                    </div>

                                    <div>
                                        <label className="flex items-center text-xs text-gray-600 mb-1">
                                            変動後金利
                                            {index === 0 && <TooltipIcon text="変動発生月に変更された後の新しい金利を指定します。" />}
                                        </label>
                                        <div className="flex items-center">
                                            <input
                                                type="number"
                                                step="0.001"
                                                className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${personErrors?.scenarios?.[index]?.newRate ? 'border-red-500' : 'border-gray-300'}`}
                                                {...register(`${prefix}.scenarios.${index}.newRate`, { valueAsNumber: true })}
                                            />
                                            <span className="ml-2 text-sm text-gray-500">%</span>
                                        </div>
                                        {personErrors?.scenarios?.[index]?.newRate && <p className="text-red-500 text-xs mt-1">{personErrors.scenarios[index]?.newRate?.message}</p>}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    title="このシナリオを削除"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* シナリオ追加ボタン: append() で配列末尾に新しいシナリオ行を追加
                    デフォルト値は { changeMonth: 6, newRate: 1.05 }（6ヶ月後に金利1.05%）*/}
                    <button
                        type="button"
                        onClick={() => append({ changeMonth: 6, newRate: 1.05 })}
                        className="mt-3 w-full flex items-center justify-center py-2 px-4 border border-dashed border-gray-300 rounded-lg text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors"
                    >
                        <Plus size={16} className="mr-1" />
                        金利変動シナリオを追加
                    </button>
                </div>
            </div>
        </div>
    );
}
