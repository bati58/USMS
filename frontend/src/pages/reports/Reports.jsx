import { useEffect, useMemo, useState } from 'react'
import { Printer, Download, Eye } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import Table from '../../components/ui/Table'
import SearchInput from '../../components/ui/SearchInput'
import Modal from '../../components/ui/Modal'
import StatusBadge from '../../components/ui/StatusBadge'
import {
  itemService,
  stockTransactionService,
  goodsReceiptService,
  requisitionService,
  issueVoucherService,
  materialTransferService,
  materialReturnService,
  fixedAssetService,
  binCardService,
  disposalService,
  storeService,
  categoryService,
  userCardService,
  reportService
} from '../../services'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters'
import { canPerformAction } from '../../utils/rolePermissions'
import { ROLES } from '../../utils/constants'

const REPORT_CATEGORIES = [
  {
    label: 'Inventory Management',
    reports: [
      { value: 'inventory-summary', label: 'Current Stock Balance Report' },
      { value: 'stock-card-report', label: 'Stock Card Report' },
      { value: 'bin-card-report', label: 'Bin Card Report' },
      { value: 'low-stock', label: 'Low / Reorder Level Stock' },
      { value: 'stock-movement', label: 'Stock Movement (Receipts & Issues)' },
      { value: 'stock-variance', label: 'Stock Variance Report' },
      { value: 'expiring-items', label: 'Expiring Items Report' }
    ]
  },
  {
    label: 'Receiving & GRN',
    reports: [
      { value: 'grn-status', label: 'Goods Receipt Status Report' },
      { value: 'grn-report', label: 'GRN Report' },
      { value: 'material-evaluation', label: 'Material Evaluation Report' }
    ]
  },
  {
    label: 'Requisitions & Issues',
    reports: [
      { value: 'requisition-status', label: 'Store Requisition Report' },
      { value: 'siv-report', label: 'SIV / ISIV Report' },
      { value: 'department-consumption', label: 'Department Consumption Report' }
    ]
  },
  {
    label: 'Transfers & Returns',
    reports: [
      { value: 'transfer-report', label: 'Inter-Store Transfer Report' },
      { value: 'material-return-report', label: 'Material Return / SRN Report' }
    ]
  },
  {
    label: 'Assets & Disposal',
    reports: [
      { value: 'asset-register', label: 'Fixed Asset Register' },
      { value: 'asset-assignment', label: 'Asset Assignment Report' },
      { value: 'disposal-report', label: 'Disposal Report' }
    ]
  },
  {
    label: 'Financial & Analysis',
    reports: [
      { value: 'supplier-transactions', label: 'Supplier Transaction Report' },
      { value: 'inventory-valuation', label: 'Inventory Valuation Report' },
      { value: 'stock-movement-value', label: 'Stock Movement Value Report' }
    ]
  }
]

function flattenReportOptions() {
  return REPORT_CATEGORIES.flatMap((cat) => cat.reports)
}

const BASE_REPORT_OPTIONS = flattenReportOptions()
const FIFO_REPORT = { value: 'fifo-valuation', label: 'FIFO Inventory Valuation (Accountant)' }

// Which reports each role may select. Data itself is still permission-enforced
// on the server (see backend utils/permissions.js); this only scopes the menu
// to reports the role can actually populate and is meant to use, mirroring the
// per-role "Reports" scope in docs/actorspage.md. Roles not listed here
// (Administrator, PAO, Store Head) get the full base report catalogue.
const REPORT_ACCESS = {
  [ROLES.STOREKEEPER]: [
    'inventory-summary', 'stock-card-report', 'bin-card-report', 'low-stock',
    'stock-movement', 'stock-variance', 'expiring-items',
    'grn-status', 'grn-report', 'requisition-status', 'siv-report',
    'transfer-report', 'material-return-report'
  ],
  [ROLES.STOCK_CLERK]: [
    'inventory-summary', 'stock-card-report', 'bin-card-report', 'low-stock',
    'stock-movement', 'stock-variance', 'expiring-items'
  ],
  [ROLES.TEC]: ['material-evaluation', 'grn-status', 'grn-report'],
  [ROLES.DEPT_HEAD]: [
    'requisition-status', 'department-consumption', 'siv-report',
    'material-return-report', 'transfer-report'
  ],
  [ROLES.ACCOUNTANT]: [
    'inventory-summary', 'inventory-valuation', 'stock-movement',
    'stock-movement-value', 'supplier-transactions', 'fifo-valuation'
  ],
  // Security Officer: gate-related movement evidence only, including supporting GRN and SIV documents.
  [ROLES.SECURITY]: ['grn-status', 'grn-report', 'siv-report', 'transfer-report']
}

