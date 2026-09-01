import { Menu, LogOut, ChevronDown, Bell, X, CheckCheck, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { initials, formatTimeAgo } from '../../utils/formatters'

const TYPE_STYLES = {
  info: 'bg-info-50 text-info-700 border-info-50',
  warning: 'bg-warning-50 text-warning-700 border-warning-50',
  success: 'bg-success-50 text-success-700 border-success-50',
  error: 'bg-danger-50 text-danger-700 border-danger-50'
}

const TYPE_DOT = {
  info: 'bg-info-500',
  warning: 'bg-warning-500',
  success: 'bg-success-500',
  error: 'bg-danger-500'
}

export default function Topbar({ onMenuClick, title }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const {
    unreadCount,
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
    clearReadNotifications,
    refreshNotifications
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationRef = useRef(null)
  const profileRef = useRef(null)

  useEffect(() => {
    function closeMenus(event) {
      if (!notificationRef.current?.contains(event.target)) {
        setShowNotifications(false)
      }
      if (!profileRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeMenus)
    return () => document.removeEventListener('pointerdown', closeMenus)
  }, [])

  const readCount = notifications.filter((n) => n.read).length

  function openNotifications() {
    setOpen(false)
    setShowNotifications((v) => {
      if (!v) refreshNotifications()
      return !v
    })
  }

  function handleNotificationClick(notif) {
    markAsRead(notif.id)
    if (notif.route) {
      navigate(notif.route)
      setShowNotifications(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-ink-100 bg-white/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        {title && <h2 className="hidden text-sm font-semibold text-ink-600 sm:block">{title}</h2>}
      </div>

      <div className="flex items-center gap-2">
        <div ref={notificationRef} className="relative">
          <button
            onClick={openNotifications}
            aria-label="Notifications"
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          >
            <span className="relative inline-flex">
              <Bell size={20} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-danger-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-danger-500/20"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
          </button>

          {showNotifications && (
            <>
              <div className="absolute right-0 z-20 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-100 bg-white shadow-lg overflow-hidden">
                <div className="border-b border-ink-100 px-4 py-3 bg-gradient-to-r from-brand-50/60 to-white">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-ink-900">Notifications</h3>
                      <p className="text-xs text-ink-500">
                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      >
                        <CheckCheck size={14} />
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loading && notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-ink-500">Loading notifications...</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <Bell size={28} className="mx-auto mb-2 text-ink-300" />
                      <p className="text-sm font-medium text-ink-700">No notifications</p>
                      <p className="mt-1 text-xs text-ink-500">Alerts for your role will appear here.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`group flex items-start gap-2 border-b border-ink-50 px-4 py-3 transition-colors hover:bg-ink-50 ${!notif.read ? 'bg-brand-50/40' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(notif)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!notif.read ? TYPE_DOT[notif.type] || TYPE_DOT.info : 'bg-transparent'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm text-ink-900">{notif.title}</p>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_STYLES[notif.type] || TYPE_STYLES.info}`}>
                                {notif.type}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-ink-600 line-clamp-2">{notif.message}</p>
                            <p className="mt-2 text-xs text-ink-400">{formatTimeAgo(notif.timestamp)}</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          onClick={(e) => {
                            e.stopPropagation()
                            dismissNotification(notif.id)
                          }}
                          className="shrink-0 rounded-md p-1.5 text-ink-400 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-600 group-hover:opacity-100"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="flex items-center justify-between gap-2 border-t border-ink-100 bg-ink-50 px-3 py-2">
                    {readCount > 0 ? (
                      <button
                        type="button"
                        onClick={clearReadNotifications}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-ink-600 hover:bg-white hover:text-ink-800"
                      >
                        <Trash2 size={13} />
                        Clear read
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        clearAllNotifications()
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-danger-500 hover:bg-danger-50 hover:text-danger-700"
                    >
                      <Trash2 size={13} />
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div ref={profileRef} className="relative">
          <button
            onClick={() => {
              setShowNotifications(false)
              setOpen((v) => !v)
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-ink-50 transition-colors active:bg-ink-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-md">
              {initials(user?.name)}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight text-ink-900">{user?.name}</p>
              <p className="text-xs leading-tight text-ink-500">{user?.role}</p>
            </div>
            <ChevronDown size={16} className="text-ink-400" />
          </button>
          {open && (
            <>
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-ink-100 bg-white shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-ink-100 bg-gradient-to-r from-ink-50 to-white sm:hidden">
                  <p className="text-sm font-semibold text-ink-900">{user?.name}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{user?.role}</p>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    logout()
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-none px-4 py-3 text-sm font-medium text-danger-500 hover:bg-danger-50 transition-colors"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
