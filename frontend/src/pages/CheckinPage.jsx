import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import Navbar from '../components/Navbar'
import RFIDModal from '../components/RFIDModal'
import { fetchItems, fetchCheckins, createCheckin, fetchCheckinsCount, fetchCheckinByRFID } from '../utils/api'

const CheckinPage = ({ onLogout }) => {
  const queryClient = useQueryClient()
  const [showRFIDModal, setShowRFIDModal] = useState(false)
  const [page, setPage] = useState(1)
  const [scannedRFID, setScannedRFID] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [rfidConflict, setRfidConflict] = useState(null)  // existing stock lot if duplicate
  const [rfidChecking, setRfidChecking] = useState(false)  // spinner while checking
  const navigate = useNavigate()

  // Form state
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [expiryDays, setExpiryDays] = useState('')
  const [note, setNote] = useState('')
  const [submitError, setSubmitError] = useState('')

  // Fetch items and checkin data
  const { data: itemsData } = useQuery({ queryKey: ['items'], queryFn: fetchItems })
  const { data: checkinsData, isLoading: checkinsLoading } = useQuery({
    queryKey: ['checkins', page],
    queryFn: () => fetchCheckins(page),
  })
  const { data: countData } = useQuery({ queryKey: ['checkinsCount'], queryFn: fetchCheckinsCount })

  // Create checkin mutation
  const createCheckinMutation = useMutation({
    mutationFn: createCheckin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkins'] })
      queryClient.invalidateQueries({ queryKey: ['checkinsCount'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['current-stock'] })
      queryClient.invalidateQueries({ queryKey: ['working-capital'] })
      resetAll()
      toast.success('Checkin successful!')
    },
    onError: (err) => {
      console.error('Checkin failed:', err)
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail
        if (Array.isArray(detail)) {
          setSubmitError(detail.map(d => d.msg).join(', '))
        } else if (typeof detail === 'string') {
          setSubmitError(detail)
        } else {
          setSubmitError(JSON.stringify(detail))
        }
      } else {
        setSubmitError(err.message || 'Failed to save checkin. Please try again.')
      }
      toast.error('Checkin failed.')
    },
  })

  const items = itemsData?.data || []
  const checkins = checkinsData?.data || []
  const totalCheckins = countData?.data?.count || 0
  const totalPages = Math.ceil(totalCheckins / 10)

  const selectedItem = items.find((i) => i.id === parseInt(itemId))

  const handleRFIDScanned = async (rfidTag) => {
    setScannedRFID(rfidTag)
    setShowRFIDModal(false)
    setSubmitError('')
    setRfidConflict(null)
    setShowForm(false)
    setRfidChecking(true)

    try {
      // Check if this RFID tag already has an active lot in stock
      const res = await fetchCheckinByRFID(rfidTag)
      if (res.data) {
        // Tag is already in stock — block checkin and show conflict card
        setRfidConflict(res.data)
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // 404 = tag is free → proceed to form
        setShowForm(true)
      } else {
        // Unknown error — still allow the form (backend will catch it)
        setShowForm(true)
      }
    } finally {
      setRfidChecking(false)
    }
  }

  const handleItemChange = (e) => {
    setItemId(e.target.value)
    const item = items.find((i) => i.id === parseInt(e.target.value))
    if (item) setExpiryDays(String(item.default_expiry_days))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    if (!scannedRFID || !itemId || !quantity || !purchasePrice || !expiryDays) {
      setSubmitError('Please fill in all required fields.')
      return
    }
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays))

    createCheckinMutation.mutate({
      rfid_tag: scannedRFID,
      item_id: parseInt(itemId),
      quantity: parseInt(quantity),
      purchase_price: parseFloat(purchasePrice),
      expiry_date: expiryDate.toISOString().split('T')[0],
      note: note.trim() || null,
    })
  }

  const resetAll = () => {
    setScannedRFID(null)
    setShowForm(false)
    setRfidConflict(null)
    setRfidChecking(false)
    setItemId('')
    setQuantity('')
    setPurchasePrice('')
    setExpiryDays('')
    setNote('')
    setSubmitError('')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onLogout={onLogout} />

      {/* RFID Scan Modal */}
      <RFIDModal
        isOpen={showRFIDModal}
        onClose={() => setShowRFIDModal(false)}
        onRFIDScanned={handleRFIDScanned}
        title="Scan RFID — Checkin"
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Checkin</h1>
            <p className="text-slate-500 mt-1">Scan an RFID tag to register items into stock</p>
          </div>
          <button
            onClick={() => { resetAll(); setShowRFIDModal(true) }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            <span className="text-lg">📥</span> New Checkin
          </button>
        </div>

        {/* Checking spinner */}
        {rfidChecking && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 mb-6 flex items-center gap-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0"></div>
            <div>
              <p className="font-semibold text-slate-700">Checking stock...</p>
              <p className="text-sm text-slate-400 font-mono mt-0.5">{scannedRFID}</p>
            </div>
          </div>
        )}

        {/* ── Conflict card: tag already in stock ── */}
        {rfidConflict && scannedRFID && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 mb-6 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="text-3xl flex-shrink-0">🔒</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-800 mb-1">RFID Tag Already In Stock</h3>
                <p className="text-sm text-amber-700 mb-4">
                  This tag is currently assigned to an active stock lot. Check it out first before reusing it.
                </p>

                {/* Conflict detail card */}
                <div className="bg-white border border-amber-200 rounded-xl p-4 mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">RFID Tag</span>
                    <span className="font-mono font-bold text-blue-700">{scannedRFID}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Item</span>
                    <span className="font-semibold text-slate-800">{rfidConflict.item?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quantity</span>
                    <span className="font-semibold text-slate-800">{rfidConflict.quantity} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Purchase Price</span>
                    <span className="font-semibold text-slate-800">₹{rfidConflict.purchase_price?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Checked In</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(rfidConflict.checked_in_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetAll}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => navigate('/checkout')}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
                  >
                    📤 Go to Checkout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Checkin Form (shown after RFID scanned and confirmed free) */}
        {showForm && scannedRFID && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">New Checkin Details</h2>
              <button onClick={resetAll} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {/* RFID Tag display */}
            <div className="flex items-center gap-3 mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <span className="text-2xl">📡</span>
              <div>
                <p className="text-xs text-blue-600 font-medium">RFID Tag</p>
                <p className="font-mono font-bold text-blue-800 text-lg">{scannedRFID}</p>
              </div>
              <button
                onClick={() => { setScannedRFID(null); setShowForm(false); setShowRFIDModal(true) }}
                className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-300 px-3 py-1 rounded-lg"
              >
                Rescan
              </button>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                ⚠️ {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Item */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Item *</label>
                  <select
                    value={itemId}
                    onChange={handleItemChange}
                    required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select an item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  {selectedItem && (
                    <p className="text-xs text-slate-400 mt-1">
                      Threshold: {selectedItem.low_stock_threshold} units · Default expiry: {selectedItem.default_expiry_days} days · Holding cost: ₹{selectedItem.holding_cost_per_day}/day
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quantity *</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    required
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Purchase Price */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Purchase Price Per Unit (₹) *</label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 250.00"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Expiry Days */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expiry in Days</label>
                  <input
                    type="number"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    min="1"
                    placeholder="e.g. 365"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Auto-filled from item default. Edit if needed.</p>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Note (Optional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Supplier batch, lot info…"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCheckinMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-semibold transition-colors shadow-sm"
                >
                  {createCheckinMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      Saving...
                    </span>
                  ) : '✓ Checkin'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Checkin History Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Checkin History
              {totalCheckins > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-400">({totalCheckins} total)</span>
              )}
            </h2>
          </div>

          {checkinsLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-slate-500">Loading...</p>
            </div>
          ) : checkins.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-5xl mb-3">📥</div>
              <p className="font-medium">No checkins yet</p>
              <p className="text-sm mt-1">Click "New Checkin" to add your first item</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {['RFID Tag', 'Item', 'Qty', 'Buy Price/Unit', 'Expiry Date', 'Date', 'Status'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {checkins.map((checkin) => (
                      <tr key={checkin.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 text-sm font-mono text-blue-600">{checkin.rfid_tag}</td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-800">{checkin.item?.name || '—'}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{checkin.quantity}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">₹{checkin.purchase_price?.toFixed(2)}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {checkin.expiry_date ? new Date(checkin.expiry_date).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          {new Date(checkin.checked_in_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                            checkin.is_checked_out
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {checkin.is_checked_out ? '✓ Checked Out' : '📦 In Stock'}
                          </span>
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

export default CheckinPage
