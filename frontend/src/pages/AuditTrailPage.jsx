import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Navbar from '../components/Navbar'

const API_BASE = 'http://localhost:8000'

const AuditTrailPage = ({ onLogout }) => {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', page],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/audit-logs?page=${page}`)
      return res.data
    },
    keepPreviousData: true
  })

  const getActionColor = (action) => {
    switch (action) {
      case 'CHECKIN': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'CHECKOUT': return 'bg-green-100 text-green-800 border-green-200'
      case 'ALERT_GENERATED': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'LOGIN': return 'bg-slate-100 text-slate-800 border-slate-200'
      default: return 'bg-purple-100 text-purple-800 border-purple-200'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar onLogout={onLogout} />
      
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Audit Trail</h1>
            <p className="text-sm text-slate-500">
              <span className="inline-block mr-1 text-amber-500">⚠️</span>
              All records are permanent and cannot be deleted.
            </p>
          </div>
          {data?.total !== undefined && (
            <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
              Total Logs: {data.total}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 w-48">Timestamp</th>
                  <th className="px-6 py-3 w-32">Action</th>
                  <th className="px-6 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">Loading logs...</td>
                  </tr>
                ) : data?.items?.length > 0 ? (
                  data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-normal min-w-[300px]">
                        {log.description}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No audit logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {data && data.pages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Page {page} of {data.pages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-slate-300 rounded text-sm bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="px-3 py-1 border border-slate-300 rounded text-sm bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default AuditTrailPage
