import { useMemo } from 'react';
import type { MonthlyDetail } from '../lib/loanCalculator';
import { formatCurrency } from '../lib/utils';
import { ChevronDown } from 'lucide-react';

interface PaymentHistoryProps {
  data: MonthlyDetail[];
  startDate?: string;
  isMerged?: boolean;
}

type HistoryBlock = 
  | { type: 'chunk'; label: string; startYear: number; endYear: number; items: MonthlyDetail[] }
  | { type: 'recent'; label: string; items: MonthlyDetail[] };

function DetailTable({ items, isMerged = false }: { items: MonthlyDetail[]; isMerged?: boolean }) {
  return (
    <table className="min-w-full text-sm text-left text-gray-600">
      <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-4 py-2">適用期間</th>
          <th className="px-4 py-2 text-right">金利</th>
          <th className="px-4 py-2 text-right">月々の支払額</th>
          <th className="px-4 py-2 text-right text-gray-500">内: 元金分</th>
          <th className="px-4 py-2 text-right text-gray-500">内: 利息分</th>
          <th className="px-4 py-2 text-right">月末残高</th>
        </tr>
      </thead>
      <tbody>
        {items.map((d) => (
          <tr key={`month-${d.month}`} className="border-b bg-white hover:bg-gray-50">
            <td className="px-4 py-2 font-medium text-gray-800">
              {Math.floor((d.month - 1) / 12) + 1}年目 {((d.month - 1) % 12) + 1}ヶ月目
            </td>
            <td className="px-4 py-2 text-right">
              {isMerged ? <span className="text-gray-400">-</span> : `${d.interestRate.toFixed(3)}%`}
            </td>
            <td className="px-4 py-2 text-right font-bold text-blue-600">{formatCurrency(d.paymentAmount)}</td>
            <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(d.principalPayment)}</td>
            <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(d.interestPayment)}</td>
            <td className="px-4 py-2 text-right font-medium">{formatCurrency(d.principalBalance)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function calculateSummary(items: MonthlyDetail[]) {
  const len = items.length;
  if (len === 0) return null;
  const avgPayment = items.reduce((s, i) => s + i.paymentAmount, 0) / len;
  const avgInterestRate = items.reduce((s, i) => s + i.interestRate, 0) / len;
  const avgPrincipal = items.reduce((s, i) => s + i.principalPayment, 0) / len;
  const avgInterest = items.reduce((s, i) => s + i.interestPayment, 0) / len;
  const endBalance = items[len - 1].principalBalance;
  
  return { avgPayment, avgInterestRate, avgPrincipal, avgInterest, endBalance };
}

export function PaymentHistory({ data, startDate = "2025-08", isMerged = false }: PaymentHistoryProps) {
  const blocks = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 現在の月が借入開始から何ヶ月目かを計算
    const [startYearStr, startMonthStr] = startDate.split('-');
    const startYear = parseInt(startYearStr, 10);
    const startMonth = parseInt(startMonthStr, 10);
    
    const now = new Date();
    // 借入開始から現在までの経過月数 (未来の借入なら1からスタート)
    const rawOffset = (now.getFullYear() - startYear) * 12 + (now.getMonth() + 1 - startMonth) + 1;
    const offsetMonth = Math.max(1, rawOffset);

    // 全期間を3つに分割 (過去, 直近12ヶ月, 未来)
    const past = data.filter(d => d.month < offsetMonth);
    const recent = data.filter(d => d.month >= offsetMonth && d.month < offsetMonth + 12);
    const future = data.filter(d => d.month >= offsetMonth + 12);

    const createChunks = (items: MonthlyDetail[]): HistoryBlock[] => {
      const chunksMap = new Map<number, MonthlyDetail[]>();
      for (const d of items) {
        // 5年(60ヶ月)単位でブロック化
        const periodIndex = Math.floor((d.month - 1) / 60);
        if (!chunksMap.has(periodIndex)) chunksMap.set(periodIndex, []);
        chunksMap.get(periodIndex)!.push(d);
      }
      
      const newBlocks: HistoryBlock[] = [];
      Array.from(chunksMap.entries()).sort(([a], [b]) => a - b).forEach(([, periodItems]) => {
        const startY = Math.floor((periodItems[0].month - 1) / 12) + 1;
        const endY = Math.floor((periodItems[periodItems.length - 1].month - 1) / 12) + 1;
        // 単純な表記最適化。1年で収まる場合は "1年目"、またぐ場合は "1年目〜5年目"
        const label = startY === endY ? `${startY}年目` : `${startY}年目 〜 ${endY}年目`;
        newBlocks.push({ type: 'chunk', label, startYear: startY, endYear: endY, items: periodItems });
      });
      return newBlocks;
    };

    const combined: HistoryBlock[] = [
      ...createChunks(past),
      { type: 'recent', label: '現在（直近12ヶ月）の詳細', items: recent },
      ...createChunks(future)
    ];

    return combined.filter(b => b.items.length > 0);
  }, [data, startDate]);

  if (blocks.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">借入開始からの月額内訳・残高推移</h3>
      </div>
      {isMerged && (
        <div className="mb-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-600">
            <span className="font-semibold text-blue-700">合算表示の金利について: </span>
            世帯合算では夫婦それぞれの借入に異なる金利が適用される可能性があるため、金利欄は「-」と表示しています。正確な金利は「夫のみ」「妻のみ」タブで個別にご確認ください。
          </p>
        </div>
      )}
      <div className="space-y-4">
        {blocks.map((block, idx) => {
          if (block.type === 'recent') {
            return (
              <div key={`recent-${idx}`} className="border border-blue-200 rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-blue-100">
                <div className="bg-blue-50 px-4 py-3 font-bold text-blue-800 border-b border-blue-100 flex items-center">
                  <span className="relative flex h-3 w-3 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                  {block.label}
                </div>
                <div className="overflow-x-auto">
                  <DetailTable items={block.items} isMerged={isMerged} />
                </div>
              </div>
            );
          } else {
            const summary = calculateSummary(block.items);
            if (!summary) return null;
            
            return (
              <details key={`chunk-${idx}`} className="group border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
                <summary className="px-4 py-4 cursor-pointer bg-gray-50 hover:bg-gray-100 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-6">
                    <span className="font-bold text-gray-700 w-32">{block.label}</span>
                    <div className="hidden sm:flex flex-col">
                      <span className="text-xs text-gray-500">月額平均</span>
                      <span className="text-sm font-semibold text-gray-700">{formatCurrency(summary.avgPayment)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex flex-col text-right">
                      <span className="text-xs text-gray-500">期間末残高</span>
                      <span className="text-sm font-semibold text-gray-700">{formatCurrency(summary.endBalance)}</span>
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
                  </div>
                </summary>
                
                <div className="border-t border-gray-200 bg-white">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50/50 border-b border-gray-100 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs mb-1">期間平均金利</p>
                      <p className="font-bold text-gray-700">
                        {isMerged ? <span className="text-gray-400">-（個別参照）</span> : `${summary.avgInterestRate.toFixed(3)}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-1">平均元金充当分(月)</p>
                      <p className="font-bold text-gray-700">{formatCurrency(summary.avgPrincipal)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-1">平均利息充当分(月)</p>
                      <p className="font-bold text-gray-700">{formatCurrency(summary.avgInterest)}</p>
                    </div>
                    <div className="sm:hidden">
                      <p className="text-gray-500 text-xs mb-1">期間末残高</p>
                      <p className="font-bold text-gray-700">{formatCurrency(summary.endBalance)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <DetailTable items={block.items} isMerged={isMerged} />
                  </div>
                </div>
              </details>
            );
          }
        })}
      </div>
    </div>
  );
}
