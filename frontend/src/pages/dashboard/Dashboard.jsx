import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileText,
  History,
  Landmark,
  MapPinned,
  PackageCheck,
  Repeat,
  ScrollText,
  Send,
  Shield,
  ShieldCheck,
  Tags,
  TrendingUp,
  Trash2,
  Undo2,
  Users,
  Wallet,
  XCircle
} from 'lucide-react'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'
import {
  auditService,
  disposalService,
  fixedAssetService,
  goodsReceiptService,
  itemService,
  materialReturnService,
  materialTransferService,
  reconciliationService,
  requisitionService,
  issueVoucherService,
  userCardService,
  stockTransactionService,
  stockTakingService,
  reportService
} from '../../services'
import { formatCurrency, formatDate, formatNumber, formatTimeAgo } from '../../utils/formatters'
import {
  ROLES,
  GRN_STATUS,
  REQUISITION_STATUS,
  SIV_STATUS,
  TRANSFER_STATUS,
  RETURN_STATUS,
  DISPOSAL_STATUS
} from '../../utils/constants'

const MAX_APPROVAL_ROWS = 6

// Each role loads only the services that feed its dashboard cards. Keys here map
// 1:1 to the state setters below, so a role only pays for the data it renders.
const DASHBOARD_DATA_BY_ROLE = {
  [ROLES.ADMIN]: {
    items: itemService,
    grns: goodsReceiptService,
    reqs: requisitionService,
    returns: materialReturnService,
    transfers: materialTransferService,
    disposals: disposalService,
    transactions: stockTransactionService,
    vouchers: issueVoucherService,
    audit: auditService
  },
  [ROLES.PAO]: {
    items: itemService,
    grns: goodsReceiptService,
    reqs: requisitionService,
    transfers: materialTransferService,
    disposals: disposalService,
    assets: fixedAssetService,
    reconciliation: reconciliationService,
    audit: auditService
  },
  [ROLES.STORE_HEAD]: {
    items: itemService,
    grns: goodsReceiptService,
    reqs: requisitionService,
    vouchers: issueVoucherService,
    transactions: stockTransactionService
  },
  [ROLES.STOREKEEPER]: {
    items: itemService,
    grns: goodsReceiptService,
    reqs: requisitionService,
    returns: materialReturnService,
    transfers: materialTransferService,
    transactions: stockTransactionService,
    vouchers: issueVoucherService
  },
  [ROLES.STOCK_CLERK]: {
    items: itemService,
    transactions: stockTransactionService,
    reconciliation: reconciliationService,
    stockTaking: stockTakingService
  },
  [ROLES.TEC]: {
    grns: goodsReceiptService
  },
  [ROLES.DEPT_HEAD]: {
    items: itemService,
    reqs: requisitionService,
    returns: materialReturnService,
    userCards: userCardService
  },
  [ROLES.ACCOUNTANT]: {
    items: itemService,
    grns: goodsReceiptService,
    vouchers: issueVoucherService,
    returns: materialReturnService,
    transactions: stockTransactionService,
    reconciliation: reconciliationService
  },
  [ROLES.SECURITY]: {
    grns: goodsReceiptService,
    vouchers: issueVoucherService
  }
}

function sortNewestFirst(rows = []) {
  return [...rows].sort((a, b) => new Date(b.date || b.receivedDate || b.createdAt || 0) - new Date(a.date || a.receivedDate || a.createdAt || 0))
}

