import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import Navbar from '../components/Navbar'
import { fetchProfitLoss } from '../utils/api'

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
        <p className="text-slate-500 mb-1">Tx #{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="font-semibold">
            {entry.name}: {entry.value >= 0 ? '+' : ''}₹{Number(entry.value).toFixed(2)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

const ProfitLossPage = ({ onLogout }) => {
  const { data: profitLossData, isLoading } = useQuery({
    queryKey: ['profit-loss'],
    queryFn: fetchProfitLoss,
    refetchInterval: 15000,
  })

  const { data: abcData = [] } = useQuery({
    queryKey: ['abc-classification'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/analytics/abc-classification')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const { data: turnoverData = [] } = useQuery({
    queryKey: ['turnover'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/analytics/turnover')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const transactions = profitLossData?.data?.transactions || []
  const totalProfitLoss = profitLossData?.data?.total_profit_loss || 0

  // Summary statistics
  const stats = useMemo(() => {
    if (transactions.length === 0) {
      return { totalTransactions: 0, totalProfit: 0, totalLoss: 0, profitableCount: 0, losingCount: 0, avgDaysHeld: 0, currentQuarterSales: 0 }
    }
    const profitable = transactions.filter((t) => t.profit_loss > 0)
    const losing = transactions.filter((t) => t.profit_loss < 0)

    const now = new Date()
    const currentQ = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`
    
    const getQuarter = (dateStr) => {
      const d = new Date(dateStr)
      return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
    }

    const currentQuarterSales = transactions
      .filter(t => getQuarter(t.checked_out_at) === currentQ)
      .reduce((sum, t) => sum + (t.selling_price * t.quantity), 0)

    return {
      totalTransactions: transactions.length,
      totalProfit: profitable.reduce((s, t) => s + t.profit_loss, 0),
      totalLoss: Math.abs(losing.reduce((s, t) => s + t.profit_loss, 0)),
      profitableCount: profitable.length,
      losingCount: losing.length,
      avgDaysHeld: transactions.reduce((s, t) => s + t.days_held, 0) / transactions.length,
      currentQuarterSales
    }
  }, [transactions])

  // Bar chart — Quarterly Gross Sales
  const barChartData = useMemo(() => {
    const qMap = {}
    const getQuarter = (dateStr) => {
      const d = new Date(dateStr)
      return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
    }
    
    transactions.forEach(t => {
      const q = getQuarter(t.checked_out_at)
      if (!qMap[q]) qMap[q] = 0
      qMap[q] += (t.selling_price * t.quantity)
    })
    
    return Object.entries(qMap)
      .sort((a, b) => {
        const [qa, ya] = a[0].split(' ')
        const [qb, yb] = b[0].split(' ')
        if (ya !== yb) return parseInt(ya) - parseInt(yb)
        return parseInt(qa[1]) - parseInt(qb[1])
      })
      .map(([q, sales]) => ({
        label: q,
        sales: parseFloat(sales.toFixed(2))
      }))
  }, [transactions])

  // Line chart — cumulative P&L
  const lineChartData = useMemo(() => {
    let cumulative = 0
    return [...transactions].reverse().map((t, i) => {
      cumulative += t.profit_loss
      return { id: i + 1, cumulative: parseFloat(cumulative.toFixed(2)) }
    })
  }, [transactions])

  // Item-wise grouped
  const itemSummary = useMemo(() => {
    const map = {}
    transactions.forEach((t) => {
      if (!map[t.item_name]) map[t.item_name] = { name: t.item_name, profit: 0, count: 0 }
      map[t.item_name].profit += t.profit_loss
      map[t.item_name].count += 1
    })
    return Object.values(map).sort((a, b) => b.profit - a.profit)
  }, [transactions])

  const profitColor = (v) => (v >= 0 ? '#10b981' : '#ef4444')

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onLogout={onLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Profit / Loss Analysis</h1>
          <p className="text-slate-500 mt-1">Full transaction history and profitability breakdown</p>
        </div>

        {/* Total P&L Banner */}
        <div className={`rounded-2xl shadow-sm p-8 mb-8 text-white text-center ${
          totalProfitLoss >= 0
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
            : 'bg-gradient-to-r from-red-500 to-red-600'
        }`}>
          <p className="text-sm font-medium opacity-80 mb-1">Total Profit / Loss</p>
          <p className="text-5xl font-extrabold tracking-tight">
            {totalProfitLoss >= 0 ? '+' : ''}₹{totalProfitLoss.toFixed(2)}
          </p>
          <p className="text-sm opacity-70 mt-2">{stats.totalTransactions} transactions completed</p>
        </div>

        {/* KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <p className="text-slate-500 text-sm">Total Transactions</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalTransactions}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 border-l-4 border-l-blue-500">
            <p className="text-slate-500 text-sm">Gross Sales (CQ)</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">₹{stats.currentQuarterSales.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-0.5">current quarter</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <p className="text-slate-500 text-sm">Profitable</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.profitableCount}</p>
            <p className="text-xs text-emerald-600 mt-0.5">+₹{stats.totalProfit.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <p className="text-slate-500 text-sm">Losing</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{stats.losingCount}</p>
            <p className="text-xs text-red-500 mt-0.5">-₹{stats.totalLoss.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <p className="text-slate-500 text-sm">Avg Days Held</p>
            <p className="text-2xl font-bold text-violet-600 mt-1">{stats.avgDaysHeld.toFixed(1)}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-slate-500">Loading analysis...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100 text-slate-400">
            <div className="text-5xl mb-3">💹</div>
            <p className="font-medium">No transactions yet</p>
            <p className="text-sm mt-1">Complete some checkouts to see analysis here</p>
          </div>
        ) : (
          <>
            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Quarterly Sales bar chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-base font-semibold text-slate-800 mb-4">Quarterly Gross Sales</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <Tooltip />
                    <Bar
                      dataKey="sales"
                      name="Gross Sales (₹)"
                      radius={[4, 4, 0, 0]}
                      fill="#3b82f6"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cumulative line chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-base font-semibold text-slate-800 mb-4">Cumulative P&L Trend</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="id" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative P/L"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: '#6366f1' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Item summary cards */}
            {itemSummary.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
                <h2 className="text-base font-semibold text-slate-800 mb-4">Profit by Item</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {itemSummary.map((item) => (
                    <div key={item.name} className="bg-slate-50 rounded-xl p-4">
                      <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                      <p className={`text-xl font-bold mt-1 ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {item.profit >= 0 ? '+' : ''}₹{item.profit.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.count} transactions</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABC and Turnover row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* ABC Classification */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h2 className="text-base font-semibold text-slate-800">ABC Profit Classification</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 font-medium">Item Name</th>
                        <th className="px-6 py-3 font-medium">Class</th>
                        <th className="px-6 py-3 font-medium">Profit</th>
                        <th className="px-6 py-3 font-medium">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {abcData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium">{item.item_name}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-block w-6 text-center rounded-sm font-bold text-xs py-0.5 ${
                              item.classification === 'A' ? 'bg-green-100 text-green-700' :
                              item.classification === 'B' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-200 text-slate-600'
                            }`}>
                              {item.classification}
                            </span>
                          </td>
                          <td className="px-6 py-3">₹{item.total_profit.toFixed(2)}</td>
                          <td className="px-6 py-3">{item.profit_percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inventory Turnover */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h2 className="text-base font-semibold text-slate-800">Inventory Turnover Rate</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 font-medium">Item Name</th>
                        <th className="px-6 py-3 font-medium">Turnover Rate</th>
                        <th className="px-6 py-3 font-medium">Total Sold</th>
                        <th className="px-6 py-3 font-medium">Avg Inv.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700">
                      {turnoverData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium">{item.item_name}</td>
                          <td className="px-6 py-3 font-bold text-blue-600">{item.turnover_rate.toFixed(2)}</td>
                          <td className="px-6 py-3">{item.total_sold} units</td>
                          <td className="px-6 py-3">{item.avg_inventory.toFixed(1)} units</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Full Transaction Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-800">
                  All Transactions
                  <span className="ml-2 text-sm font-normal text-slate-400">({transactions.length})</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Item', 'RFID', 'Buy Price/Unit', 'Sell Price/Unit', 'Qty', 'Days', 'Holding Cost', 'Profit / Loss', 'Date'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {transactions.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{t.item_name}</td>
                        <td className="px-5 py-3.5 text-sm font-mono text-blue-600">{t.rfid_tag}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">₹{t.purchase_price?.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 font-medium">₹{t.selling_price?.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{t.quantity}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{t.days_held}</td>
                        <td className="px-5 py-3.5 text-sm text-red-500">-₹{t.holding_cost?.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-sm">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                            t.profit_loss >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {t.profit_loss >= 0 ? '+' : ''}₹{t.profit_loss?.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-400">
                          {new Date(t.checked_out_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ProfitLossPage