function computeFifoValue(itemName, qtyOnHand, transactions, fallbackUnitPrice = 0) {
  const receipts = transactions
    .filter((t) => t.item === itemName && t.type === 'Receipt')
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  let remaining = Number(qtyOnHand || 0)
  let value = 0

  for (const receipt of receipts) {
    if (remaining <= 0) break
    const layerQty = Math.min(remaining, Number(receipt.qtyIn || 0))
    value += layerQty * Number(receipt.unitPrice || fallbackUnitPrice)
    remaining -= layerQty
  }

  if (remaining > 0) {
    value += remaining * Number(fallbackUnitPrice)
  }

  return value
}

export default function Reports() {
  const { user } = useAuth()
  const canViewFifo = canPerformAction(user?.role, 'viewFifoValuation')

  const [reportType, setReportType] = useState('inventory-summary')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    store: 'all',
    category: 'all',
    status: 'all',
    startDate: '',
    endDate: ''
  })
  const [detailRow, setDetailRow] = useState(null)

  const [items, setItems] = useState([])
  const [transactions, setTransactions] = useState([])
  const [grns, setGrns] = useState([])
  const [reqs, setReqs] = useState([])
  const [sivs, setSivs] = useState([])
  const [transfers, setTransfers] = useState([])
  const [returns, setReturns] = useState([])
  const [assets, setAssets] = useState([])
  const [binCards, setBinCards] = useState([])
  const [disposals, setDisposals] = useState([])
  const [stores, setStores] = useState([])
  const [categories, setCategories] = useState([])
  const [userCards, setUserCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [serverReportRows, setServerReportRows] = useState(null)

  useEffect(() => {
    Promise.allSettled([
      itemService.list(),
      stockTransactionService.list(),
      goodsReceiptService.list(),
      requisitionService.list(),
      issueVoucherService.list(),
      materialTransferService.list(),
      materialReturnService.list(),
      fixedAssetService.list(),
      binCardService.list(),
      disposalService.list(),
      storeService.list(),
      categoryService.list(),
      userCardService.list()
    ]).then((results) => {
      // Degrade gracefully: a role may lack READ on some resources (e.g. a
      // Storekeeper cannot read disposals, a Security Officer only sees
      // receipts/issues/transfers). Those come back empty instead of blanking
      // the entire report screen, so each role sees the reports it can populate.
      const [i, t, g, r, s, tr, ret, a, b, d, st, c, uc] = results.map((res) =>
        res.status === 'fulfilled' && Array.isArray(res.value) ? res.value : []
      )
      setItems(i)
      setTransactions(t)
      setGrns(g)
      setReqs(r)
      setSivs(s)
      setTransfers(tr)
      setReturns(ret)
      setAssets(a)
      setBinCards(b)
      setDisposals(d)
      setStores(st)
      setCategories(c)
      setUserCards(uc)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const dateParams = { from: filters.startDate, to: filters.endDate }
    const loaders = {
      'inventory-summary': () => reportService.inventorySummary(),
      'low-stock': () => reportService.lowStock(),
      'stock-movement': () => reportService.stockMovement(dateParams),
      'grn-status': () => reportService.grnStatus(dateParams),
      'requisition-status': () => reportService.requisitionStatus(dateParams),
      'siv-report': () => reportService.issueStatus(dateParams),
      'material-return-report': () => reportService.returnStatus(dateParams),
      'transfer-report': () => reportService.transferStatus(dateParams),
      'asset-register': () => reportService.assetSummary(dateParams),
      'disposal-report': () => reportService.disposalStatus(dateParams),
      'fifo-valuation': () => reportService.fifoValuation()
    }
    const loadServerReport = loaders[reportType]
    if (!loadServerReport) {
      setServerReportRows(null)
      return
    }
    let active = true
    loadServerReport()
      .then((report) => {
        if (active) setServerReportRows(Array.isArray(report) ? report : [])
      })
      .catch((error) => {
        if (active) {
          setServerReportRows(null)
          push(error.message || 'Could not load the server report.', 'error')
        }
      })
    return () => { active = false }
  }, [reportType, filters.startDate, filters.endDate])

  const reportOptions = useMemo(() => {
    const allowed = REPORT_ACCESS[user?.role]
    const base = allowed
      ? BASE_REPORT_OPTIONS.filter((o) => allowed.includes(o.value))
      : BASE_REPORT_OPTIONS
    return canViewFifo ? [...base, FIFO_REPORT] : base
  }, [user?.role, canViewFifo])

  // Keep the selected report valid for the current role's menu (e.g. a Security
  // Officer should never land on the default 'inventory-summary' they can't see).
  useEffect(() => {
    if (reportOptions.length && !reportOptions.some((o) => o.value === reportType)) {
      setReportType(reportOptions[0].value)
    }
  }, [reportOptions, reportType])

  const storeOptions = useMemo(
    () => [{ value: 'all', label: 'All Stores' }, ...stores.map((s) => ({ value: s.name, label: s.name }))],
    [stores]
  )

  const categoryOptions = useMemo(
    () => [{ value: 'all', label: 'All Categories' }, ...categories.map((c) => ({ value: c.name, label: c.name }))],
    [categories]
  )

  const getFilterRange = () => {
    const start = filters.startDate ? new Date(filters.startDate) : null
    const end = filters.endDate ? new Date(filters.endDate) : null
    if (end) end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  const matchesFilter = (record, startKey = 'date', storeKey = 'store') => {
    const q = query.trim().toLowerCase()
    const { start, end } = getFilterRange()

    if (q && !JSON.stringify(record).toLowerCase().includes(q)) return false
    if (filters.store !== 'all' && record[storeKey] !== filters.store) return false
    if (filters.category !== 'all' && record.category !== filters.category) return false
    if (filters.status !== 'all' && record.status !== filters.status) return false

    const recordDate = record[startKey] ? new Date(record[startKey]) : null
    if (start && recordDate && recordDate < start) return false
    if (end && recordDate && recordDate > end) return false

    return true
  }

  const handlePrintReport = () => {
    const rowsToPrint = currentRows || []
    const header = (columns || []).map((c) => c.header).join(' | ')
    const body = rowsToPrint.length
      ? rowsToPrint.map((row) => (columns || []).map((c) => {
        const value = c.render ? c.render(row) : row[c.key]
        const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '—'
        return text.replace(/\s+/g, ' ').trim()
      }).join(' | ')).join('<br>')
      : 'No records match the current filters.'

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${reportTitle || 'Report'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111827; background: #fff; }
            h1 { font-size: 28px; margin: 0 0 12px; }
            .meta { font-size: 12px; color: #6b7280; margin-bottom: 18px; }
            .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; text-align: left; }
            th { background: #f3f4f6; }
            .muted { color: #6b7280; }
            @page { size: A4; margin: 18mm; }
          </style>
        </head>
        <body>
          <div class="header-row">
            <div>
              <h1>${reportTitle || 'Report'}</h1>
              <div class="meta">Generated: ${new Date().toLocaleString()}</div>
            </div>
          </div>
          <div class="meta">Store: ${filters.store === 'all' ? 'All Stores' : filters.store} | Category: ${filters.category === 'all' ? 'All Categories' : filters.category}</div>
          <div class="meta">Filter: ${query || 'All records'} | Date: ${filters.startDate || '-'} to ${filters.endDate || '-'}</div>
          <div style="margin-top: 18px; font-weight: 600;">${header}</div>
          <div style="margin-top: 12px; line-height: 1.8;">${body}</div>
        </body>
      </html>
    `

    const win = window.open('', '_blank', 'width=1000,height=900')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  const exportCsv = (columns, rows) => {
    const header = columns.map((c) => c.header).join(',')
    const body = rows
      .map((row) => columns.map((c) => `"${String(c.render ? c.render(row) : row[c.key] || '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportType}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  let columns = []
  let rows = []
  let summaryCards = []

  if (reportType === 'inventory-summary') {
    const filtered = items.filter((i) => matchesFilter(i, null, 'store'))
    summaryCards = [
      { title: 'Total Items', value: filtered.length, format: 'number' },
      { title: 'Total Value', value: filtered.reduce((s, i) => s + Number(i.qtyOnHand) * Number(i.unitPrice), 0), format: 'currency' },
      { title: 'Avg Unit Price', value: filtered.length > 0 ? filtered.reduce((s, i) => s + Number(i.unitPrice), 0) / filtered.length : 0, format: 'currency' }
    ]
    columns = [
      { key: 'code', header: 'Item Code' },
      { key: 'name', header: 'Item Name' },
      { key: 'category', header: 'Category' },
      { key: 'store', header: 'Store' },
      { key: 'bin', header: 'Bin' },
      { key: 'qtyOnHand', header: 'Qty on Hand', render: (r) => formatNumber(r.qtyOnHand) },
      { key: 'unitPrice', header: 'Unit Price', render: (r) => formatCurrency(r.unitPrice) },
      { key: 'value', header: 'Total Value', render: (r) => formatCurrency(r.qtyOnHand * r.unitPrice) }
    ]
    rows = filtered
  } else if (reportType === 'stock-card-report') {
    const filtered = items.filter((i) => matchesFilter(i, null, 'store'))
    columns = [
      { key: 'code', header: 'Item Code' },
      { key: 'name', header: 'Item Name' },
      { key: 'store', header: 'Store' },
      { key: 'qtyOnHand', header: 'Balance', render: (r) => formatNumber(r.qtyOnHand) },
      { key: 'minLevel', header: 'Min Level' },
      { key: 'maxLevel', header: 'Max Level' },
      { key: 'unitPrice', header: 'Unit Price', render: (r) => formatCurrency(r.unitPrice) }
    ]
    rows = filtered
  } else if (reportType === 'bin-card-report') {
    const filtered = binCards.filter((b) => matchesFilter(b, null, 'store'))
    columns = [
      { key: 'bin', header: 'Bin' },
      { key: 'store', header: 'Store' },
      { key: 'item', header: 'Item' },
      { key: 'balance', header: 'Balance', render: (r) => formatNumber(r.balance) },
      { key: 'lastMovement', header: 'Last Movement', render: (r) => formatDate(r.lastMovement) }
    ]
    rows = filtered
  } else if (reportType === 'grn-status') {
    const filtered = grns.filter((g) => matchesFilter(g, 'receivedDate', 'store'))
    summaryCards = [
      { title: 'Total GRNs', value: filtered.length, format: 'number' },
      { title: 'Accepted', value: filtered.filter((g) => g.status === 'Accepted').length, format: 'number' }
    ]
    columns = [
      { key: 'grnRef', header: 'GRN Ref' },
      { key: 'supplier', header: 'Supplier' },
      { key: 'poRef', header: 'PO Ref' },
      { key: 'store', header: 'Store' },
      { key: 'receivedDate', header: 'Received', render: (r) => formatDate(r.receivedDate) },
      { key: 'receivedBy', header: 'Received By' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered
  } else if (reportType === 'grn-report') {
    const filtered = grns.filter((g) => matchesFilter(g, 'receivedDate', 'store'))
    columns = [
      { key: 'grnRef', header: 'GRN Ref' },
      { key: 'poRef', header: 'PO Ref' },
      { key: 'supplier', header: 'Supplier' },
      { key: 'store', header: 'Store' },
      { key: 'receivedDate', header: 'Date', render: (r) => formatDate(r.receivedDate) },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered
  } else if (reportType === 'material-evaluation') {
    const filtered = grns.filter((g) => matchesFilter(g, 'receivedDate', 'store'))
    columns = [
      { key: 'grnRef', header: 'GRN Ref' },
      { key: 'supplier', header: 'Supplier' },
      { key: 'evaluatedBy', header: 'Evaluated By' },
      { key: 'evaluationNote', header: 'Evaluation Note' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered.filter((g) => g.evaluatedBy)
  } else if (reportType === 'requisition-status') {
    const filtered = reqs.filter((r) => matchesFilter(r, 'date'))
    summaryCards = [
      { title: 'Total Requisitions', value: filtered.length, format: 'number' },
      { title: 'Approved', value: filtered.filter((r) => r.status === 'Approved').length, format: 'number' }
    ]
    columns = [
      { key: 'srRef', header: 'SR Ref' },
      { key: 'department', header: 'Department' },
      { key: 'requestedBy', header: 'Requested By' },
      { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered
  } else if (reportType === 'siv-report') {
    const filtered = sivs.filter((s) => matchesFilter(s, 'date'))
    summaryCards = [
      { title: 'Total Vouchers', value: filtered.length, format: 'number' },
      { title: 'Issued', value: filtered.filter((s) => s.status === 'Issued').length, format: 'number' }
    ]
    columns = [
      { key: 'sivRef', header: 'Voucher Ref' },
      { key: 'type', header: 'Type' },
      { key: 'srRef', header: 'From Requisition' },
      { key: 'issuedTo', header: 'Issued To' },
      { key: 'issuedBy', header: 'Issued By' },
      { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered
  } else if (reportType === 'department-consumption') {
    const consumptionMap = new Map()
    sivs.forEach((s) => {
      if (s.status === 'Issued' && (!filters.startDate || new Date(s.date) >= new Date(filters.startDate))) {
        const dept = s.issuedTo
        if (!consumptionMap.has(dept)) {
          consumptionMap.set(dept, { department: dept, vouchersIssued: 0, itemsIssued: 0, value: 0 })
        }
        const entry = consumptionMap.get(dept)
        entry.vouchersIssued += 1
        s.items?.forEach((item) => {
          entry.itemsIssued += Number(item.qty) || 0
          entry.value += Number(item.qty) * Number(item.unitPrice) || 0
        })
      }
    })
    columns = [
      { key: 'department', header: 'Department' },
      { key: 'vouchersIssued', header: 'Vouchers Issued' },
      { key: 'itemsIssued', header: 'Items Issued' },
      { key: 'value', header: 'Total Value', render: (r) => formatCurrency(r.value) }
    ]
    rows = Array.from(consumptionMap.values())
  } else if (reportType === 'transfer-report') {
    const filtered = transfers.filter((t) => matchesFilter(t, 'date'))
    summaryCards = [
      { title: 'Total Transfers', value: filtered.length, format: 'number' },
      { title: 'Completed', value: filtered.filter((t) => t.status === 'Completed').length, format: 'number' }
    ]
    columns = [
      { key: 'transferRef', header: 'Transfer Ref' },
      { key: 'fromStore', header: 'From Store' },
      { key: 'toStore', header: 'To Store' },
      { key: 'requestedBy', header: 'Requested By' },
      { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered
  } else if (reportType === 'material-return-report') {
    const filtered = returns.filter((r) => matchesFilter(r, 'date'))
    summaryCards = [
      { title: 'Total Returns', value: filtered.length, format: 'number' },
      { title: 'Approved', value: filtered.filter((r) => r.status === 'Approved').length, format: 'number' }
    ]
    columns = [
      { key: 'srnRef', header: 'SRN Ref' },
      { key: 'department', header: 'Department' },
      { key: 'item', header: 'Item' },
      { key: 'qty', header: 'Quantity', render: (r) => formatNumber(r.qty) },
      { key: 'reason', header: 'Reason' },
      { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered
  } else if (reportType === 'asset-register') {
    const filtered = assets.filter((a) => matchesFilter(a, null, 'store'))
    summaryCards = [
      { title: 'Total Assets', value: filtered.length, format: 'number' },
      { title: 'Total Value', value: filtered.reduce((s, a) => s + Number(a.value), 0), format: 'currency' },
      { title: 'In Use', value: filtered.filter((a) => a.status === 'In Use').length, format: 'number' }
    ]
    columns = [
      { key: 'assetTag', header: 'Asset Tag' },
      { key: 'name', header: 'Asset Name' },
      { key: 'category', header: 'Category' },
      { key: 'store', header: 'Store' },
      { key: 'value', header: 'Value', render: (r) => formatCurrency(r.value) },
      { key: 'acquisitionDate', header: 'Acquisition Date', render: (r) => formatDate(r.acquisitionDate) },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered
  } else if (reportType === 'asset-assignment') {
    const filtered = assets.filter((a) => a.assignedTo && matchesFilter(a, null, 'store'))
    columns = [
      { key: 'assetTag', header: 'Asset Tag' },
      { key: 'name', header: 'Asset Name' },
      { key: 'assignedTo', header: 'Assigned To' },
      { key: 'store', header: 'Store' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      { key: 'acquisitionDate', header: 'Assigned Date', render: (r) => formatDate(r.acquisitionDate) }
    ]
    rows = filtered
  } else if (reportType === 'disposal-report') {
    const filtered = disposals.filter((d) => matchesFilter(d, 'dateFlagged'))
    summaryCards = [
      { title: 'Total Disposals', value: filtered.length, format: 'number' },
      { title: 'Executed', value: filtered.filter((d) => d.status === 'Executed').length, format: 'number' }
    ]
    columns = [
      { key: 'disposalRef', header: 'Disposal Ref' },
      { key: 'item', header: 'Item' },
      { key: 'store', header: 'Store' },
      { key: 'qty', header: 'Qty', render: (r) => formatNumber(r.qty) },
      { key: 'reason', header: 'Reason' },
      { key: 'dateFlagged', header: 'Date Flagged', render: (r) => formatDate(r.dateFlagged) },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
    ]
    rows = filtered
  } else if (reportType === 'low-stock') {
    const filtered = items.filter((i) => Number(i.qtyOnHand) <= Number(i.reorderLevel) && matchesFilter(i, null, 'store'))
    summaryCards = [
      { title: 'Low Stock Items', value: filtered.length, format: 'number' },
      { title: 'Estimated Reorder Value', value: filtered.reduce((s, i) => s + Number(i.reorderLevel) * Number(i.unitPrice), 0), format: 'currency' }
    ]
    columns = [
      { key: 'code', header: 'Item Code' },
      { key: 'name', header: 'Item Name' },
      { key: 'store', header: 'Store' },
      { key: 'qtyOnHand', header: 'Qty on Hand', render: (r) => formatNumber(r.qtyOnHand) },
      { key: 'reorderLevel', header: 'Reorder Level', render: (r) => formatNumber(r.reorderLevel) },
      { key: 'unitPrice', header: 'Unit Price', render: (r) => formatCurrency(r.unitPrice) }
    ]
    rows = filtered
  } else if (reportType === 'stock-movement') {
    const filtered = transactions.filter((t) => {
      if (query && !JSON.stringify(t).toLowerCase().includes(query.toLowerCase())) return false
      if (filters.startDate && new Date(t.date) < new Date(filters.startDate)) return false
      if (filters.endDate) {
        const end = new Date(filters.endDate)
        end.setHours(23, 59, 59, 999)
        if (new Date(t.date) > end) return false
      }
      return true
    })
    columns = [
      { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
      { key: 'item', header: 'Item' },
      { key: 'type', header: 'Type' },
      { key: 'ref', header: 'Reference' },
      { key: 'qtyIn', header: 'Qty In', render: (r) => formatNumber(r.qtyIn) },
      { key: 'qtyOut', header: 'Qty Out', render: (r) => formatNumber(r.qtyOut) },
      { key: 'balance', header: 'Balance', render: (r) => formatNumber(r.balance) }
    ]
    rows = filtered
  } else if (reportType === 'stock-variance') {
    const filtered = items.filter((i) => matchesFilter(i, null, 'store'))
    columns = [
      { key: 'code', header: 'Item Code' },
      { key: 'name', header: 'Item Name' },
      { key: 'store', header: 'Store' },
      { key: 'qtyOnHand', header: 'System Qty', render: (r) => formatNumber(r.qtyOnHand) },
      { key: 'minLevel', header: 'Min Level', render: (r) => formatNumber(r.minLevel) },
      { key: 'maxLevel', header: 'Max Level', render: (r) => formatNumber(r.maxLevel) }
    ]
    rows = filtered
  } else if (reportType === 'expiring-items') {
    const filtered = items.filter((i) => i.expiryDate && matchesFilter(i, null, 'store'))
    summaryCards = [
      { title: 'Expiring Items', value: filtered.length, format: 'number' },
      { title: 'Already Expired', value: filtered.filter((i) => new Date(i.expiryDate) < new Date()).length, format: 'number' }
    ]
    columns = [
      { key: 'code', header: 'Item Code' },
      { key: 'name', header: 'Item Name' },
      { key: 'store', header: 'Store' },
      { key: 'qtyOnHand', header: 'Qty', render: (r) => formatNumber(r.qtyOnHand) },
      { key: 'expiryDate', header: 'Expiry Date', render: (r) => formatDate(r.expiryDate) },
      { key: 'batchNo', header: 'Batch No' }
    ]
    rows = filtered
  } else if (reportType === 'supplier-transactions') {
    const supplierMap = new Map()
    grns.forEach((g) => {
      if (!supplierMap.has(g.supplier)) {
        supplierMap.set(g.supplier, { supplier: g.supplier, grnsReceived: 0, itemsReceived: 0, totalValue: 0 })
      }
      const entry = supplierMap.get(g.supplier)
      entry.grnsReceived += 1
      g.items?.forEach((item) => {
        entry.itemsReceived += Number(item.qty) || 0
        entry.totalValue += Number(item.qty) * Number(item.unitPrice) || 0
      })
    })
    columns = [
      { key: 'supplier', header: 'Supplier' },
      { key: 'grnsReceived', header: 'GRNs Received' },
      { key: 'itemsReceived', header: 'Items Received' },
      { key: 'totalValue', header: 'Total Value', render: (r) => formatCurrency(r.totalValue) }
    ]
    rows = Array.from(supplierMap.values())
  } else if (reportType === 'inventory-valuation') {
    const filtered = items.filter((i) => matchesFilter(i, null, 'store'))
    const totalValue = filtered.reduce((s, i) => s + Number(i.qtyOnHand) * Number(i.unitPrice), 0)
    summaryCards = [
      { title: 'Total Inventory Value', value: totalValue, format: 'currency' },
      { title: 'Total Items', value: filtered.length, format: 'number' },
      { title: 'Avg Item Value', value: filtered.length > 0 ? totalValue / filtered.length : 0, format: 'currency' }
    ]
    columns = [
      { key: 'code', header: 'Item Code' },
      { key: 'name', header: 'Item Name' },
      { key: 'store', header: 'Store' },
      { key: 'qtyOnHand', header: 'Qty', render: (r) => formatNumber(r.qtyOnHand) },
      { key: 'unitPrice', header: 'Unit Price', render: (r) => formatCurrency(r.unitPrice) },
      { key: 'value', header: 'Total Value', render: (r) => formatCurrency(r.qtyOnHand * r.unitPrice) }
    ]
    rows = filtered
  } else if (reportType === 'stock-movement-value') {
    const filtered = transactions.filter((t) => {
      if (filters.startDate && new Date(t.date) < new Date(filters.startDate)) return false
      if (filters.endDate) {
        const end = new Date(filters.endDate)
        end.setHours(23, 59, 59, 999)
        if (new Date(t.date) > end) return false
      }
      return true
    })
    columns = [
      { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
      { key: 'item', header: 'Item' },
      { key: 'type', header: 'Type' },
      { key: 'ref', header: 'Reference' },
      { key: 'qtyIn', header: 'Qty In' },
      { key: 'qtyOut', header: 'Qty Out' },
      { key: 'unitPrice', header: 'Unit Price', render: (r) => formatCurrency(r.unitPrice) },
      { key: 'inValue', header: 'In Value', render: (r) => formatCurrency(r.qtyIn * r.unitPrice) },
      { key: 'outValue', header: 'Out Value', render: (r) => formatCurrency(r.qtyOut * r.unitPrice) }
    ]
    rows = filtered
  } else if (reportType === 'fifo-valuation') {
    const filtered = items.filter((i) => matchesFilter(i, null, 'store'))
    const totalFifo = filtered.reduce((s, i) => s + computeFifoValue(i.name, i.qtyOnHand, transactions, i.unitPrice), 0)
    summaryCards = [
      { title: 'FIFO Inventory Value', value: totalFifo, format: 'currency' },
      { title: 'Total Items', value: filtered.length, format: 'number' }
    ]
    columns = [
      { key: 'code', header: 'Item Code' },
      { key: 'name', header: 'Item Name' },
      { key: 'store', header: 'Store' },
      { key: 'qtyOnHand', header: 'Qty', render: (r) => formatNumber(r.qtyOnHand) },
      { key: 'unitPrice', header: 'Current Unit Price', render: (r) => formatCurrency(r.unitPrice) },
      {
        key: 'fifoValue',
        header: 'FIFO Value',
        render: (r) => formatCurrency(computeFifoValue(r.name, r.qtyOnHand, transactions, r.unitPrice))
      }
    ]
    rows = filtered.map((item) => ({
      ...item,
      fifoValue: computeFifoValue(item.name, item.qtyOnHand, transactions, item.unitPrice)
    }))
  }

  if (serverReportRows && reportType !== 'fifo-valuation') {
    const serverDateKey = {
      'grn-status': 'receivedDate',
      'requisition-status': 'date',
      'siv-report': 'date',
      'material-return-report': 'date',
      'transfer-report': 'date',
      'asset-register': 'acquisitionDate',
      'disposal-report': 'date',
      'stock-movement': 'date'
    }[reportType]
    rows = serverReportRows.filter((record) => matchesFilter(record, serverDateKey))

    const summaryDefinitions = {
      'grn-status': [
        { title: 'Total GRNs', value: rows.length, format: 'number' },
        { title: 'Accepted', value: rows.filter((record) => record.status === 'Accepted').length, format: 'number' }
      ],
      'requisition-status': [
        { title: 'Total Requisitions', value: rows.length, format: 'number' },
        { title: 'Approved', value: rows.filter((record) => record.status === 'Approved').length, format: 'number' }
      ],
      'siv-report': [
        { title: 'Total Vouchers', value: rows.length, format: 'number' },
        { title: 'Issued', value: rows.filter((record) => record.status === 'Issued').length, format: 'number' }
      ],
      'material-return-report': [
        { title: 'Total Returns', value: rows.length, format: 'number' },
        { title: 'Approved', value: rows.filter((record) => record.status === 'Approved').length, format: 'number' }
      ],
      'transfer-report': [
        { title: 'Total Transfers', value: rows.length, format: 'number' },
        { title: 'Completed', value: rows.filter((record) => record.status === 'Completed').length, format: 'number' }
      ],
      'asset-register': [
        { title: 'Total Assets', value: rows.length, format: 'number' },
        { title: 'Total Value', value: rows.reduce((sum, record) => sum + Number(record.value || 0), 0), format: 'currency' },
        { title: 'In Use', value: rows.filter((record) => record.status === 'In Use').length, format: 'number' }
      ],
      'disposal-report': [
        { title: 'Total Disposals', value: rows.length, format: 'number' },
        { title: 'Executed', value: rows.filter((record) => record.status === 'Executed').length, format: 'number' }
      ]
    }
    if (summaryDefinitions[reportType]) summaryCards = summaryDefinitions[reportType]
  }

  const reportTitle = reportOptions.find((o) => o.value === reportType)?.label || 'Report'

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Operational reporting system with real-time data from all modules."
        actions={
          <Button variant="secondary" icon={Download} onClick={() => exportCsv(columns, rows)} disabled={!rows.length}>
            Export CSV
          </Button>
        }
      />

      {summaryCards.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((card, idx) => (
            <Card key={idx} title={card.title}>
              <p className="text-2xl font-semibold text-ink-900">
                {card.format === 'currency' ? formatCurrency(card.value) : card.format === 'number' ? formatNumber(card.value) : card.value}
              </p>
            </Card>
          ))}
        </div>
      )}

      <div className="card p-4 sm:p-5">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Report Type</label>
            <Select value={reportType} onChange={(e) => setReportType(e.target.value)} options={reportOptions} />
          </div>
          <div>
            <label className="label">Store</label>
            <Select value={filters.store} onChange={(e) => setFilters((p) => ({ ...p, store: e.target.value }))} options={storeOptions} />
          </div>
          <div>
            <label className="label">Category</label>
            <Select value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))} options={categoryOptions} />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search..." />
          <div>
            <label className="label">From date</label>
            <input type="date" className="input" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="label">To date</label>
            <input type="date" className="input" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={handlePrintReport} icon={Printer}>
              Print
            </Button>
          </div>
        </div>

        <Table columns={columns} rows={rows} loading={loading} emptyTitle={`No data for ${reportTitle}`} emptyMessage="No records match the current filters." pageSize={10} />
      </div>
    </div>
  )
}