function isToday(value) {
  if (!value) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function getUserStoreName(user) {
  return user?.store || user?.assignedStore || user?.departmentStore || null
}

function getRoleSubtext(user, storeName) {
  switch (user?.role) {
    case ROLES.ADMIN:
      return "Here's what's happening across your stores today."
    case ROLES.PAO:
      return "Here's what needs your approval and attention today."
    case ROLES.STORE_HEAD:
      return storeName ? `Here's what's happening at ${storeName} today.` : "Store association is not yet linked to this account, so this view shows the current company overview until that data is updated."
    case ROLES.STOREKEEPER:
      return "Here's your task list for today."
    case ROLES.STOCK_CLERK:
      return "Here's the latest stock activity."
    case ROLES.TEC:
      return 'Materials waiting for your evaluation.'
    case ROLES.DEPT_HEAD:
      return "Here's the status of your department's requests and approvals."
    case ROLES.ACCOUNTANT:
      return "Here's the current financial position of inventory."
    case ROLES.SECURITY:
      return 'Verify gate passes for materials entering and leaving the premises.'
    default:
      return "Here's what's happening across your stores today."
  }
}

function renderValueBar(item, maxValue) {
  const pct = maxValue > 0 ? Math.round((item.value / maxValue) * 100) : 0
  return (
    <div key={item.label}>
      <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
        <span className="truncate">{item.label}</span>
        <span>{formatCurrency(item.value)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function renderStatCardLink(to, label, value, icon, tone, hint) {
  return (
    <Link key={label} to={to} className="block">
      <StatCard label={label} value={value} icon={icon} tone={tone} hint={hint} />
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [grns, setGrns] = useState([])
  const [reqs, setReqs] = useState([])
  const [returns, setReturns] = useState([])
  const [transfers, setTransfers] = useState([])
  const [disposals, setDisposals] = useState([])
  const [transactions, setTransactions] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [userCards, setUserCards] = useState([])
  const [assets, setAssets] = useState([])
  const [variances, setVariances] = useState([])
  const [stockTaking, setStockTaking] = useState([])
  const [audit, setAudit] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dataSources = DASHBOARD_DATA_BY_ROLE[user?.role] || {}
    const entries = Object.entries(dataSources)

    setItems([])
    setGrns([])
    setReqs([])
    setReturns([])
    setTransfers([])
    setDisposals([])
    setTransactions([])
    setVouchers([])
    setUserCards([])
    setAssets([])
    setVariances([])
    setStockTaking([])
    setAudit([])
    setSummary(null)

    const promises = entries.map(([, service]) => service.list())
    promises.push(reportService.dashboardSummary())

    setLoading(true)
    Promise.allSettled(promises)
      .then((results) => {
        const summaryResult = results.pop()
        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value)
        }

        entries.forEach(([key], index) => {
          const result = results[index]
          if (result.status !== 'fulfilled') return

          const setters = {
            items: setItems,
            grns: setGrns,
            reqs: setReqs,
            returns: setReturns,
            transfers: setTransfers,
            disposals: setDisposals,
            transactions: setTransactions,
            vouchers: setVouchers,
            userCards: setUserCards,
            assets: setAssets,
            reconciliation: setVariances,
            stockTaking: setStockTaking,
            audit: setAudit
          }
          setters[key](result.value)
        })
      })
      .finally(() => setLoading(false))

    return undefined
  }, [user?.role])

  const userStore = getUserStoreName(user)
  const isStoreScoped = Boolean(userStore)

  const totalValue = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qtyOnHand || 0) * Number(item.unitPrice || 0), 0),
    [items]
  )

  const stockOnHandQty = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qtyOnHand || 0), 0),
    [items]
  )

  const lowStock = useMemo(
    () => items.filter((item) => Number(item.qtyOnHand || 0) <= Number(item.reorderLevel || 0)),
    [items]
  )

  // GRN receipts still moving through receiving/evaluation (pre-GRN, not rejected).
  const pendingGrns = useMemo(
    () => grns.filter((g) => [GRN_STATUS.PENDING_EVAL, GRN_STATUS.UNDER_EVAL].includes(g.status)),
    [grns]
  )

  const grnsUnderReview = useMemo(
    () => grns.filter((g) => g.status === GRN_STATUS.UNDER_EVAL),
    [grns]
  )
  const grnsApproved = useMemo(
    () => grns.filter((g) => [GRN_STATUS.ACCEPTED, GRN_STATUS.GRN_GENERATED].includes(g.status)),
    [grns]
  )
  const grnsPartiallyAccepted = useMemo(
    () => grns.filter((g) => g.status === GRN_STATUS.PARTIALLY_ACCEPTED),
    [grns]
  )
  const grnsRejected = useMemo(
    () => grns.filter((g) => g.status === GRN_STATUS.REJECTED),
    [grns]
  )
  const grnsHistory = useMemo(
    () => grns.filter((g) => [GRN_STATUS.ACCEPTED, GRN_STATUS.PARTIALLY_ACCEPTED, GRN_STATUS.REJECTED, GRN_STATUS.GRN_GENERATED].includes(g.status)),
    [grns]
  )

  const pendingReqs = useMemo(
    () => reqs.filter((r) => r.status === REQUISITION_STATUS.PENDING),
    [reqs]
  )
  const approvedReqs = useMemo(
    () => reqs.filter((r) => r.status === REQUISITION_STATUS.APPROVED),
    [reqs]
  )
  const partiallyApprovedReqs = useMemo(
    () => reqs.filter((r) => r.status === REQUISITION_STATUS.PARTIALLY_APPROVED),
    [reqs]
  )

  const pendingReturns = useMemo(
    () => returns.filter((r) => [RETURN_STATUS.DRAFT, RETURN_STATUS.SUBMITTED, RETURN_STATUS.PENDING_REVIEW].includes(r.status)),
    [returns]
  )

  const storekeeperPendingReturns = useMemo(
    () => returns.filter((r) => [RETURN_STATUS.SUBMITTED, RETURN_STATUS.PENDING_REVIEW, RETURN_STATUS.APPROVED].includes(r.status)),
    [returns]
  )

  const readyForDispatchTransfers = useMemo(
    () => transfers.filter((t) => t.status === TRANSFER_STATUS.APPROVED),
    [transfers]
  )

  const pendingTransfersForApproval = useMemo(
    () => transfers.filter((t) => [TRANSFER_STATUS.SUBMITTED, TRANSFER_STATUS.PENDING_APPROVAL].includes(t.status)),
    [transfers]
  )

  const pendingDisposals = useMemo(
    () => disposals.filter((d) => [DISPOSAL_STATUS.FLAGGED, DISPOSAL_STATUS.REQUESTED, DISPOSAL_STATUS.PENDING_REVIEW].includes(d.status)),
    [disposals]
  )

  // Issue vouchers awaiting Store Head approval/posting (two-stage: stage 2).
  const pendingSivApprovals = useMemo(
    () => vouchers.filter((v) => [SIV_STATUS.PRELIMINARY, SIV_STATUS.PENDING_APPROVAL].includes(v.status)),
    [vouchers]
  )

  const todaysTransactions = useMemo(
    () => transactions.filter((t) => isToday(t.date)),
    [transactions]
  )

  const categoryTotals = useMemo(() => {
    const map = {}
    items.forEach((item) => {
      const value = Number(item.qtyOnHand || 0) * Number(item.unitPrice || 0)
      map[item.category] = (map[item.category] || 0) + value
    })
    const values = Object.values(map)
    const max = Math.max(1, ...values)
    return Object.entries(map).map(([label, value]) => ({ label, value, pct: Math.round((value / max) * 100) }))
  }, [items])

  const valueAtReorderRisk = useMemo(
    () => items
      .filter((item) => Number(item.qtyOnHand || 0) <= Number(item.reorderLevel || 0))
      .reduce((sum, item) => sum + Number(item.qtyOnHand || 0) * Number(item.unitPrice || 0), 0),
    [items]
  )

  const storeFilteredItems = useMemo(
    () => (userStore ? items.filter((item) => item.store === userStore) : items),
    [items, userStore]
  )

  const storeFilteredLowStock = useMemo(
    () => (userStore ? lowStock.filter((item) => item.store === userStore) : lowStock),
    [lowStock, userStore]
  )

  const storeFilteredGrns = useMemo(
    () => (userStore ? grns.filter((g) => g.store === userStore) : grns),
    [grns, userStore]
  )

  const storeFilteredTransactions = useMemo(
    () => (userStore ? transactions.filter((t) => storeFilteredItems.some((item) => item.name === t.item && item.store === userStore)) : transactions),
    [transactions, storeFilteredItems, userStore]
  )

  const myDeptReqs = useMemo(
    () => reqs.filter((r) => r.requestedBy === user?.name || r.department === user?.department),
    [reqs, user]
  )

  const pendingDeptApprovals = useMemo(
    () =>
      reqs.filter(
        (r) =>
          [REQUISITION_STATUS.SUBMITTED, REQUISITION_STATUS.PENDING].includes(r.status) &&
          r.department === user?.department &&
          r.requestedBy !== user?.name
      ),
    [reqs, user]
  )

  const myDeptReturns = useMemo(
    () => returns.filter((r) => r.department === user?.department),
    [returns, user]
  )

  // Approved requisitions not yet converted to an issue voucher. Requisitions carry
  // no issueVoucherRef today, so this is an upper bound on "awaiting issue".
  const approvedReqsAwaitingIssue = useMemo(
    () => reqs.filter((r) => r.status === REQUISITION_STATUS.APPROVED && (!r.issueVoucherRef || !r.issueVoucherRef.trim())),
    [reqs]
  )

  const rejectedDeptReqs = useMemo(
    () => myDeptReqs.filter((r) => r.status === REQUISITION_STATUS.REJECTED),
    [myDeptReqs]
  )

  const outstandingDeptReqs = useMemo(
    () => myDeptReqs.filter((r) => ![REQUISITION_STATUS.REJECTED, REQUISITION_STATUS.CANCELLED, 'Fully Issued', 'Closed'].includes(r.status)),
    [myDeptReqs]
  )

  // ---- Fixed-asset statistics (PAO) ----
  const assetStats = useMemo(() => {
    const byStatus = {}
    let totalAssetValue = 0
    assets.forEach((a) => {
      const key = a.status || 'Unknown'
      byStatus[key] = (byStatus[key] || 0) + 1
      totalAssetValue += Number(a.value || 0)
    })
    return {
      total: assets.length,
      totalValue: totalAssetValue,
      byStatus: Object.entries(byStatus).map(([label, count]) => ({ label, count }))
    }
  }, [assets])

  // ---- Financial values (Accountant) — indicative, period-to-date ----
  const itemPriceByName = useMemo(() => {
    const map = {}
    items.forEach((it) => {
      map[it.name] = Number(it.unitPrice || 0)
    })
    return map
  }, [items])

  const receiptsValue = useMemo(
    () => grns.reduce((sum, g) => sum + (g.items || []).reduce((t, li) => t + Number(li.qty || 0) * Number(li.unitPrice || 0), 0), 0),
    [grns]
  )
  const issueValue = useMemo(
    () => vouchers.reduce((sum, v) => sum + (v.items || []).reduce((t, li) => t + Number(li.qty || 0) * Number(li.unitPrice || itemPriceByName[li.item] || 0), 0), 0),
    [vouchers, itemPriceByName]
  )
  const returnValue = useMemo(
    () => returns.reduce((sum, r) => sum + Number(r.qty || 0) * Number(itemPriceByName[r.item] || 0), 0),
    [returns, itemPriceByName]
  )
  const adjustmentsCount = useMemo(
    () => transactions.filter((t) => t.type === 'Adjustment').length,
    [transactions]
  )

  // ---- Gate movement (Security) ----
  const gateEligibleIncoming = useMemo(
    () => grns.filter((g) => g.status === GRN_STATUS.GRN_GENERATED),
    [grns]
  )
  const gateEligibleOutgoing = useMemo(
    () => vouchers.filter((v) => [SIV_STATUS.APPROVED, SIV_STATUS.POSTED].includes(v.status)),
    [vouchers]
  )
  const rejectedGateDocuments = useMemo(
    () => grns.filter((g) => g.status === GRN_STATUS.REJECTED).length + vouchers.filter((v) => v.status === SIV_STATUS.REJECTED).length,
    [grns, vouchers]
  )
  const pendingGateIncoming = gateEligibleIncoming.filter((g) => !g.gateVerified)
  const pendingGateOutgoing = gateEligibleOutgoing.filter((v) => !v.gateVerified)
  const gatePassesToday = useMemo(
    () => gateEligibleIncoming.filter((g) => isToday(g.receivedDate)).length + gateEligibleOutgoing.filter((v) => isToday(v.date)).length,
    [gateEligibleIncoming, gateEligibleOutgoing]
  )
  const pendingGateVerification = pendingGateIncoming.length + pendingGateOutgoing.length
  const approvedGatePasses = gateEligibleIncoming.length + gateEligibleOutgoing.length
  const completedExits = gateEligibleOutgoing.filter((v) => v.gateVerified).length
  const completedEntries = gateEligibleIncoming.filter((g) => g.gateVerified).length

  const pendingIssueActionRows = useMemo(() => {
    const receipts = pendingGrns.map((g) => ({
      id: `grn-${g.id}`,
      ref: g.grnRef,
      type: 'GRN',
      label: 'Record receipt',
      route: '/goods-receipt',
      date: g.receivedDate,
      meta: g.store || 'Store'
    }))

    const issueTasks = approvedReqsAwaitingIssue.map((r) => ({
      id: `sr-${r.id}`,
      ref: r.srRef,
      type: 'Requisition',
      label: 'Generate voucher',
      route: '/issue-vouchers',
      date: r.date,
      meta: r.department || 'Department'
    }))

    return [...receipts, ...issueTasks].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [pendingGrns, approvedReqsAwaitingIssue])

  const approvalRows = useMemo(() => {
    const reqRows = pendingReqs.map((r) => ({
      id: `req-${r.id}`,
      type: 'Requisition',
      ref: r.srRef,
      date: r.date,
      dept: r.department,
      route: '/requisitions',
      badge: REQUISITION_STATUS.PENDING
    }))

    const transferRows = pendingTransfersForApproval.map((t) => ({
      id: `tr-${t.id}`,
      type: 'Transfer',
      ref: t.transferRef,
      date: t.date,
      dept: t.fromStore || 'Store',
      route: '/material-transfer',
      badge: TRANSFER_STATUS.PENDING_APPROVAL
    }))

    return sortNewestFirst([...reqRows, ...transferRows]).slice(0, MAX_APPROVAL_ROWS)
  }, [pendingReqs, pendingTransfersForApproval])

  const paoPendingApprovals = pendingReqs.length + pendingTransfersForApproval.length + pendingDisposals.length

  // ---- PAO Comprehensive KPI Calculations (Receiving) ----
  const grnsPendingTecEval = useMemo(
    () => grns.filter((g) => [GRN_STATUS.SUBMITTED, GRN_STATUS.PENDING_EVAL].includes(g.status)),
    [grns]
  )
  const grnsAcceptedAwaitingGrn = useMemo(
    () => grns.filter((g) => g.status === GRN_STATUS.ACCEPTED),
    [grns]
  )

  // ---- PAO Comprehensive KPI Calculations (Requisitions) ----
  const pendingReqsForApproval = useMemo(
    () => reqs.filter((r) => r.status === REQUISITION_STATUS.PENDING),
    [reqs]
  )
  const approvedReqsPending = useMemo(
    () => reqs.filter((r) => r.status === REQUISITION_STATUS.APPROVED),
    [reqs]
  )
  const rejectedReqs = useMemo(
    () => reqs.filter((r) => r.status === REQUISITION_STATUS.REJECTED),
    [reqs]
  )

  // ---- PAO Comprehensive KPI Calculations (Issues) ----
  const sivsPreliminary = useMemo(
    () => vouchers.filter((v) => v.status === SIV_STATUS.PRELIMINARY),
    [vouchers]
  )
  const sivsApprovedPending = useMemo(
    () => vouchers.filter((v) => v.status === SIV_STATUS.APPROVED),
    [vouchers]
  )
  const sivsPosted = useMemo(
    () => vouchers.filter((v) => v.status === SIV_STATUS.POSTED),
    [vouchers]
  )

  // ---- PAO Comprehensive KPI Calculations (Returns) ----
  const returnsAwaitingApproval = useMemo(
    () => returns.filter((r) => [RETURN_STATUS.SUBMITTED, RETURN_STATUS.PENDING_REVIEW].includes(r.status)),
    [returns]
  )
  const returnsApproved = useMemo(
    () => returns.filter((r) => r.status === RETURN_STATUS.APPROVED),
    [returns]
  )

  // ---- PAO Comprehensive KPI Calculations (Transfers) ----
  const transfersPending = useMemo(
    () => transfers.filter((t) => t.status === TRANSFER_STATUS.SUBMITTED),
    [transfers]
  )
  const transfersAwaitingApproval = useMemo(
    () => transfers.filter((t) => t.status === TRANSFER_STATUS.PENDING_APPROVAL),
    [transfers]
  )
  const transfersApprovedPending = useMemo(
    () => transfers.filter((t) => [TRANSFER_STATUS.APPROVED, TRANSFER_STATUS.AWAITING_DISPATCH].includes(t.status)),
    [transfers]
  )

  // ---- PAO Comprehensive KPI Calculations (Stock Control) ----
  const openReconcilationItems = useMemo(
    () => variances.filter((v) => !v.resolved),
    [variances]
  )
  const significantVariances = useMemo(
    () => variances.filter((v) => !v.resolved && Math.abs(v.variance) > 5),
    [variances]
  )

  // ---- PAO Comprehensive KPI Calculations (Assets) ----
  const unregisteredAssets = useMemo(
    () => assets.filter((a) => a.status === 'Unregistered' || !a.status),
    [assets]
  )
  const assignedAssets = useMemo(
    () => assets.filter((a) => a.assignedTo || a.status === 'Assigned'),
    [assets]
  )
  const unassignedAssets = useMemo(
    () => assets.filter((a) => !a.assignedTo && a.status !== 'Unregistered'),
    [assets]
  )

  // ---- PAO Comprehensive KPI Calculations (Disposal) ----
  const disposalsFlagged = useMemo(
    () => disposals.filter((d) => d.status === DISPOSAL_STATUS.FLAGGED),
    [disposals]
  )
  const disposalsPendingReview = useMemo(
    () => disposals.filter((d) => d.status === DISPOSAL_STATUS.REQUESTED),
    [disposals]
  )
  const disposalsAwaitingApproval = useMemo(
    () => disposals.filter((d) => d.status === DISPOSAL_STATUS.PENDING_REVIEW),
    [disposals]
  )

  // ---- PAO Comprehensive KPI Calculations (Exceptions) ----
  const expiringItems = useMemo(
    () => items.filter((item) => {
      if (!item.expiryDate) return false
      const expiry = new Date(item.expiryDate)
      const today = new Date()
      const daysUntilExpiry = (expiry - today) / (1000 * 60 * 60 * 24)
      return daysUntilExpiry > 0 && daysUntilExpiry <= 90
    }),
    [items]
  )
  const expiredItems = useMemo(
    () => items.filter((item) => {
      if (!item.expiryDate) return false
      const expiry = new Date(item.expiryDate)
      return expiry < new Date()
    }),
    [items]
  )
  const damagedItems = useMemo(
    () => items.filter((item) => item.condition === 'Damaged'),
    [items]
  )
  const quarantinedItems = useMemo(
    () => items.filter((item) => item.status === 'Quarantine' || item.condition === 'Quarantine'),
    [items]
  )

  // ---- PAO Comprehensive KPI Calculations (Audit) ----
  const recentCriticalEvents = useMemo(
    () => audit.filter((e) => ['Failed', 'Error', 'Rejected'].some((keyword) => (e.description || e.action || '').includes(keyword))).slice(0, 5),
    [audit]
  )

  const renderAdmin = () => (
    <>
      <Card title="System Overview" subtitle="Current master-data and account totals" className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {renderStatCardLink('/users', 'Total Users', summary?.systemOverview?.totalUsers ?? (loading ? '—' : 0), Landmark, 'brand', 'All user accounts')}
          {renderStatCardLink('/stores', 'Total Stores', summary?.systemOverview?.totalStores ?? (loading ? '—' : 0), Boxes, 'success', 'Registered stores')}
          {renderStatCardLink('/items', 'Total Items', summary?.systemOverview?.totalItems ?? (loading ? '—' : 0), PackageCheck, 'warning', 'Inventory catalog')}
          {renderStatCardLink('/items', 'Inventory Value', !summary ? '—' : formatCurrency(summary.totalInventoryValue || 0), Coins, 'success', 'Current stock value')}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {renderStatCardLink('/goods-receipt', 'Pending Goods Receipts', !summary ? '—' : summary.pendingGoodsReceipts || 0, PackageCheck, 'info', 'Awaiting evaluation')}
        {renderStatCardLink('/requisitions', 'Pending Requisitions', !summary ? '—' : summary.pendingRequisitions || 0, FileText, 'success', 'Awaiting approval')}
        {renderStatCardLink('/issue-vouchers', 'Pending SIV Approvals', summary?.systemOverview?.pendingSivApprovals ?? (loading ? '—' : 0), Send, 'warning', 'Issue vouchers in review')}
        {renderStatCardLink('/material-transfer', 'Pending Transfers', summary?.systemOverview?.pendingMaterialTransfers ?? (loading ? '—' : 0), Repeat, 'brand', 'Cross-store transfers in review')}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Recent Transactions" subtitle="Latest movement activity across the system" className="lg:col-span-1">
          {transactions.length === 0 ? (
            <EmptyState title="No recent transactions" message="Transactions will appear here as stock moves through the system." />
          ) : (
            <ul className="space-y-3">
              {transactions.slice(0, 6).map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{transaction.item}</p>
                    <p className="text-xs text-ink-400">{transaction.ref} · {formatDate(transaction.date)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${transaction.type === 'Receipt' ? 'text-success-500' : 'text-danger-500'}`}>
                    {transaction.type === 'Receipt' ? `+${transaction.qtyIn}` : `-${transaction.qtyOut}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Audit Events" subtitle="Latest system actions and outcomes" className="lg:col-span-1">
          {audit.length === 0 ? (
            <EmptyState title="No audit events" message="System activity will appear here as users act on records." icon={ScrollText} />
          ) : (
            <ul className="space-y-3">
              {audit.slice(0, 6).map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{event.description || `${event.action || 'Action'} · ${event.module || ''}`}</p>
                    <p className="text-xs text-ink-400">{event.actorName || 'System'}{event.entityReference ? ` · ${event.entityReference}` : ''}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-400">{formatTimeAgo(event.timestamp || event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent User Activity" subtitle="Last system interactions by actor" className="lg:col-span-1">
          {audit.length === 0 ? (
            <EmptyState title="No user activity" message="Activity will appear as users perform actions and approvals." icon={Users} />
          ) : (
            <ul className="space-y-3">
              {[...audit].slice(0, 6).map((event) => (
                <li key={`activity-${event.id}`} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{event.actorName || event.userName || 'System user'}</p>
                    <p className="text-xs text-ink-400">{event.action || 'Action'} · {event.module || 'System'}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-400">{formatTimeAgo(event.timestamp || event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recent Goods Receipts" className="mt-6" actions={<TrendingUp size={16} className="text-ink-400" />}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-ink-500">
              <tr>
                <th className="py-2 pr-4">GRN Ref</th>
                <th className="py-2 pr-4">Supplier</th>
                <th className="py-2 pr-4">Store</th>
                <th className="py-2 pr-4">Received</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {grns.slice(0, 5).map((g) => (
                <tr key={g.id} className="border-t border-ink-100">
                  <td className="py-2 pr-4 font-medium text-ink-800">{g.grnRef}</td>
                  <td className="py-2 pr-4">{g.supplier}</td>
                  <td className="py-2 pr-4">{g.store}</td>
                  <td className="py-2 pr-4">{formatDate(g.receivedDate)}</td>
                  <td className="py-2 pr-4"><StatusBadge status={g.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )

  const renderPao = () => (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Inventory Value" value={!summary && loading ? '—' : formatCurrency(summary?.totalInventoryValue ?? totalValue)} icon={Boxes} tone="brand" />
        {renderStatCardLink('/requisitions', 'Pending Approvals', loading ? '—' : paoPendingApprovals, ClipboardCheck, 'warning', 'All items awaiting action')}
        {renderStatCardLink('/goods-receipt', 'GRNs at Risk', loading ? '—' : openReconcilationItems.length, AlertTriangle, 'danger', 'Variances detected')}
        {renderStatCardLink('/fixed-assets', 'Asset Portfolio', loading ? '—' : assetStats.total, Landmark, 'success', formatCurrency(assetStats.totalValue))}
      </div>

      {/* ---- APPROVAL QUEUE ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Awaiting Your Approval" subtitle="Newest items first" className="lg:col-span-1">
          {approvalRows.length === 0 ? (
            <EmptyState title="All caught up" message="No approvals currently pending. Your approval queue is clear." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-ink-500">
                  <tr>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Reference</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalRows.map((row) => (
                    <tr key={row.id} className="border-t border-ink-100 align-top">
                      <td className="py-2 pr-4"><StatusBadge status={row.badge} /></td>
                      <td className="py-2 pr-4"><Link to={row.route} className="font-medium text-brand-600 hover:text-brand-700">{row.ref}</Link></td>
                      <td className="py-2 pr-4 text-ink-500">{formatDate(row.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {approvalRows.length >= MAX_APPROVAL_ROWS && (
            <div className="mt-4 text-right">
              <Link to="/requisitions" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all approvals</Link>
            </div>
          )}
        </Card>

        <Card title="Recent Audit Activity" subtitle="Latest system actions" className="lg:col-span-1" actions={<Link to="/audit-log" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>}>
          {audit.length === 0 ? (
            <EmptyState title="No audit events" message="System activity will appear here as users act on records." icon={ScrollText} />
          ) : (
            <ul className="space-y-3">
              {audit.slice(0, 6).map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{event.description || `${event.action || 'Action'} · ${event.module || ''}`}</p>
                    <p className="text-xs text-ink-400">{event.actorName || 'System'}{event.entityReference ? ` · ${event.entityReference}` : ''}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-400">{formatTimeAgo(event.timestamp || event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )

  const renderStoreHead = () => (
    <>
      <div className="mb-4 flex flex-col gap-2 text-sm text-ink-600">
        {!isStoreScoped && (
          <div className="rounded-lg border border-warning-100 bg-warning-50 px-3 py-2 text-warning-700">
            Store link is missing on this user record, so this dashboard is showing company-wide data until a store association is added.
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {renderStatCardLink('/goods-receipt', 'Receipts Awaiting Review', loading ? '—' : storeFilteredGrns.filter((g) => g.status === GRN_STATUS.SUBMITTED).length, PackageCheck, 'warning', 'Needs store-head decision')}
        {renderStatCardLink('/goods-receipt/evaluation', 'Receipts Awaiting TEC', loading ? '—' : storeFilteredGrns.filter((g) => [GRN_STATUS.PENDING_EVAL, GRN_STATUS.UNDER_EVAL].includes(g.status)).length, ClipboardCheck, 'info', 'Technical evaluation queue')}
        {renderStatCardLink('/requisitions', 'Pending Requisitions', loading ? '—' : pendingReqs.filter((r) => (isStoreScoped ? r.store === userStore : true)).length, FileText, 'brand', isStoreScoped ? 'Targeting your store' : 'Current overview')}
        {renderStatCardLink('/material-transfer', 'Transfers Pending Approval', loading ? '—' : transfers.filter((t) => [TRANSFER_STATUS.SUBMITTED, TRANSFER_STATUS.PENDING_APPROVAL].includes(t.status) && (isStoreScoped ? [t.fromStore, t.toStore].includes(userStore) : true)).length, Repeat, 'info', 'Store-to-store review queue')}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Low-Stock Alerts" subtitle={isStoreScoped ? `Filtered to ${userStore}` : 'Store link missing — showing company-wide view'}>
          {storeFilteredLowStock.length === 0 ? (
            <EmptyState title="No low-stock items" message="The current store is well stocked." />
          ) : (
            <ul className="space-y-3">
              {storeFilteredLowStock.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{item.name}</p>
                    <p className="text-xs text-ink-400">{item.category}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                    {formatNumber(item.qtyOnHand)} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Transactions" subtitle={isStoreScoped ? `Filtered to ${userStore}` : 'Store link missing — showing company-wide view'}>
          {storeFilteredTransactions.length === 0 ? (
            <EmptyState title="No recent stock movement" message="No recent transactions are available for this store view." />
          ) : (
            <ul className="space-y-3">
              {storeFilteredTransactions.slice(0, 6).map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{transaction.item}</p>
                    <p className="text-xs text-ink-400">{transaction.ref} · {formatDate(transaction.date)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${transaction.type === 'Receipt' ? 'text-success-500' : 'text-danger-500'}`}>
                    {transaction.type === 'Receipt' ? `+${transaction.qtyIn}` : `-${transaction.qtyOut}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recent Goods Receipts" className="mt-6" actions={<TrendingUp size={16} className="text-ink-400" />}>
        {storeFilteredGrns.length === 0 ? (
          <EmptyState title="No recent goods receipts" message="No receipts are currently recorded for the selected store scope." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-ink-500">
                <tr>
                  <th className="py-2 pr-4">GRN Ref</th>
                  <th className="py-2 pr-4">Supplier</th>
                  <th className="py-2 pr-4">Store</th>
                  <th className="py-2 pr-4">Received</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {storeFilteredGrns.slice(0, 5).map((g) => (
                  <tr key={g.id} className="border-t border-ink-100">
                    <td className="py-2 pr-4 font-medium text-ink-800">{g.grnRef}</td>
                    <td className="py-2 pr-4">{g.supplier}</td>
                    <td className="py-2 pr-4">{g.store}</td>
                    <td className="py-2 pr-4">{formatDate(g.receivedDate)}</td>
                    <td className="py-2 pr-4"><StatusBadge status={g.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )

  const renderStorekeeper = () => (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Stock on Hand" value={loading ? '—' : formatNumber(stockOnHandQty)} icon={Boxes} tone="brand" hint="Total units across catalog" />
        {renderStatCardLink('/goods-receipt', 'Pending Receipts', loading ? '—' : pendingGrns.length, PackageCheck, 'info', 'Needs action')}
        {renderStatCardLink('/issue-vouchers', 'Pending Issues', loading ? '—' : pendingSivApprovals.length, Send, 'warning', 'Issue vouchers in progress')}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {renderStatCardLink('/goods-receipt', 'Goods Receipt', loading ? '—' : pendingGrns.length, PackageCheck, 'info', 'Record and review receipts')}
        {renderStatCardLink('/issue-vouchers', 'Issue Vouchers', loading ? '—' : pendingSivApprovals.length, Send, 'warning', 'Issue approved requests')}
        {renderStatCardLink('/material-transfer', 'Store Transfers', loading ? '—' : readyForDispatchTransfers.length, Repeat, 'success', 'Dispatch/receive approved transfers')}
        {renderStatCardLink('/stock-cards', 'Stock Cards', loading ? '—' : items.length, Archive, 'brand', 'Inventory history and balances')}
        {renderStatCardLink('/stock-taking', 'Stock Taking', loading ? '—' : '—', ClipboardCheck, 'brand', 'Count and reconcile stock')}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="To Do" subtitle="Action list for today" className="lg:col-span-2">
          {pendingIssueActionRows.length === 0 ? (
            <EmptyState title="Your task list is clear" message="There are no receipts or requisitions waiting for action." />
          ) : (
            <div className="space-y-3">
              {pendingIssueActionRows.slice(0, 8).map((row) => (
                <Link key={row.id} to={row.route} className="block rounded-lg border border-ink-100 bg-ink-50/40 p-3 transition hover:border-brand-200 hover:bg-brand-50/40">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{row.ref}</p>
                      <p className="text-xs text-ink-500">{row.type} · {row.meta}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-brand-600">
                      <span className="rounded-full bg-brand-100 px-2 py-1 text-xs font-medium">{row.label}</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent Stock Movements" subtitle="Your recent receipts and issues">
          {transactions.length === 0 ? (
            <EmptyState title="No recent transactions" message="No stock movement has been recorded recently." />
          ) : (
            <ul className="space-y-3">
              {transactions.slice(0, 6).map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{transaction.item}</p>
                    <p className="text-xs text-ink-400">{transaction.ref} · {formatDate(transaction.date)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${transaction.type === 'Receipt' ? 'text-success-500' : 'text-danger-500'}`}>
                    {transaction.type === 'Receipt' ? `+${transaction.qtyIn}` : `-${transaction.qtyOut}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )

  const renderStockClerk = () => (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {renderStatCardLink('/stock-taking', 'Pending Counts', loading ? '—' : stockTaking.filter((s) => s.status === 'Draft').reduce((sum, s) => sum + (s.items || []).length, 0), ClipboardCheck, 'info', 'Continue physical counting')}
        {renderStatCardLink('/reconciliation', 'Variances Detected', loading ? '—' : variances.length, ClipboardList, 'danger', 'Review stock discrepancies')}
        {renderStatCardLink('/stock-taking', 'Completed Sessions', loading ? '—' : stockTaking.filter((s) => s.status === 'Closed').length, CheckCircle2, 'success', 'Completed stock counts')}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Stock-Taking Work Queue" subtitle="Count, submit, and monitor physical verification sessions">
          {stockTaking.length === 0 ? (
            <EmptyState title="No stock-taking sessions" message="Assigned or created stock-taking sessions will appear here." />
          ) : (
            <ul className="space-y-3">
              {stockTaking.slice(0, 6).map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 text-sm">
                  <div><p className="font-medium text-ink-800">{session.sessionRef}</p><p className="text-xs text-ink-400">{session.store} · {session.items?.length || 0} items</p></div>
                  <StatusBadge status={session.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent Stock Movements" subtitle="Full feed for stock activity" actions={<Link to="/stock-cards" className="text-sm font-medium text-brand-600">View Stock Cards</Link>}>
          {transactions.length === 0 ? (
            <EmptyState title="No stock activity" message="Transactions will appear here as items move through the system." />
          ) : (
            <ul className="space-y-3">
              {transactions.slice(0, 8).map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{transaction.item}</p>
                    <p className="text-xs text-ink-400">{transaction.ref} · {formatDate(transaction.date)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${transaction.type === 'Receipt' ? 'text-success-500' : 'text-danger-500'}`}>
                    {transaction.type === 'Receipt' ? `+${transaction.qtyIn}` : `-${transaction.qtyOut}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Low-Stock Alerts" subtitle="Awareness only — no reordering action from this role">
          {lowStock.length === 0 ? (
            <EmptyState title="No low-stock items" message="All tracked items are above minimum thresholds." />
          ) : (
            <ul className="space-y-3">
              {lowStock.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-ink-800">{item.name}</span>
                  <span className="rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">{formatNumber(item.qtyOnHand)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )

  const renderTec = () => (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {renderStatCardLink('/goods-receipt/evaluation', 'Pending Evaluations', loading ? '—' : pendingGrns.length, ClipboardCheck, 'warning', 'Awaiting your decision')}
        <StatCard label="Evaluation History" value={loading ? '—' : grnsHistory.length} icon={History} tone="brand" hint="Completed evaluations" />
      </div>

      <Card title="Evaluation Queue" subtitle="Goods receipts waiting for your decision">
        {pendingGrns.length === 0 ? (
          <EmptyState title="Nothing pending evaluation" message="You're all caught up — there are no receipts waiting for review." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-ink-500">
                <tr>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Supplier</th>
                  <th className="py-2 pr-4">Store</th>
                  <th className="py-2 pr-4">Received</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortNewestFirst(pendingGrns.map((g) => ({ ...g, date: g.receivedDate }))).map((g) => (
                  <tr key={g.id} className="border-t border-ink-100">
                    <td className="py-2 pr-4 font-medium text-ink-800">{g.grnRef}</td>
                    <td className="py-2 pr-4">{g.supplier}</td>
                    <td className="py-2 pr-4">{g.store}</td>
                    <td className="py-2 pr-4">{formatDate(g.receivedDate)}</td>
                    <td className="py-2 pr-4"><StatusBadge status={g.status} /></td>
                    <td className="py-2 pr-4"><Link to="/goods-receipt/evaluation" className="font-medium text-brand-600 hover:text-brand-700">Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Evaluation History" subtitle="Recently completed evaluations" className="mt-6">
        {grnsHistory.length === 0 ? (
          <EmptyState title="No completed evaluations yet" message="Evaluated receipts will appear here once you record a decision." icon={History} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-ink-500">
                <tr>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Supplier</th>
                  <th className="py-2 pr-4">Store</th>
                  <th className="py-2 pr-4">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {sortNewestFirst(grnsHistory.map((g) => ({ ...g, date: g.receivedDate }))).slice(0, 6).map((g) => (
                  <tr key={g.id} className="border-t border-ink-100">
                    <td className="py-2 pr-4 font-medium text-ink-800">{g.grnRef}</td>
                    <td className="py-2 pr-4">{g.supplier}</td>
                    <td className="py-2 pr-4">{g.store}</td>
                    <td className="py-2 pr-4"><StatusBadge status={g.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )

  const renderDeptHead = () => (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {renderStatCardLink('/requisitions', 'Awaiting Your Approval', loading ? '—' : pendingDeptApprovals.length, FileText, 'warning', 'Department requisitions')}
        <StatCard label="My Pending Requisitions" value={loading ? '—' : myDeptReqs.filter((r) => [REQUISITION_STATUS.SUBMITTED, REQUISITION_STATUS.PENDING].includes(r.status)).length} icon={ClipboardCheck} tone="info" hint="Submitted, awaiting outcome" />
        {renderStatCardLink('/material-return', 'Pending Returns', loading ? '—' : myDeptReturns.filter((r) => [RETURN_STATUS.DRAFT, RETURN_STATUS.SUBMITTED, RETURN_STATUS.PENDING_REVIEW].includes(r.status)).length, Undo2, 'warning', 'Submitted by your team')}
        {renderStatCardLink('/user-cards', 'Assigned User Materials', loading ? '—' : userCards.filter((card) => card.status !== 'Returned').length, Boxes, 'brand', 'Materials assigned in your department')}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Requisitions Awaiting Approval" subtitle="Department requests needing your endorsement" actions={<Link to="/requisitions" className="text-sm font-medium text-brand-600 hover:text-brand-700">Review all</Link>}>
          {pendingDeptApprovals.length === 0 ? (
            <EmptyState title="No pending approvals" message="There are no department requisitions waiting for your approval." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-ink-500">
                  <tr>
                    <th className="py-2 pr-4">Ref</th>
                    <th className="py-2 pr-4">Requested By</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortNewestFirst(pendingDeptApprovals).slice(0, 5).map((req) => (
                    <tr key={req.id} className="border-t border-ink-100">
                      <td className="py-2 pr-4"><Link to="/requisitions" className="font-medium text-brand-600 hover:text-brand-700">{req.srRef}</Link></td>
                      <td className="py-2 pr-4">{req.requestedBy}</td>
                      <td className="py-2 pr-4 text-ink-500">{formatDate(req.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Recent Requests" subtitle="Your requisitions — newest first">
          {myDeptReqs.length === 0 ? (
            <EmptyState title="No requisitions yet" message="Your requisition history will appear here once you submit a request." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-ink-500">
                  <tr>
                    <th className="py-2 pr-4">Ref</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortNewestFirst(myDeptReqs).slice(0, 5).map((req) => (
                    <tr key={req.id} className="border-t border-ink-100">
                      <td className="py-2 pr-4 font-medium text-ink-800">{req.srRef}</td>
                      <td className="py-2 pr-4"><StatusBadge status={req.status} /></td>
                      <td className="py-2 pr-4 text-ink-500">{formatDate(req.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Your Return Requests" subtitle="Newest first">
          {myDeptReturns.length === 0 ? (
            <EmptyState title="No return requests yet" message="Previous return requests will appear here as soon as they are created." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-ink-500">
                  <tr>
                    <th className="py-2 pr-4">Ref</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortNewestFirst(myDeptReturns).slice(0, 5).map((req) => (
                    <tr key={req.id} className="border-t border-ink-100">
                      <td className="py-2 pr-4 font-medium text-ink-800">{req.srnRef}</td>
                      <td className="py-2 pr-4"><StatusBadge status={req.status} /></td>
                      <td className="py-2 pr-4 text-ink-500">{formatDate(req.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )

  const renderAccountant = () => (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Inventory Value" value={loading ? '—' : formatCurrency(summary?.totalInventoryValue ?? totalValue)} icon={Boxes} tone="brand" />
        <StatCard label="Receipts Value" value={loading ? '—' : formatCurrency(receiptsValue)} icon={PackageCheck} tone="success" hint="Goods received (to date)" />
        <StatCard label="Issue Value" value={loading ? '—' : formatCurrency(issueValue)} icon={Send} tone="info" hint="Materials issued (to date)" />
        {renderStatCardLink('/reconciliation', 'Reconciliation Variances', loading ? '—' : variances.length, AlertTriangle, 'warning', 'Open variance items')}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Inventory Value by Category" subtitle="Financial breakdown by category" className="lg:col-span-1">
          {categoryTotals.length === 0 ? (
            <EmptyState title="No category totals yet" message="Inventory value will appear here once items are created." />
          ) : (
            <div className="space-y-3">
              {categoryTotals.map((item) => renderValueBar(item, Math.max(...categoryTotals.map((entry) => entry.value), 1)))}
            </div>
          )}
        </Card>

        <Card title="FIFO Inventory Valuation" subtitle="First-In-First-Out method per SRS business rules">
          <div className="flex h-full flex-col justify-between gap-4">
            <p className="text-sm text-ink-600">Run the FIFO valuation report to record the financial value of inventory using receipt layers.</p>
            <Link to="/reports" className="inline-flex items-center gap-2 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Open FIFO report <ArrowRight size={16} />
            </Link>
          </div>
        </Card>
      </div>

      <Card title="Financial Reports" subtitle="Valuation and transaction reporting" className="mt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Inventory Valuation', icon: Boxes },
            { label: 'FIFO Valuation', icon: Coins },
            { label: 'Transactions', icon: TrendingUp },
            { label: 'Financial Summary', icon: Wallet }
          ].map((report) => (
            <Link key={report.label} to="/reports" className="flex items-center gap-3 rounded-lg border border-ink-100 bg-ink-50/40 p-3 text-sm transition hover:border-brand-200 hover:bg-brand-50/40">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <report.icon size={18} />
              </span>
              <span className="font-medium text-ink-800">{report.label}</span>
            </Link>
          ))}
        </div>
      </Card>
    </>
  )

  const renderSecurity = () => (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {renderStatCardLink('/gate-pass', 'Pending Verification', pendingGateVerification, AlertTriangle, 'warning', 'Waiting at the gate')}
        {renderStatCardLink('/gate-pass', 'Gate Passes Today', gatePassesToday, ShieldCheck, 'brand', 'Approved entries and exits')}
        {renderStatCardLink('/gate-pass', 'Approved Passes', approvedGatePasses, CheckCircle2, 'success', 'Eligible for verification')}
      </div>

      <Card title="Gate Pass Queue" subtitle="Verify materials at the gate before entry or exit" actions={<Link to="/gate-pass" className="text-sm font-medium text-brand-600 hover:text-brand-700">Open verification</Link>}>
        {pendingGateVerification === 0 ? (
          <EmptyState title="Gate queue is clear" message="All recent goods movements have been verified at the gate." icon={ShieldCheck} />
        ) : (
          <ul className="space-y-3">
            {grns.filter((g) => !g.gateVerified).slice(0, 4).map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 bg-ink-50/40 p-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{g.grnRef} · Incoming</p>
                  <p className="text-xs text-ink-500">{g.supplier} → {g.store}</p>
                </div>
                <Link to="/gate-pass" className="text-xs font-medium text-brand-600">Verify</Link>
              </li>
            ))}
            {pendingGateOutgoing.slice(0, 4).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 bg-ink-50/40 p-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{v.sivRef || v.ref || v.id} · Outgoing</p>
                  <p className="text-xs text-ink-500">{v.issuedTo ? `Issued to ${v.issuedTo}` : v.store ? `Store: ${v.store}` : 'Awaiting outgoing clearance'}</p>
                </div>
                <Link to="/gate-pass" className="text-xs font-medium text-brand-600">Clear</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )

  const renderByRole = () => {
    switch (user?.role) {
      case ROLES.ADMIN:
        return renderAdmin()
      case ROLES.PAO:
        return renderPao()
      case ROLES.STORE_HEAD:
        return renderStoreHead()
      case ROLES.STOREKEEPER:
        return renderStorekeeper()
      case ROLES.STOCK_CLERK:
        return renderStockClerk()
      case ROLES.TEC:
        return renderTec()
      case ROLES.DEPT_HEAD:
        return renderDeptHead()
      case ROLES.ACCOUNTANT:
        return renderAccountant()
      case ROLES.SECURITY:
        return renderSecurity()
      default:
        return renderAdmin()
    }
  }

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-ink-500">{getRoleSubtext(user, userStore)}</p>
      </div>

      {renderByRole()}
    </div>
  )
}
