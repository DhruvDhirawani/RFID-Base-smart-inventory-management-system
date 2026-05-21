import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import { toast } from 'react-hot-toast'
import RFIDModal from '../components/RFIDModal'
import { fetchCheckouts, fetchCheckoutsCount, fetchCheckinByRFID, createCheckout } from '../utils/api'

const CheckoutPage = ({ onLogout }) => {
  const queryClient = useQueryClient()
  const [showRFIDModal, setShowRFIDModal] = useState(false)
  const [page, setPage] = useState(1)
  const [scannedRFID, setScannedRFID] = useState(null)
  const [sellingPrice, setSellingPrice] = useState('')
  const [error, setError] = useState('')
  const [checkinDetails, setCheckinDetails] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)

  const { data: checkoutsData, isLoading: checkoutsLoading } = useQuery({
    queryKey: ['checkouts', page],
    queryFn: () => fetchCheckouts(page),
  })
  const { data: countData } = useQuery({ queryKey: ['checkoutsCount'], queryFn: fetchCheckoutsCount })

  const createCheckoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkouts'] })
      queryClient.invalidateQueries({ queryKey: ['checkoutsCount'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['current-stock'] })
      queryClient.invalidateQueries({ queryKey: ['working-capital'] })
      queryClient.invalidateQueries({ queryKey: ['profit-loss'] })
      resetAll()
      toast.success('Checkout successful!')
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Failed to process checkout. Please try again.')
      toast.error('Checkout failed.')
    },
  })

  const checkouts = checkoutsData?.data || []
  const totalCheckouts = countData?.data?.count || 0
  const totalPages = Math.ceil(totalCheckouts / 10)

  const handleRFIDScanned = async (rfidTag) => {
    setError('')
    setLookupLoading(true)
    setShowRFIDModal(false)
    try {
      const response = await fetchCheckinByRFID(rfidTag)
      setScannedRFID(rfidTag)
      setCheckinDetails(response.data)
      setShowForm(true)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'No active stock found for this RFID tag. The item may already be checked out.'
      )
      setScannedRFID(null)
      setCheckinDetails(null)
      setShowForm(false)
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!checkinDetails || !sellingPrice) {
      setError('Please enter a selling price.')
      return
    }
    createCheckoutMutation.mutate({
      checkin_id: checkinDetails.id,
      selling_price: parseFloat(sellingPrice),
    })
  }

  const resetAll = () => {
    setScannedRFID(null)
    setCheckinDetails(null)
    setSellingPrice('')
    setError('')
    setShowForm(false)
  }

  // Estimated profit preview (before holding cost)
  const daysSinceCheckin = checkinDetails
    ? Math.max(0, Math.floor((Date.now() - new Date(checkinDetails.checked_in_at).getTime()) / 86400000))
    : 0

  const estimatedHoldingCost = checkinDetails
    ? (checkinDetails.item?.holding_cost_per_day || 0) * daysSinceCheckin * checkinDetails.quantity
    : 0

  const estimatedProfit =
    checkinDetails && sellingPrice
      ? (parseFloat(sellingPrice) * checkinDetails.quantity) - (checkinDetails.purchase_price * checkinDetails.quantity)
      : null

  const netProfit = estimatedProfit !== null ? estimatedProfit - estimatedHoldingCost : null

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onLogout={onLogout} />

      {/* RFID Scan Modal */}
      <RFIDModal
        isOpen={showRFIDModal}
        onClose={() => setShowRFIDModal(false)}
        onRFIDScanned={handleRFIDScanned}
        title="Scan RFID — Checkout"
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Checkout</h1>
            <p className="text-slate-500 mt-1">Scan an RFID tag to process a checkout and record the sale</p>
          </div>
          <button
            onClick={() => { resetAll(); setShowRFIDModal(true) }}
            disabled={lookupLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            {lookupLoading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            ) : <span className="text-lg">📤</span>}
            {lookupLoading ? 'Looking up…' : 'New Checkout'}
          </button>
        </div>

        {/* Error banner */}
        {error && !showForm && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl text-sm mb-5 flex items-start gap-2 animate-fade-in">
            <span className="text-lg mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold">Lookup failed</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Checkout Form */}
        {showForm && checkinDetails && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">Checkout Details</h2>
              <button onClick={resetAll} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {/* RFID tag */}
            <div className="flex items-center gap-3 mb-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <span className="text-2xl">📡</span>
              <div>
                <p className="text-xs text-emerald-700 font-medium">RFID Tag — Active Stock Found</p>
                <p className="font-mono font-bold text-emerald-800 text-lg">{scannedRFID}</p>
              </div>
              <button
                onClick={() => { setShowForm(false); setScannedRFID(null); setCheckinDetails(null); setShowRFIDModal(true) }}
                className="ml-auto text-xs text-emerald-700 hover:text-emerald-900 font-medium border border-emerald-300 px-3 py-1 rounded-lg"
              >
                Rescan
              </button>
            </div>

            {/* Checkin details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Item', value: checkinDetails.item?.name },
                { label: 'Quantity', value: checkinDetails.quantity },
                { label: 'Buy Price/Unit', value: `₹${checkinDetails.purchase_price?.toFixed(2)}` },
                { label: 'Expiry Date', value: checkinDetails.expiry_date ? new Date(checkinDetails.expiry_date).toLocaleDateString('en-IN') : '—' },
                { label: 'Checked In', value: new Date(checkinDetails.checked_in_at).toLocaleDateString('en-IN') },
                { label: 'Days Held', value: `${daysSinceCheckin} days` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Selling price form */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Selling Price Per Unit (₹) *
                </label>
                <input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="Enter selling price"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* P&L Preview */}
              {netProfit !== null && sellingPrice && (
                <div className={`rounded-xl px-4 py-4 mb-4 border ${
                  netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                }`}>
                  <p className="text-xs font-medium text-slate-500 mb-2">Estimated Profit / Loss</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-2">
                    <div>
                      <p>Revenue</p>
                      <p className="font-semibold text-slate-800">₹{parseFloat(sellingPrice).toFixed(2)}</p>
                    </div>
                    <div>
                      <p>Holding Cost</p>
                      <p className="font-semibold text-red-600">-₹{estimatedHoldingCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p>Net P&L</p>
                      <p className={`font-bold text-base ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {netProfit >= 0 ? '+' : ''}₹{netProfit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Final values calculated server-side on submit</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCheckoutMutation.isPending || !sellingPrice}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-semibold transition-colors shadow-sm"
                >
                  {createCheckoutMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Processing...
                    </span>
                  ) : '✓ Confirm Checkout'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Checkout History Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">
              Checkout History
              {totalCheckouts > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-400">({totalCheckouts} total)</span>
              )}
            </h2>
          </div>

          {checkoutsLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-slate-500">Loading...</p>
            </div>
          ) : checkouts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-5xl mb-3">📤</div>
              <p className="font-medium">No checkouts yet</p>
              <p className="text-sm mt-1">Completed checkouts will appear here</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Item', 'RFID', 'Buy Price/Unit', 'Sell Price/Unit', 'Days', 'Total Profit/Loss', 'Date'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {checkouts.map((checkout) => (
                      <tr key={checkout.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-slate-800">
                          {checkout.checkin?.item?.name || '—'}
                        </td>
                        <td className="px-5 py-4 text-sm font-mono text-blue-600">
                          {checkout.checkin?.rfid_tag || '—'}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          ₹{checkout.checkin?.purchase_price?.toFixed(2) || '—'}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700 font-medium">
                          ₹{checkout.selling_price?.toFixed(2)}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{checkout.days_held}</td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                            checkout.profit_loss >= 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {checkout.profit_loss >= 0 ? '+' : ''}₹{checkout.profit_loss?.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          {new Date(checkout.checked_out_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage
