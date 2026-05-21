import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'

/**
 * WebSocket hook with auto-reconnect + exponential backoff.
 * Connects directly to the FastAPI backend WebSocket endpoint.
 * Retries automatically on disconnect.
 */

// Use relative path to go through Vite proxy, avoiding strict cross-origin 403s from Uvicorn's websockets
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/rfid`

export const useWebSocket = (url = WS_URL) => {
  const [data, setData]           = useState(null)
  const [isConnected, setConnected] = useState(false)
  const wsRef                     = useRef(null)
  const reconnectTimer            = useRef(null)
  const delayRef                  = useRef(1000)   // starts at 1 s, max 30 s
  const mountedRef                = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return }
        setConnected(true)
        delayRef.current = 1000   // reset backoff
        toast.success('Scanner Connected', { id: 'ws-status' })
      }

      ws.onmessage = (ev) => {
        if (!mountedRef.current) return
        try { 
          const parsed = JSON.parse(ev.data)
          setData(parsed) 
          if (parsed.rfid_tag) {
            toast(`Scanned: ${parsed.rfid_tag}`, { icon: '📡', id: 'ws-scan' })
          }
        } catch { /* ignore bad frames */ }
      }

      ws.onerror  = () => { /* onclose fires right after; handled there */ }

      ws.onclose  = () => {
        if (!mountedRef.current) return
        // Use a functional update or ref to check previous state if needed, but we can check the state directly if we track it carefully, 
        // however, here we will just toast error directly as we know it closed.
        toast.error('Scanner Disconnected', { id: 'ws-status' })
        setConnected(false)
        wsRef.current = null
        // exponential back-off: 1 s → 1.5 s → 2.25 s … capped at 30 s
        reconnectTimer.current = setTimeout(() => {
          if (!mountedRef.current) return
          delayRef.current = Math.min(delayRef.current * 1.5, 30_000)
          connect()
        }, delayRef.current)
      }

      wsRef.current = ws
    } catch {
      // e.g. invalid URL — just retry after a delay
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, delayRef.current)
    }
  }, [url])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { data, isConnected, send }
}

export default useWebSocket
