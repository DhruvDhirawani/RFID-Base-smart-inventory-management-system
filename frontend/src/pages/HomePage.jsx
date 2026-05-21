import { useQuery } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import NotificationBar from '../components/NotificationBar'
import { fetchWorkingCapital, fetchCurrentStock, fetchProfitLoss, healthCheck } from '../utils/api'

const HomePage = ({ onLogout }) => {
  const { data: capitalData } = useQuery({
    queryKey: ['working-capital'],
    queryFn: fetchWorkingCapital,
    refetchInterval: 15000,
  })

  const { data: stockData } = useQuery({
    queryKey: ['current-stock'],
    queryFn: fetchCurrentStock,
    refetchInterval: 15000,
  })

  const { data: plData } = useQuery({
    queryKey: ['profit-loss'],
    queryFn: fetchProfitLoss,
    refetchInterval: 15000,
  })

  const { data: healthData, isError: backendDown } = useQuery({
    queryKey: ['health'],
    queryFn: healthCheck,
    refetchInterval: 10000,
    retry: 1,
  })

  const { data: uptime } = useQuery({
    queryKey: ['uptime'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/system/uptime')
      return res.json()
    },
    refetchInterval: 10000,
  })

  const { data: serialStatus } = useQuery({
    queryKey: ['serial-status'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/system/serial-status')
      return res.json()
    },
    refetchInterval: 10000,
  })

  const workingCapital = capitalData?.data?.total_working_capital || 0
  const totalStock = stockData?.data?.total_items || 0
  const totalPL = plData?.data?.total_profit_loss || 0
  const txCount = plData?.data?.transaction_count || 0

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onLogout={onLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Real-time RFID inventory tracking — all operations from one place
          </p>
        </div>

        {/* Live KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm font-medium">Working Capital</span>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">₹{workingCapital.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1">total invested in stock</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm font-medium">Lots in Stock</span>
              <span className="text-2xl">📦</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{totalStock}</p>
            <p className="text-xs text-slate-400 mt-1">active RFID batches</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm font-medium">Total Profit / Loss</span>
              <span className="text-2xl">📈</span>
            </div>
            <p className={`text-2xl font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalPL >= 0 ? '+' : ''}₹{totalPL.toFixed(2)}
            </p>
            <p className="text-xs text-slate-400 mt-1">across all transactions</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm font-medium">Transactions</span>
              <span className="text-2xl">🔄</span>
            </div>
            <p className="text-2xl font-bold text-violet-600">{txCount}</p>
            <p className="text-xs text-slate-400 mt-1">completed checkouts</p>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications — takes 2 of 3 columns */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <NotificationBar />
          </div>

          {/* Quick Guide */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Quick Guide</h2>
            <div className="space-y-4">
              {[
                { icon: '📥', title: 'Checkin', desc: 'Scan items when they arrive in stock', path: '/checkin', color: 'text-blue-600 bg-blue-50' },
                { icon: '📤', title: 'Checkout', desc: 'Scan items when leaving the warehouse', path: '/checkout', color: 'text-emerald-600 bg-emerald-50' },
                { icon: '📦', title: 'Current Stock', desc: 'View all lots with expiry status', path: '/stock', color: 'text-violet-600 bg-violet-50' },
                { icon: '💹', title: 'Profit / Loss', desc: 'Analyze profitability per transaction', path: '/analysis', color: 'text-orange-500 bg-orange-50' },
              ].map(({ icon, title, desc, path, color }) => (
                <a key={path} href={path} className="flex items-start gap-3 group">
                  <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center text-lg shrink-0 mt-0.5`}>
                    {icon}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">System Status</h2>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${backendDown ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
              <span className="text-sm text-slate-600">
                Backend — <strong className={backendDown ? 'text-red-600' : 'text-emerald-600'}>
                  {backendDown ? 'Offline' : 'Online'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-slate-600">Database — <strong className="text-emerald-600">Active</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${serialStatus?.connected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-slate-600">RFID System — <strong className={serialStatus?.connected ? 'text-emerald-600' : 'text-red-600'}>
                {serialStatus?.connected ? 'Connected' : 'Disconnected'}
              </strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 text-sm">
              <span className="text-lg">⏱️</span>
              System running for: <strong className="ml-1 text-slate-800">{uptime?.uptime || '...'}</strong>
            </div>
            {healthData?.data?.timestamp && (
              <div className="ml-auto text-xs text-slate-400">
                Last ping: {new Date(healthData.data.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
