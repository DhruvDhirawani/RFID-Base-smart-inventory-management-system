import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Navbar from '../components/Navbar'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts'

const API_BASE = 'http://localhost:8000'

const AnalyticsPage = ({ onLogout }) => {
  const queryClient = useQueryClient()

  // Data fetching
  const { data: dailyFlow = [] } = useQuery({
    queryKey: ['dailyFlow'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/analytics/daily-flow`)
      return res.data
    }
  })

  const { data: stockTrend = [] } = useQuery({
    queryKey: ['stockTrend'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/analytics/stock-trend`)
      return res.data
    }
  })

  const { data: demandForecast = [] } = useQuery({
    queryKey: ['demandForecast'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/analytics/demand-forecast`)
      return res.data
    }
  })

  const { data: reorderRequests = [] } = useQuery({
    queryKey: ['reorderRequests'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/reorder-requests`)
      return res.data
    }
  })

  const fulfillMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.patch(`${API_BASE}/reorder-requests/${id}/fulfill`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reorderRequests'])
    }
  })

  // Format stock trend data for LineChart (pivot data)
  // Input: [{date: '2023-01-01', item_name: 'A', quantity: 10}, ...]
  // Output: [{date: '2023-01-01', 'A': 10, 'B': 20}, ...]
  const formatStockTrend = () => {
    const dates = {}
    const items = new Set()
    
    stockTrend.forEach(row => {
      if (!dates[row.date]) dates[row.date] = { date: row.date }
      dates[row.date][row.item_name] = row.quantity
      items.add(row.item_name)
    })
    
    return { data: Object.values(dates), items: Array.from(items) }
  }
  
  const formattedTrend = formatStockTrend()
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#eab308', '#9333ea', '#db2777']

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar onLogout={onLogout} />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-8">Analytics Dashboard</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Daily Flow Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Daily In vs Out (Last 30 Days)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyFlow}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(tick) => new Date(tick).toLocaleDateString()} />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="checkins" name="Checkins" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="checkouts" name="Checkouts" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stock Trend Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Stock Level Trend (Last 30 Days)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedTrend.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(tick) => new Date(tick).toLocaleDateString()} />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  {formattedTrend.items.map((item, index) => (
                    <Line 
                      key={item} 
                      type="monotone" 
                      dataKey={item} 
                      stroke={colors[index % colors.length]} 
                      strokeWidth={2} 
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Demand Forecast */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Demand Forecast</h2>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Item</th>
                    <th className="px-6 py-3">Current Stock</th>
                    <th className="px-6 py-3">Avg Daily Checkout</th>
                    <th className="px-6 py-3">Predicted Restock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {demandForecast.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium">{row.item_name}</td>
                      <td className="px-6 py-3">{row.current_stock}</td>
                      <td className="px-6 py-3">{row.avg_daily_checkout}</td>
                      <td className="px-6 py-3">
                        {row.predicted_restock_date 
                          ? new Date(row.predicted_restock_date).toLocaleDateString()
                          : <span className="text-slate-400">N/A</span>}
                      </td>
                    </tr>
                  ))}
                  {demandForecast.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No forecast data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reorder Requests */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800">Reorder Requests</h2>
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium">
                {reorderRequests.filter(r => r.status === 'PENDING').length} Pending
              </span>
            </div>
            <div className="p-0 overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-3">Item</th>
                    <th className="px-6 py-3">Qty</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reorderRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium">{req.item?.name || 'Unknown'}</td>
                      <td className="px-6 py-3">{req.quantity_requested}</td>
                      <td className="px-6 py-3">{new Date(req.generated_at).toLocaleDateString()}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {req.status === 'PENDING' && (
                          <button
                            onClick={() => fulfillMutation.mutate(req.id)}
                            disabled={fulfillMutation.isPending}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            Mark Fulfilled
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {reorderRequests.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No reorder requests</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}

export default AnalyticsPage
