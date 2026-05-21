import { useQuery } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import { fetchCurrentStock, fetchWorkingCapital } from '../utils/api'

const CurrentStockPage = ({ onLogout }) => {
  const { data: stockData, isLoading: stockLoading, refetch } = useQuery({
    queryKey: ['current-stock'],
    queryFn: fetchCurrentStock,
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  const { data: capitalData } = useQuery({
    queryKey: ['working-capital'],
    queryFn: fetchWorkingCapital,
    refetchInterval: 10000,
  })

  const { data: deadStockData } = useQuery({
    queryKey: ['dead-stock'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/analytics/dead-stock')
      return res.json()
    },
    refetchInterval: 10000,
  })

  // API returns { items: [...], total_items: N, total_quantity: N }
  const stockResponse = stockData?.data || {}
  const stock = stockResponse.items || []
  const totalItems = stockResponse.total_items || 0
  const totalQuantity = stockResponse.total_quantity || 0
  const workingCapital = capitalData?.data?.total_working_capital || 0

  // Group stock by item name
  const groupedByItem = stock.reduce((acc, item) => {
    if (!acc[item.item_name]) acc[item.item_name] = []
    acc[item.item_name].push(item)
    return acc
  }, {})

  // Expiry status helper
  const getExpiryStatus = (daysUntilExpiry) => {
    if (daysUntilExpiry < 0)  return { label: 'Expired',        colorClass: 'bg-red-100 text-red-700',        rowClass: 'bg-red-50' }
    if (daysUntilExpiry === 0) return { label: 'Expires Today',  colorClass: 'bg-red-100 text-red-700',        rowClass: 'bg-red-50' }
    if (daysUntilExpiry <= 7)  return { label: 'Critical',       colorClass: 'bg-red-100 text-red-700',        rowClass: 'bg-red-50' }
    if (daysUntilExpiry <= 15) return { label: 'Expiring Soon',  colorClass: 'bg-amber-100 text-amber-700',   rowClass: 'bg-amber-50' }
    return                            { label: 'Good',            colorClass: 'bg-green-100 text-green-700',   rowClass: '' }
  }

  // Calculate Expiry Timeline stats
  const expiryTimeline = {
    red: stock.filter(item => item.days_until_expiry < 15),
    yellow: stock.filter(item => item.days_until_expiry >= 15 && item.days_until_expiry <= 30),
    green: stock.filter(item => item.days_until_expiry > 30)
  }

  const deadStock = deadStockData || []

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onLogout={onLogout} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Current Stock</h1>
            <p className="text-slate-500 mt-1">Live view of all items currently in inventory</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <p className="text-slate-500 text-sm font-medium">Total Lots</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{totalItems}</p>
            <p className="text-xs text-slate-400 mt-1">unique RFID batches</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <p className="text-slate-500 text-sm font-medium">Total Quantity</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">{totalQuantity}</p>
            <p className="text-xs text-slate-400 mt-1">units in stock</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <p className="text-slate-500 text-sm font-medium">Working Capital</p>
            <p className="text-3xl font-bold text-violet-600 mt-2">₹{workingCapital.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1">total invested</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <p className="text-slate-500 text-sm font-medium">Avg Value / Lot</p>
            <p className="text-3xl font-bold text-orange-500 mt-2">
              ₹{totalItems > 0 ? (workingCapital / totalItems).toFixed(2) : '0.00'}
            </p>
            <p className="text-xs text-slate-400 mt-1">per RFID batch</p>
          </div>
        </div>

        {/* Summary by Item Cards */}
        {Object.keys(groupedByItem).length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-700 mb-3">Summary by Item</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(groupedByItem).map(([itemName, lots]) => {
                const totalQty = lots.reduce((s, l) => s + l.quantity, 0)
                const totalVal = lots.reduce((s, l) => s + l.quantity * l.purchase_price, 0)
                const nearExpiry = lots.filter(l => l.days_until_expiry <= 15 && l.days_until_expiry >= 0).length
                return (
                  <div key={itemName} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="font-semibold text-slate-800 text-sm mb-3 truncate">{itemName}</h3>
                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Lots</span><span className="font-semibold text-slate-800">{lots.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Qty</span><span className="font-semibold text-slate-800">{totalQty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Value</span><span className="font-semibold text-violet-600">₹{totalVal.toFixed(2)}</span>
                      </div>
                      {nearExpiry > 0 && (
                        <div className="flex justify-between">
                          <span>Near Expiry</span>
                          <span className="font-semibold text-amber-600">{nearExpiry} lots ⚠</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Stock Detail Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Stock Details
              {stock.length > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-400">({stock.length} lots)</span>
              )}
            </h2>
          </div>

          {stockLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-slate-500">Loading stock data...</p>
            </div>
          ) : stock.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-5xl mb-3">📦</div>
              <p className="font-medium">No items in stock</p>
              <p className="text-sm mt-1">Check in some items to see them here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">RFID Tag</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Price</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Value</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Expiry Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Days Left</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Checked In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stock.map((item, idx) => {
                    const expiry = getExpiryStatus(item.days_until_expiry)
                    return (
                      <tr key={idx} className={`hover:bg-slate-50 transition-colors ${expiry.rowClass}`}>
                        <td className="px-5 py-4 text-sm font-medium text-slate-800">{item.item_name}</td>
                        <td className="px-5 py-4 text-sm font-mono text-blue-600">{item.rfid_tag}</td>
                        <td className="px-5 py-4 text-sm text-slate-700 font-semibold">{item.quantity}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">₹{item.purchase_price.toFixed(2)}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                          ₹{(item.quantity * item.purchase_price).toFixed(2)}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {new Date(item.expiry_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${expiry.colorClass}`}>
                            {item.days_until_expiry < 0
                              ? `${Math.abs(item.days_until_expiry)}d ago`
                              : `${item.days_until_expiry}d`}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${expiry.colorClass}`}>
                            {expiry.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          {new Date(item.checked_in_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expiry Timeline & Dead Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Expiry Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Expiry Timeline</h2>
            </div>
            <div className="p-6 flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center shrink-0 border-2 border-red-200">
                  <span className="text-red-700 font-bold text-xl">{expiryTimeline.red.length}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-red-700">&lt; 15 Days (Critical)</h3>
                  <p className="text-sm text-slate-500">Requires immediate attention or checkout.</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center shrink-0 border-2 border-amber-200">
                  <span className="text-amber-700 font-bold text-xl">{expiryTimeline.yellow.length}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-700">15 - 30 Days (Warning)</h3>
                  <p className="text-sm text-slate-500">Monitor closely, consider promotions.</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shrink-0 border-2 border-green-200">
                  <span className="text-green-700 font-bold text-xl">{expiryTimeline.green.length}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-green-700">&gt; 30 Days (Safe)</h3>
                  <p className="text-sm text-slate-500">Healthy stock levels.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dead Stock */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Dead Stock (&gt; 30 days)</h2>
              <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded-full text-xs font-semibold">
                {deadStock.length} items
              </span>
            </div>
            <div className="overflow-y-auto max-h-[300px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-3">Item Name</th>
                    <th className="px-6 py-3">RFID</th>
                    <th className="px-6 py-3">Days in Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {deadStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium">{item.item_name}</td>
                      <td className="px-6 py-3 font-mono text-blue-600 text-xs">{item.rfid_tag}</td>
                      <td className="px-6 py-3">
                        <span className="text-red-600 font-medium">{item.days_in_stock} days</span>
                      </td>
                    </tr>
                  ))}
                  {deadStock.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No dead stock found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default CurrentStockPage
