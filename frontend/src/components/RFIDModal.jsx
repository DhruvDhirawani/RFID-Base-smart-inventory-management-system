import { useEffect, useState, useRef } from 'react'
import useWebSocket from '../hooks/useWebSocket'

/**
 * RFID Scan Modal
 * Shows a scanning state, listens for a WebSocket rfid_scan event,
 * and lets the user confirm or retry. Also supports manual RFID entry.
 */
const RFIDModal = ({ isOpen, onClose, onRFIDScanned, title = 'Scan RFID' }) => {
  const [scannedTag, setScannedTag] = useState(null)
  const [manualInput, setManualInput] = useState('')
  const [showManual, setShowManual] = useState(false)
  const { data: wsData, isConnected } = useWebSocket()
  const processedTagRef = useRef(null) // prevent double-trigger on re-render

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setScannedTag(null)
      setManualInput('')
      setShowManual(false)
      processedTagRef.current = null
    }
  }, [isOpen])

  // Listen for WebSocket RFID scans
  useEffect(() => {
    if (
      wsData &&
      wsData.type === 'rfid_scan' &&
      isOpen &&
      !scannedTag &&
      wsData.rfid_tag !== processedTagRef.current
    ) {
      processedTagRef.current = wsData.rfid_tag
      setScannedTag(wsData.rfid_tag)
    }
  }, [wsData, isOpen, scannedTag])

  const handleConfirm = () => {
    if (scannedTag) {
      onRFIDScanned(scannedTag)
      // Parent will close modal after processing
    }
  }

  const handleRetry = () => {
    setScannedTag(null)
    setManualInput('')
    processedTagRef.current = null
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (manualInput.trim()) {
      setScannedTag(manualInput.trim())
      setShowManual(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Connection status badge */}
          <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full mb-5 ${
            isConnected
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></span>
            {isConnected ? 'Reader connected — ready to scan' : 'Reconnecting to reader...'}
          </div>

          {!scannedTag ? (
            /* Scanning state */
            <div className="text-center py-6">
              {/* Animated RFID icon */}
              <div className="relative w-24 h-24 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-50"></div>
                <div className="absolute inset-2 rounded-full bg-blue-200 animate-ping opacity-40" style={{ animationDelay: '0.3s' }}></div>
                <div className="relative w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl shadow-lg">
                  📡
                </div>
              </div>
              <p className="text-slate-700 font-semibold text-lg">Waiting for scan...</p>
              <p className="text-slate-400 text-sm mt-1">
                Hold your RFID tag near the reader
              </p>
            </div>
          ) : (
            /* Tag scanned state */
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-4 animate-fade-in">
                ✅
              </div>
              <p className="text-slate-500 text-sm mb-2">RFID Tag Detected</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mx-auto">
                <p className="font-mono font-bold text-blue-700 text-xl break-all">{scannedTag}</p>
              </div>
              <p className="text-slate-400 text-xs mt-2">Confirm to proceed or retry to scan again</p>
            </div>
          )}

          {/* Manual input section */}
          {showManual && !scannedTag && (
            <form onSubmit={handleManualSubmit} className="mt-4 border-t border-slate-100 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Enter RFID Tag Manually
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. A1B2C3D4"
                  autoFocus
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Use
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors text-sm"
          >
            Cancel
          </button>

          {scannedTag ? (
            <>
              <button
                onClick={handleRetry}
                className="flex-1 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium transition-colors text-sm"
              >
                Retry
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors text-sm shadow-sm"
              >
                Confirm ✓
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowManual(!showManual)}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium transition-colors text-sm"
            >
              {showManual ? 'Hide Manual' : '⌨ Manual Input'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default RFIDModal
