import { useState } from 'react'
import { calculateLoan, type LoanConditions, type MonthlyDetail } from './lib/loanCalculator'
import { mergeMonthlyDetails } from './lib/loanMerger'
import { LoanChart } from './components/LoanChart'
import { LoanForm } from './components/LoanForm'

// 年二回（4月、10月）金利の見直しがあって、
// それぞれ翌々月（6月、12月）から適用されるという一般的な見直し事例を想定
const INITIAL_HUSBAND: LoanConditions = {
  principal: 18100000,
  termYears: 30,
  // 各テストシナリオは、借入開始（例： 2025.08）からの経過月数と、その月から適用される金利を指定する
  // つまり「開始時1ヶ月目は 0.68 でスタートし、6か月目には 0.84 に、12か月目には 0.96 に、...48か月目には～」といった累積になっていく。
  // ※実際の金利変動はフォームUIで個別に追加する想定だが、事前に判明している過去分がある場合は以下のように複数シナリオを明示的に設定することも可能。
  // scenarios: [
  //   { monthOffset: 1, interestRate: 0.68 },  // 8月借入の場合 8月
  //   { monthOffset: 6, interestRate: 0.84 },  // 8月借入の場合 翌1月
  //   { monthOffset: 12, interestRate: 0.96 }, // 8月借入の場合 翌7月
  //   { monthOffset: 48, interestRate: 1.2 }   // 8月借入の場合 4年後の8月
  // ]
  scenarios: [{ monthOffset: 1, interestRate: 0.68 }]
};

const INITIAL_WIFE: LoanConditions = {
  principal: 18200000,
  termYears: 30,
  scenarios: [{ monthOffset: 1, interestRate: 0.68 }]
};

function App() {
  const resH = calculateLoan(INITIAL_HUSBAND);
  const resW = calculateLoan(INITIAL_WIFE);

  const [resultHusband, setResultHusband] = useState<MonthlyDetail[]>(resH);
  const [resultWife, setResultWife] = useState<MonthlyDetail[]>(resW);
  const [resultMerged, setResultMerged] = useState<MonthlyDetail[]>(mergeMonthlyDetails(resH, resW));
  const [viewMode, setViewMode] = useState<'merged' | 'husband' | 'wife'>('merged');

  const handleCalculate = (husbandData: LoanConditions, wifeData: LoanConditions) => {
    const resH = calculateLoan(husbandData);
    const resW = calculateLoan(wifeData);
    setResultHusband(resH);
    setResultWife(resW);
    setResultMerged(mergeMonthlyDetails(resH, resW));
  };

  const activeData = viewMode === 'merged' ? resultMerged : (viewMode === 'husband' ? resultHusband : resultWife);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">住宅ローン シミュレーション (ペアローン対応)</h1>
          <p className="mt-2 text-sm text-slate-500">金利変動による月々の支払内訳と、元金残高の推移を視覚化します。</p>
        </div>

        <LoanForm
          initialHusband={INITIAL_HUSBAND}
          initialWife={INITIAL_WIFE}
          onCalculate={handleCalculate}
        />

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex space-x-2 border-b border-gray-200 mb-6">
            <button
              onClick={() => setViewMode('merged')}
              className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${viewMode === 'merged' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              世帯合算
            </button>
            <button
              onClick={() => setViewMode('husband')}
              className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${viewMode === 'husband' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              夫のみ
            </button>
            <button
              onClick={() => setViewMode('wife')}
              className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${viewMode === 'wife' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              妻のみ
            </button>
          </div>
          <LoanChart data={activeData} />
        </div>

        <div className="text-xs text-slate-500 mt-4 px-4 space-y-1 pb-8">
          <p>※本シミュレーターは「元利均等返済」「ボーナス返済なし」「5年ルール・125%ルールあり」の条件で計算しています。</p>
          <p>※金融機関の計算方式（端数処理など）により数十円〜数百円程度の誤差が生じる場合があります。</p>
        </div>
      </div>
    </div>
  )
}

export default App
