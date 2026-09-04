import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  disposalService,
  goodsReceiptService,
  issueVoucherService,
  itemService,
  materialReturnService,
  materialTransferService,
  requisitionService
  , notificationService,
  stockTakingService
} from '../services'
import { buildNotifications } from '../utils/buildNotifications'

const NotificationContext = createContext(null)

function readKey(userId) {
  return `sms_notif_read_${userId}`
}

function dismissedKey(userId) {
  return `sms_notif_dismissed_${userId}`
}

function loadIds(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function saveIds(key, ids) {
  localStorage.setItem(key, JSON.stringify(ids))
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [readIds, setReadIds] = useState([])
  const [dismissedIds, setDismissedIds] = useState([])
  const [loading, setLoading] = useState(false)

  const userId = user?.id

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setReadIds([])
      setDismissedIds([])
      return
    }
    setReadIds(loadIds(readKey(userId)))
    setDismissedIds(loadIds(dismissedKey(userId)))
  }, [userId])

  const refreshNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [items, grns, reqs, returns, transfers, disposals, vouchers, stockTaking, persisted] = await Promise.all([
        itemService.list(),
        goodsReceiptService.list(),
        requisitionService.list(),
        materialReturnService.list(),
        materialTransferService.list(),
        disposalService.list(),
        issueVoucherService.list(),
        stockTakingService.list(),
        notificationService.list().catch(() => [])
      ])

      const built = buildNotifications(user, { items, grns, reqs, returns, transfers, disposals, vouchers, stockTaking })
      const dismissed = loadIds(dismissedKey(user.id))
      const read = loadIds(readKey(user.id))

      setDismissedIds(dismissed)
      setReadIds(read)
      const persistedGoodsReceiptIds = new Set(
        persisted
          .filter((notification) => notification.entityType === 'goods_receipt' && notification.entityId != null)
          .map((notification) => String(notification.entityId))
      )
      const persistedRequisitionIds = new Set(
        persisted
          .filter((notification) => notification.entityType === 'requisition' && notification.entityId != null)
          .map((notification) => String(notification.entityId))
      )
      const persistedIssueVoucherIds = new Set(
        persisted
          .filter((notification) => notification.entityType === 'issue_voucher' && notification.entityId != null)
          .map((notification) => String(notification.entityId))
      )
      const persistedMaterialTransferIds = new Set(
        persisted
          .filter((notification) => notification.entityType === 'material-transfer' && notification.entityId != null)
          .map((notification) => String(notification.entityId))
      )
      const builtWithoutPersistedGoodsReceipt = built.filter((notification) => {
        const match = String(notification.id).match(/^(?:grn|eval-grn|gate-in)(?:-accepted)?-(\d+)$/)
        if (match && persistedGoodsReceiptIds.has(match[1])) return false
        const requisitionMatch = String(notification.id).match(/^(?:req|dept-approve|dept-approved|req-next)-(\d+)$/)
        if (requisitionMatch && persistedRequisitionIds.has(requisitionMatch[1])) return false
        const voucherMatch = String(notification.id).match(/^(?:voucher-(?:authorize|issue|gate))-(\d+)$/)
        if (voucherMatch && persistedIssueVoucherIds.has(voucherMatch[1])) return false
        const transferMatch = String(notification.id).match(/^transfer-(\d+)$/)
        return !transferMatch || !persistedMaterialTransferIds.has(transferMatch[1])
      })
      const combined = [...persisted, ...builtWithoutPersistedGoodsReceipt].filter((notification, index, all) =>
        all.findIndex((candidate) => String(candidate.id) === String(notification.id)) === index
      )
      setNotifications(
        combined
          .filter((n) => !dismissed.includes(n.id))
          .map((n) => ({ ...n, read: read.includes(n.id) }))
      )
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refreshNotifications()
    const interval = setInterval(refreshNotifications, 15000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshNotifications()
    }
    window.addEventListener('focus', refreshNotifications)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refreshNotifications)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshNotifications])

  const markAsRead = useCallback(
    (id) => {
      if (!userId) return
      setReadIds((prev) => {
        if (prev.includes(id)) return prev
        const next = [...prev, id]
        saveIds(readKey(userId), next)
        return next
      })
      if (Number.isInteger(Number(id))) notificationService.markRead(id).catch(() => { })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    },
    [userId]
  )

  const markAllAsRead = useCallback(() => {
    if (!userId) return
    const allIds = notifications.map((n) => n.id)
    setReadIds((prev) => {
      const next = [...new Set([...prev, ...allIds])]
      saveIds(readKey(userId), next)
      return next
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [notifications, userId])

  const dismissNotification = useCallback(
    (id) => {
      if (!userId) return
      setDismissedIds((prev) => {
        const next = [...new Set([...prev, id])]
        saveIds(dismissedKey(userId), next)
        return next
      })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    },
    [userId]
  )

  const clearAllNotifications = useCallback(() => {
    if (!userId) return
    const allIds = notifications.map((n) => n.id)
    setDismissedIds((prev) => {
      const next = [...new Set([...prev, ...allIds])]
      saveIds(dismissedKey(userId), next)
      return next
    })
    setNotifications([])
  }, [notifications, userId])

  const clearReadNotifications = useCallback(() => {
    if (!userId) return
    const readNotificationIds = notifications.filter((n) => n.read).map((n) => n.id)
    setDismissedIds((prev) => {
      const next = [...new Set([...prev, ...readNotificationIds])]
      saveIds(dismissedKey(userId), next)
      return next
    })
    setNotifications((prev) => prev.filter((n) => !n.read))
  }, [notifications, userId])

  const addNotification = useCallback(
    (title, message, type = 'info', route = '/') => {
      const id = `manual-${Date.now()}`
      setNotifications((prev) => [
        { id, title, message, type, route, read: false, timestamp: new Date() },
        ...prev
      ])
      return id
    },
    []
  )

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loading,
        addNotification,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        clearAllNotifications,
        clearReadNotifications,
        refreshNotifications,
        unreadCount
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
