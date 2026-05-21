import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Navbar from '../components/Navbar'

const API_BASE = 'http://localhost:8000'

const SystemPage = ({ onLogout }) => {
  // Polling every 10s for live status
  const { data: uptime } = useQuery({
    queryKey: ['systemUptime'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/system/uptime`)
      return res.data
    },
    refetchInterval: 10000
  })

  const { data: serialStatus } = useQuery({
    queryKey: ['serialStatus'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/system/serial-status`)
      return res.data
    },
    refetchInterval: 5000
  })

  const { data: scanStats } = useQuery({
    queryKey: ['scanStats'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/system/scan-stats`)
      return res.data
    },
    refetchInterval: 5000
  })

  const { data: reorderRequests } = useQuery({
    queryKey: ['reorderSummary'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/reorder-requests`)
      return res.data
    }
  })

  const pendingReorders = reorderRequests?.filter(r => r.status === 'PENDING').length || 0
  const successRate = scanStats?.total > 0 ? Math.round((scanStats.success / scanStats.total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar onLogout={onLogout} />
      
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-8">System Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* RFID System Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start gap-4">
            <div className={`p-4 rounded-full ${serialStatus?.connected ? 'bg-green-100' : 'bg-red-100'}`}>
              <span className="text-2xl">📡</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">RFID Scanner Status</h2>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${serialStatus?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-slate-600 font-medium">
                  {serialStatus?.connected ? 'Connected & Active' : 'Disconnected'}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Port: <span className="font-mono bg-slate-100 px-1 rounded">{serialStatus?.port || 'N/A'}</span>
              </p>
            </div>
          </div>

          {/* System Uptime Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start gap-4">
            <div className="p-4 rounded-full bg-blue-100">
              <span className="text-2xl">⏱️</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Server Uptime</h2>
              <p className="text-2xl font-bold text-blue-600 mb-1">
                {uptime?.uptime || 'Loading...'}
              </p>
              <p className="text-sm text-slate-500">
                Continuous backend operation time
              </p>
            </div>
          </div>

          {/* Scan Statistics Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start gap-4">
            <div className="p-4 rounded-full bg-purple-100">
              <span className="text-2xl">📊</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Scan Statistics</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Total Attempted</p>
                  <p className="text-xl font-bold text-slate-700">{scanStats?.total || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Success Rate</p>
                  <p className="text-xl font-bold text-green-600">{successRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Successful Scans</p>
                  <p className="text-xl font-bold text-green-600">{scanStats?.success || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Failed Scans</p>
                  <p className="text-xl font-bold text-red-600">{scanStats?.failed || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Auto Reorder Summary Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start gap-4">
            <div className="p-4 rounded-full bg-amber-100">
              <span className="text-2xl">🛒</span>
            </div>
            <div className="flex-1 flex flex-col justify-between h-full">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Auto-Reorder System</h2>
                <p className="text-3xl font-bold text-amber-600 mb-2">
                  {pendingReorders}
                </p>
                <p className="text-sm text-slate-500 mb-4">
                  Pending requests waiting for fulfillment
                </p>
              </div>
              <Link 
                to="/analytics" 
                className="text-center w-full block py-2 px-4 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium transition-colors text-sm"
              >
                Manage Requests in Analytics →
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}

export default SystemPage
