import { z } from 'zod';

/**
 * NaN対応と共通エラーメッセージを持つカスタムナンバーバリデーション関数
 *
 * @param minVal - 最小許容値
 * @param minMsg - 最小値違反時のエラーメッセージ
 * @param maxVal - 最大許容値（省略可）
 * @param maxMsg - 最大値違反時のエラーメッセージ（省略可）
 */
const customNumber = (
  minVal: number,
  minMsg: string,
  maxVal?: number,
  maxMsg?: string
) => {
  // z.number() 単体では NaN が通過する場合があるため、
  // refine で NaN チェック・最小値・最大値のバリデーションを追加する
  let schema = z.number({
    error: "無効な値です。数値を入力してください"
  })
    .refine(val => !Number.isNaN(val), { message: "無効な値です。数値を入力してください" })
    .refine(val => val >= minVal, { message: minMsg });

  // 最大許容値と最大値違反時のエラーメッセージがあれば、それらも追加した形で schema を返す
  if (maxVal !== undefined && maxMsg !== undefined) {
    // 最小関連（`minVal`, minMsg）に加えて、最大関連（`maxVal`, maxMsg）も追加
    schema = schema.refine(val => val <= maxVal, { message: maxMsg });
  }

  return schema;
};

/**
 * 金利変動シナリオのバリデーションスキーマ
 * - changeMonth: 変動発生月（借入開始からの経過月数。2ヶ月目以降を指定）
 * - newRate: 変動後の適用金利（%）
 */
const scenarioSchema = z.object({
  changeMonth: customNumber(2, "2ヶ月目以降を指定してください"),
  newRate: customNumber(0, "0以上を指定してください")
});

/**
 * 個人（夫または妻）のローン条件バリデーションスキーマ
 *
 * superRefine で固定モード有効時の fixedPaymentAmount 必須チェックを追加。
 * fixedPaymentEnabled が true の場合、fixedPaymentAmount が未入力・NaN・1未満であればエラーとする。
 */
const personSchema = z.object({
  principal: customNumber(0, "0以上を指定してください"),
  termYears: customNumber(1, "1以上を指定してください", 50, "最大50年です"),
  initialRate: customNumber(0, "0以上を指定してください"),
  monthlyPayment: customNumber(1, "1円以上を指定してください"),
  fixedPaymentEnabled: z.boolean(),
  fixedPaymentAmount: z.union([
    customNumber(1, "1円以上を指定してください"),
    // z.nan(): NaN を「許容」するための定義（customNumber 内の refine による NaN「拒否」とは逆の用途）。
    // 固定モード OFF 時に空欄の input が valueAsNumber: true で返す NaN をスキーマ段階で通過させ、
    // 実際の必須チェックは superRefine で fixedPaymentEnabled の状態を見て行う設計。
    z.nan(),
    z.undefined() // undefined であるかどうか
  ]).optional(),  // optional: undefined であれば optional=true として扱う
  scenarios: z.array(scenarioSchema)
})
  .superRefine((data, ctx) => {
    // 固定モードが有効な場合、固定額は必須
    if (data.fixedPaymentEnabled) {
      if (data.fixedPaymentAmount === undefined || Number.isNaN(data.fixedPaymentAmount)) {
        ctx.addIssue({
          code: "custom",
          message: "固定モードが有効な場合、固定額を入力してください",
          path: ["fixedPaymentAmount"],
        });
      } else if (data.fixedPaymentAmount < 1) {
        ctx.addIssue({
          code: "custom",
          message: "1円以上を指定してください",
          path: ["fixedPaymentAmount"],
        });
      }
    }
  });

/**
 * フォーム全体のバリデーションスキーマ
 * - startDate: 借入開始年月（YYYY-MM形式）
 * - husband: 夫のローン条件（`personSchema`）
 * - wife: 妻のローン条件（`personSchema`）
 */
export const formSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}$/, "無効な年月です"),
  husband: personSchema,
  wife: personSchema
});

/* フォーム全体の型定義（`formSchema`から推論） */
export type FormValues = z.infer<typeof formSchema>;

/* 個人（夫または妻）のフォーム入力値の型定義（`personSchema`から推論） */
export type PersonValues = z.infer<typeof personSchema>;
