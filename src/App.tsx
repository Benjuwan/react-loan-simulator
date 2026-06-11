import { useState } from 'react'
import type { LoanConditions, MonthlyDetail } from './ts/modelInterfaces'
import { mergeMonthlyDetails } from './lib/loanMerger'
import { calculateLoan } from './lib/loanCalculator'
import { LoanChart } from './components/LoanChart'
import { LoanForm } from './components/LoanForm'
import { PaymentHistory } from './components/PaymentHistory'

// 年二回（4月、10月）金利の見直しがあって、
// それぞれ翌々月（6月、12月）から適用されるという一般的な見直し事例を想定
const INITIAL_HUSBAND: LoanConditions = {
  principal: 18100000,
  termYears: 30,
  // 各テストシナリオは、借入開始（例： 2025.08）からの経過月数と、その月から適用される金利を指定する
  // つまり「開始時1ヶ月目は 0.68 でスタートし、6か月目には 0.93 に、12か月目には 1.25 に、...48か月目には～」といった累積になっていく。
  // ※実際の金利変動はフォームUIで個別に追加する想定だが、事前に判明している過去分がある場合は以下のように複数シナリオを明示的に設定することも可能。
  // scenarios: [
  //   { monthOffset: 1, interestRate: 0.68 },  // 8月借入の場合 8月
  //   { monthOffset: 6, interestRate: 0.93 },  // 8月借入の場合 翌1月
  //   { monthOffset: 12, interestRate: 1.25 }, // 8月借入の場合 翌7月
  //   { monthOffset: 48, interestRate: 1.2 }   // 8月借入の場合 4年後の8月
  // ]
  scenarios: [{ monthOffset: 1, interestRate: 0.68 }]
};

const INITIAL_WIFE: LoanConditions = {
  principal: 18200000,
  termYears: 30,
  scenarios: [{ monthOffset: 1, interestRate: 0.68 }]
};

// 夫婦および世帯合算の月別支払い詳細データの型定義
interface MonthlyDetailsType {
  resultHusband: MonthlyDetail[],
  resultWife: MonthlyDetail[],
  resultMerged: MonthlyDetail[]
}

function App() {
  // 夫婦の月別支払い詳細データ（※`monthlyDetails`State で世帯合算のデータと共に一元管理）
  const MonthlyDetail_HUSBAND = calculateLoan(INITIAL_HUSBAND);
  const MonthlyDetail_WIFE = calculateLoan(INITIAL_WIFE);

  const initialMonthlyDetails: MonthlyDetailsType = {
    resultHusband: MonthlyDetail_HUSBAND,
    resultWife: MonthlyDetail_WIFE,
    resultMerged: mergeMonthlyDetails(MonthlyDetail_HUSBAND, MonthlyDetail_WIFE)
  };
  const [monthlyDetails, setMonthlyDetails] = useState<MonthlyDetailsType>(initialMonthlyDetails);

  // テーブルの描画モード： デフォルトは世帯合算
  const [viewMode, setViewMode] = useState<'merged' | 'husband' | 'wife'>('merged');

  // デフォルトの借入開始年月（例：2025年8月）
  const [startDate, setStartDate] = useState<string>('2025-08');

  function handleCalculate(
    husbandData: LoanConditions,
    wifeData: LoanConditions,
    newStartDate: string
  ): void {
    const MonthlyDetail_HUSBAND = calculateLoan(husbandData);
    const MonthlyDetail_WIFE = calculateLoan(wifeData);
    setMonthlyDetails({
      resultHusband: MonthlyDetail_HUSBAND,
      resultWife: MonthlyDetail_WIFE,
      resultMerged: mergeMonthlyDetails(MonthlyDetail_HUSBAND, MonthlyDetail_WIFE)
    });
    setStartDate(newStartDate);
  };

  const activeData: MonthlyDetail[] = viewMode === 'merged' ? monthlyDetails.resultMerged : (viewMode === 'husband' ? monthlyDetails.resultHusband : monthlyDetails.resultWife);

  return (
    <div className="GlobalWrapper min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <main className="max-w-5xl mx-auto space-y-8">
        <section>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">住宅ローン シミュレーション (ペアローン対応)</h1>
          <div className="text-xs mt-3 p-2 bg-lime-50/50 rounded-lg border border-lime-100">
            <p>夫婦それぞれの住宅ローンを個別に設定し、変動金利や5年ルール・125%ルールの影響を可視化するシミュレーターです。</p>
            <p>借入条件と将来の金利変動シナリオを入力すると、月々の支払額・元金・利息・未払利息の推移をグラフと明細で確認できます。</p>
            <ul className="list-disc mt-2 pl-4">
              <li>異なる金利変動パターンで、夫婦の世帯合算／個別返済の比較を行いたい。</li>
              <li>5年ごとの返済額見直しや125%ルールが、返済計画に与える影響を把握したい。</li>
              <li>金利上昇時に未払利息が発生するリスクを視覚的に確認したい。</li>
            </ul>
          </div>
        </section>
        <LoanForm
          initialHusband={INITIAL_HUSBAND}
          initialWife={INITIAL_WIFE}
          initialStartDate={startDate}
          onCalculate={handleCalculate}
        />
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
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
          <div className="space-y-8">
            {/* 以下コンポーネントでは世帯合算、夫婦別のボタン選択に応じて描画データ（月別支払い全期間データ）が変化する */}
            <PaymentHistory data={activeData} startDate={startDate} isMerged={viewMode === 'merged'} />
            <LoanChart data={activeData} />
          </div>
        </section>
        <section className="text-xs text-slate-500 mt-4 px-4 space-y-1 pb-8">
          <p>※本シミュレーターは「元利均等返済」「ボーナス返済なし」「5年ルール・125%ルールあり」の条件で計算しています。</p>
          <p>※金融機関の計算方式（端数処理など）により数十円〜数百円程度の誤差が生じる場合があります。</p>
        </section>
      </main>
    </div>
  )
}

export default App
