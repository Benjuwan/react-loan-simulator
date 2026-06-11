import { useMemo } from 'react';
import {
  BarChart,                   // 棒グラフ: 年間支払額の内訳を表示するための棒グラフコンテナ
  Bar,                        // 棒グラフの各データ系列を描画
  LineChart,                  // 折れ線グラフ: 借入残高と未払利息の推移を表示するコンテナ
  Line,                       // 折れ線グラフの各データ系列を描画
  XAxis,                      // X軸の設定
  YAxis,                      // Y軸の設定
  CartesianGrid,              // 補助グリッド線
  Tooltip,                    // ホバー時に詳細を表示するツールチップ
  Legend,                     // グラフ凡例
  ResponsiveContainer         // レスポンシブなコンテナ
} from 'recharts';
import type { MonthlyDetail } from '../ts/modelInterfaces';
import { formatCurrency } from '../lib/utils';

interface LoanChartProps {
  data: MonthlyDetail[];
}

export function LoanChart({ data }: LoanChartProps) {
  // 360ヶ月分あるとグラフが細かすぎるため年単位に集計
  const yearlyData = useMemo(() => {
    // 月別支払い全期間データが存在しなければ空配列を返す
    if (!data || data.length === 0) {
      return [];
    }

    // 支払い全期間（月単位）を年単位に
    const years = Math.ceil(data.length / 12);

    // 支払い年数分を持った配列（年数分の配列要素があれば良いので中身は`undefined`）
    const allPaymentMonthTerm: undefined[] = Array(years).fill(undefined);

    // 配列要素は`undefined`なので`_`で使用しないことを明示
    return allPaymentMonthTerm.map((_, i) => {
      // 支払い全期間（月単位）データから、年単位の月別支払いデータ配列を取得
      const yearMonths: MonthlyDetail[] = [...data].slice(i * 12, (i + 1) * 12);
      // 支払い最終月データ
      const lastMonth: MonthlyDetail = yearMonths[yearMonths.length - 1];

      // `yearMonths.reduce`で年単位の月別支払いデータ配列を合算（※積立計算の初期値を0にして正確な合算値を算出）
      return {
        year: i + 1,
        label: `${i + 1}年目`,
        paymentAmount: yearMonths.reduce((sum, d) => sum + d.paymentAmount, 0),
        interestPayment: yearMonths.reduce((sum, d) => sum + d.interestPayment, 0),
        principalPayment: yearMonths.reduce((sum, d) => sum + d.principalPayment, 0),
        unpaidInterest: yearMonths.reduce((sum, d) => sum + d.unpaidInterest, 0),
        principalBalance: lastMonth.principalBalance,
        accumulatedUnpaidInterest: lastMonth.accumulatedUnpaidInterest,
        interestRate: lastMonth.interestRate,
      };
    });
  }, [data]);

  // ガード処理
  if (yearlyData.length === 0) {
    return null;
  }

  // 最終年の年単位の月別支払いデータ 
  const lastYearData = yearlyData[yearlyData.length - 1];
  // 未払利息の有無チェック
  const hasUnpaidInterest = lastYearData.accumulatedUnpaidInterest > 0;
  // 最終清算分の有無チェック
  const hasRemainingPrincipal = lastYearData.principalBalance > 0;

  return (
    <div className="space-y-12">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800">年間支払額の内訳（元金・利息）</h3>
        </div>

        {/* 年間支払額の内訳（元金・利息）グラフ */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              {/* `value`は、後述の2つの`Bar`コンポーネントの`dataKey`（principalPayment, interestPayment それぞれ）から自動算出した縦軸目盛の数値（円単位） */}
              <YAxis
                tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <Tooltip
                // formatCurrency: 金額を日本の通貨形式（円）にフォーマットする関数（例: 100000 -> "￥100,000"）
                // `value`は、ユーザーが棒グラフ上の特定のバーにホバーしたとき、そのバー（`Bar`コンポーネント）に対応する`dataKey`（principalPayment, interestPayment それぞれ）のデータ値
                formatter={(value) => typeof value === 'number' ? formatCurrency(value) : ''}
                labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="principalPayment" name="元金充当分" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
              <Bar dataKey="interestPayment" name="利息充当分" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-blue-700">グラフの見方（元利均等返済の仕組み）: </span>
            毎年支払う金額のうち、元金と利息の割合を示します。返済初期は利息の割合が多く、右に行くにつれて元金が減るスピードが加速します。金利上昇のタイミングでは一時的に利息の割合が増加することがあります。
          </p>
        </div>
      </div>

      {/* 元金残高・未払利息推移グラフ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800">借入残高と未払利息の推移</h3>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              {/* `value`は`Line yAxisId="left" dataKey="principalBalance"`から渡される `principalBalance`（生の円）を表示。
              `tickFormatter`は表示単位を '万' に変換 */}
              <YAxis
                yAxisId="left"
                tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              {/* `value`は`Line yAxisId="right" dataKey="accumulatedUnpaidInterest"`から渡される`accumulatedUnpaidInterest`（生の円）を表示。
              `tickFormatter`は表示単位を '万' に変換 */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${(value / 10000).toFixed(0)}万`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <Tooltip
                // formatCurrency: 金額を日本の通貨形式（円）にフォーマットする関数（例: 100000 -> "￥100,000"）
                // `value`は、ユーザーが折れ線グラフ上の特定の折れ線にホバーしたとき、その折れ線（`Line`コンポーネント）に対応する`dataKey`（principalBalance, accumulatedUnpaidInterest それぞれ）のデータ値
                formatter={(value) => typeof value === 'number' ? formatCurrency(value) : ''}
                labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '8px' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line yAxisId="left" type="monotone" dataKey="principalBalance" name="元金残高" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="stepAfter" dataKey="accumulatedUnpaidInterest" name="累積未払利息" stroke="#ef4444" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-3">
          <div className="p-4 bg-red-50/50 rounded-lg border border-red-100">
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-red-600">グラフの見方（警告サイン）: </span>
              緑の線が右肩下がりなのが正常です。もし金利が急上昇し月々の返済額で利息を払い切れなくなると、緑の線が横ばいになり赤色の線（未払利息）が上昇し始めます。これは将来への借金先送りを意味し、早急な対策が必要な警告サインです。
            </p>
          </div>
          {/* 未払利息（hasUnpaidInterest）または最終清算（hasRemainingPrincipal）の有無に応じてクラスが変更 */}
          <div className={`p-4 rounded-lg border ${(hasUnpaidInterest || hasRemainingPrincipal)
            ? 'bg-red-50 border-red-200'
            : 'bg-green-50 border-green-200'
            }`}>
            <h4 className={`font-bold mb-2 flex items-center ${(hasUnpaidInterest || hasRemainingPrincipal) ? 'text-red-700' : 'text-green-700'
              }`}>
              {(hasUnpaidInterest || hasRemainingPrincipal)
                ? '⚠️ 最終月（満期）時点の残高・未払利息（一括返済が必要）'
                : '✅ 最終月（満期）時点の残高・未払利息（完済）'}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">元金残高</p>
                <p className={`text-lg font-bold ${hasRemainingPrincipal ? 'text-red-600' : 'text-green-600'}`}>
                  {/* formatCurrency: 金額を日本の通貨形式（円）にフォーマットする関数（例: 100000 -> "￥100,000"） */}
                  {formatCurrency(lastYearData.principalBalance)}
                </p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">未払利息</p>
                <p className={`text-lg font-bold ${hasUnpaidInterest ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(lastYearData.accumulatedUnpaidInterest)}
                </p>
              </div>
            </div>
            {(hasUnpaidInterest || hasRemainingPrincipal) &&
              <p className="mt-3 text-sm text-red-600 font-bold">
                合計 {formatCurrency(lastYearData.principalBalance + lastYearData.accumulatedUnpaidInterest)} の一括返済が必要です。
              </p>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
