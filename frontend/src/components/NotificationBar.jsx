import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchNotifications, markNotificationAsRead } from '../utils/api'

const typeConfig = {
  low_stock:   { icon: '📉', label: 'Low Stock',    bar: 'border-l-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-800' },
  near_expiry: { icon: '⏰', label: 'Near Expiry',  bar: 'border-l-orange-400', bg: 'bg-orange-50', text: 'text-orange-800' },
  expired:     { icon: '❌', label: 'Expired',      bar: 'border-l-red-500',    bg: 'bg-red-50',    text: 'text-red-800' },
}

const getConfig = (type) => typeConfig[type] || { icon: 'ℹ️', label: 'Info', bar: 'border-l-blue-400', bg: 'bg-blue-50', text: 'text-blue-800' }

const NotificationBar = () => {
  const queryClient = useQueryClient()

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 5000,
  })

  const notifications = notificationsData?.data || []
  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleMarkRead = async (id) => {
    try {
      await markNotificationAsRead(id)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    } catch (e) {
      console.error('Failed to mark notification as read:', e)
    }
  }

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read)
    await Promise.all(unread.map((n) => markNotificationAsRead(n.id).catch(() => {})))
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  if (notifications.length === 0) {
    return (
      <div>
        <h3 className="text-base font-semibold text-slate-800 mb-4">Notifications</h3>
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <div className="text-4xl mb-2">✅</div>
          <p className="font-medium text-sm">All clear — no alerts</p>
          <p className="text-xs mt-1">Notifications appear here for low stock and expiry warnings</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-slate-800">Notifications</h3>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {notifications.map((notification) => {
          const config = getConfig(notification.type)
          return (
            <div
              key={notification.id}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-l-4 transition-all cursor-pointer ${
                config.bar
              } ${
                notification.is_read
                  ? 'bg-slate-50 opacity-60'
                  : config.bg
              }`}
              onClick={() => {
                if (!notification.is_read) handleMarkRead(notification.id)
              }}
            >
              <span className="text-lg shrink-0 mt-0.5">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold ${notification.is_read ? 'text-slate-500' : config.text}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(notification.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-0.5 leading-snug">{notification.message}</p>
                {!notification.is_read && (
                  <p className="text-xs text-slate-400 mt-1">Click to mark as read</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default NotificationBar
