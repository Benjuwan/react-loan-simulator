import type { MonthlyDetail } from "../ts/modelInterfaces";

// 支払い履歴の型定義
export interface PaymentHistoryProps {
    data: MonthlyDetail[];  // 月別支払い全期間データの配列
    startDate?: string;     // 借入開始年月（例: "2025-08"）。これを基準に現在の月が借入開始から何ヶ月目かを計算する
    isMerged?: boolean;     // 世帯合算表示かどうか
}

export type HistoryBlock = {
    type: 'chunk';          // 過去・未来の期間を5年(60ヶ月)単位でブロック化（一まとめに）したもの
    label: string;          // ブロックのラベル（例: "1年目〜5年目"）
    startYear: number;      // ブロックの開始年（例: 1）
    endYear: number;        // ブロックの終了年（例: 5）
    items: MonthlyDetail[]  // ブロックに含まれる月別支払い全期間データ
} |
{
    type: 'recent';         // 直近12ヶ月を示す特別なブロック
    label: string;          // ブロックのラベル（例: "直近12ヶ月"）
    items: MonthlyDetail[]  // 直近12ヶ月の月別支払い全期間データ
};

/* ------- ここまで型定義で、以下からフック ------- */

export const usePaymentHistoryHooks = () => {
    // 月別支払い全期間データの配列から、期間ごとの平均支払額や期間末残高などの要約情報を計算する関数
    function calculateSummary(items: MonthlyDetail[]): {
        avgPayment: number;       // 期間内の月々の平均支払額
        avgInterestRate: number;  // 期間内の平均金利
        avgPrincipal: number;     // 期間内の月々の平均元金充当分
        avgInterest: number;      // 期間内の月々の平均利息充当分
        endBalance: number;       // 期間末元金残高
    } | null {
        const allPaymentTerm = items.length;

        // 支払い残り期間が無い場合は要約情報を計算できないためnullを返す
        if (allPaymentTerm === 0) {
            return null;
        }

        // 各データの集計処理を支払い期間で除算し、各データの平均値を算出する
        const avgPayment = items.reduce((s, i) => s + i.paymentAmount, 0) / allPaymentTerm;
        const avgInterestRate = items.reduce((s, i) => s + i.interestRate, 0) / allPaymentTerm;
        const avgPrincipal = items.reduce((s, i) => s + i.principalPayment, 0) / allPaymentTerm;
        const avgInterest = items.reduce((s, i) => s + i.interestPayment, 0) / allPaymentTerm;

        // 期間末残高は、期間内の最終月の元金残高を参照する
        const endBalance = items[allPaymentTerm - 1].principalBalance;

        return { avgPayment, avgInterestRate, avgPrincipal, avgInterest, endBalance };
    }

    // 月別支払い全期間データの配列を、5年(60ヶ月)単位でブロック化する関数
    function createChunks(items: MonthlyDetail[]): HistoryBlock[] {
        // 5年(60ヶ月)単位で月別支払い全期間データをブロック化するためのマップを作成する
        // `periodIndex`（グループキー）ごとの`MonthlyDetail[]`を管理するために、大量のデータの追加/削除が頻繁な場合に優れていて、任意の型をキーとして使用可能な Map を使用
        const chunksMap = new Map<number, MonthlyDetail[]>();

        // 5年(60ヶ月)単位でブロック化
        for (const d of items) {
            // d.month は 1始まりなので 0基準にしてから60で割り、
            // 小数を切り捨てて5年(60ヶ月)ごとの【グループキー（「どの5年区間に属するか」を表す識別子）】を得る
            /**
             * グループキー例：
             * - 0 = 1〜60ヶ月目のブロック
             * - 1 = 61〜120ヶ月目のブロック
             * - 2 = 121〜180ヶ月目のブロック
             */
            const periodIndex: number = Math.floor((d.month - 1) / 60);

            // `periodIndex`（グループキー）に対応する MonthlyDetail[] を取得
            const periodItems: MonthlyDetail[] | undefined = chunksMap.get(periodIndex);
            if (periodItems) {
                // 取得した配列に現在の月データを追加
                periodItems.push(d);
            } else {
                // `MonthlyDetail[]`配列が無かった場合、
                // 現在の月データを持ったグループキーを新規作成（初期化）
                chunksMap.set(periodIndex, [d]);
            }
        }

        // 5年区切りにした月別詳細データ情報をまとめるための、支払い履歴管理用の配列
        const newHistoryBlocks: HistoryBlock[] = [];

        // 「5年(60ヶ月)単位で月別支払い全期間データをブロック化したマップオブジェクト」を配列化してソート処理し、
        // 各グループキーごとの月別支払詳細データ（periodItems）をベースにループ処理を実施
        // ※`_`を使っている意図： lint エラーが出るが「Mapインデックスは意図的に使用しない」ことを明示するため
        Array.from(chunksMap.entries()).sort(([a], [b]) => a - b).forEach(([_, periodItems]) => {
            // グループに含まれる最初の月データから開始年を計算（例：1年目）
            const startY = Math.floor((periodItems[0].month - 1) / 12) + 1;
            // グループに含まれる最後の月データから終了年を計算（例：5年目）
            const endY = Math.floor((periodItems[periodItems.length - 1].month - 1) / 12) + 1;

            // 区切り期間の表示ラベル： 1年で収まる場合は "1年目"、またぐ場合は "1年目〜5年目"
            const label = startY === endY ? `${startY}年目` : `${startY}年目 〜 ${endY}年目`;

            const newHistoryBlock: HistoryBlock = {
                type: 'chunk',
                label: label,
                startYear: startY,
                endYear: endY,
                items: periodItems
            }

            newHistoryBlocks.push(newHistoryBlock);
        });

        // 5年区切りにしてソート済みの HistoryBlock 配列を返す
        return newHistoryBlocks;
    };

    return { calculateSummary, createChunks }
}
