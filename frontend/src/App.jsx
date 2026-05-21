import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import { Toaster } from 'react-hot-toast'
import CheckinPage from './pages/CheckinPage'
import CheckoutPage from './pages/CheckoutPage'
import CurrentStockPage from './pages/CurrentStockPage'
import ProfitLossPage from './pages/ProfitLossPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AuditTrailPage from './pages/AuditTrailPage'
import SystemPage from './pages/SystemPage'
import './App.css'

// React Query client - 30s stale time for most data
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

function App() {
  // Auth state persisted in localStorage
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('auth_token')
  )

  const handleLogin = () => {
    localStorage.setItem('auth_token', 'true')
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    setIsAuthenticated(false)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/" element={<LoginPage onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/home" element={<HomePage onLogout={handleLogout} />} />
              <Route path="/checkin" element={<CheckinPage onLogout={handleLogout} />} />
              <Route path="/checkout" element={<CheckoutPage onLogout={handleLogout} />} />
              <Route path="/stock" element={<CurrentStockPage onLogout={handleLogout} />} />
              <Route path="/analysis" element={<ProfitLossPage onLogout={handleLogout} />} />
              <Route path="/analytics" element={<AnalyticsPage onLogout={handleLogout} />} />
              <Route path="/audit" element={<AuditTrailPage onLogout={handleLogout} />} />
              <Route path="/system" element={<SystemPage onLogout={handleLogout} />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </>
          )}
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}

export default App
