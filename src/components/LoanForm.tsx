import { useForm, useFieldArray } from 'react-hook-form';
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import type { LoanConditions } from '../lib/loanCalculator';
import { TooltipIcon } from './TooltipIcon';

// NaN対応と共通エラーメッセージを持つカスタムナンバーバリデーション
const customNumber = (minVal: number, minMsg: string, maxVal?: number, maxMsg?: string) => {
  let schema = z.number({
    error: "無効な値です。数値を入力してください"
  })
    .refine(val => !Number.isNaN(val), { message: "無効な値です。数値を入力してください" })
    .refine(val => val >= minVal, { message: minMsg });

  if (maxVal !== undefined && maxMsg !== undefined) {
    schema = schema.refine(val => val <= maxVal, { message: maxMsg });
  }
  return schema;
};

const scenarioSchema = z.object({
  changeMonth: customNumber(2, "2ヶ月目以降を指定してください"),
  newRate: customNumber(0, "0以上を指定してください")
});

const personSchema = z.object({
  principal: customNumber(0, "0以上を指定してください"),
  termYears: customNumber(1, "1以上を指定してください", 50, "最大50年です"),
  initialRate: customNumber(0, "0以上を指定してください"),
  scenarios: z.array(scenarioSchema)
});

const formSchema = z.object({
  husband: personSchema,
  wife: personSchema
});

type FormValues = z.infer<typeof formSchema>;

interface PersonFormProps {
  label: string;
  prefix: "husband" | "wife";
  defaults: LoanConditions;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  resetPerson: (prefix: "husband" | "wife", defaults: LoanConditions) => void;
}

function PersonForm({ label, prefix, defaults, control, register, errors, resetPerson }: PersonFormProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${prefix}.scenarios`
  });

  const personErrors = errors[prefix];

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
            step="any"
            className={`w-full rounded-lg border p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${personErrors?.principal ? 'border-red-500' : 'border-gray-300'}`}
            {...register(`${prefix}.principal`, { valueAsNumber: true })}
          />
          {personErrors?.principal && <p className="text-red-500 text-xs mt-1">{personErrors.principal.message}</p>}
        </div>
        <div>
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
            step="0.001"
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

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="relative p-3 bg-white border border-gray-200 rounded-lg shadow-sm group">
                <div className="grid grid-cols-2 gap-4">
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
                {/* 削除ボタン */}
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

interface LoanFormProps {
  initialHusband: LoanConditions;
  initialWife: LoanConditions;
  onCalculate: (husband: LoanConditions, wife: LoanConditions) => void;
}

export function LoanForm({ initialHusband, initialWife, onCalculate }: LoanFormProps) {
  const mapInitialScenarios = (scenarios: LoanConditions['scenarios']) => {
    const mapped = scenarios.slice(1).map(s => ({
      changeMonth: s.monthOffset,
      newRate: s.interestRate
    }));
    return mapped.length > 0 ? mapped : [];
  };

  const defaultValues: FormValues = {
    husband: {
      principal: initialHusband.principal / 10000,
      termYears: initialHusband.termYears,
      initialRate: initialHusband.scenarios[0].interestRate,
      scenarios: mapInitialScenarios(initialHusband.scenarios)
    },
    wife: {
      principal: initialWife.principal / 10000,
      termYears: initialWife.termYears,
      initialRate: initialWife.scenarios[0].interestRate,
      scenarios: mapInitialScenarios(initialWife.scenarios)
    }
  };

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues
  });

  const onSubmit = (data: FormValues) => {
    const toLoanConditions = (d: z.infer<typeof personSchema>): LoanConditions => ({
      principal: d.principal * 10000,
      termYears: d.termYears,
      scenarios: [
        { monthOffset: 1, interestRate: d.initialRate },
        ...d.scenarios
          // 変動発生月が1以上のものだけを反映する
          .filter(s => Number(s.changeMonth) > 0)
          .map(s => ({ monthOffset: s.changeMonth, interestRate: s.newRate }))
      ]
    });

    onCalculate(toLoanConditions(data.husband), toLoanConditions(data.wife));
  };

  const resetPerson = (prefix: "husband" | "wife", defaults: LoanConditions) => {
    setValue(`${prefix}.principal`, defaults.principal / 10000);
    setValue(`${prefix}.termYears`, defaults.termYears);
    setValue(`${prefix}.initialRate`, defaults.scenarios[0].interestRate);
    setValue(`${prefix}.scenarios`, mapInitialScenarios(defaults.scenarios));

    // リセット直後に現在のフォーム全体の値を使って再計算を走らせる
    handleSubmit(onSubmit)();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative">
      <h2 className="text-xl font-bold text-slate-800 mb-6">シミュレーション条件入力</h2>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <PersonForm
          label="夫のローン" prefix="husband" defaults={initialHusband}
          control={control} register={register} errors={errors} resetPerson={resetPerson}
        />
        <PersonForm
          label="妻のローン" prefix="wife" defaults={initialWife}
          control={control} register={register} errors={errors} resetPerson={resetPerson}
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
