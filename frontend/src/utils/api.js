import axios from 'axios'

const API_BASE_URL = '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auth endpoints
export const login = (username, password) =>
  apiClient.post('/login', { username, password })

// Item endpoints
export const fetchItems = () => apiClient.get('/items')

// Checkin endpoints
export const createCheckin = (checkinData) =>
  apiClient.post('/checkin', checkinData)

export const fetchCheckins = (page = 1) =>
  apiClient.get('/checkins', { params: { page } })

export const fetchCheckinsCount = () =>
  apiClient.get('/checkins/count')

export const fetchCheckinByRFID = (rfidTag) =>
  apiClient.get(`/checkin/${rfidTag}`)

// Checkout endpoints
export const createCheckout = (checkoutData) =>
  apiClient.post('/checkout', checkoutData)

export const fetchCheckouts = (page = 1) =>
  apiClient.get('/checkouts', { params: { page } })

export const fetchCheckoutsCount = () =>
  apiClient.get('/checkouts/count')

// Stock endpoints
export const fetchCurrentStock = () =>
  apiClient.get('/current-stock')

export const fetchWorkingCapital = () =>
  apiClient.get('/working-capital')

// Profit/Loss endpoints
export const fetchProfitLoss = () =>
  apiClient.get('/profit-loss')

// Notification endpoints
export const fetchNotifications = () =>
  apiClient.get('/notifications')

export const markNotificationAsRead = (notificationId) =>
  apiClient.patch(`/notifications/${notificationId}`)

// Health check
export const healthCheck = () => apiClient.get('/health')

export default apiClient
