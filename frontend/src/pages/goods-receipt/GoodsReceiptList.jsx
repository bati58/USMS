import { useEffect, useMemo, useState } from 'react'
import { Plus, Eye, Trash2, Send, FileText, PackageCheck } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import StatusBadge from '../../components/ui/StatusBadge'
import { goodsReceiptService, storeService, itemService, supplierService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { GRN_STATUS, ROLES } from '../../utils/constants'
import { uniqueItemsByName } from '../../utils/itemOptions'

const EMPTY_LINE = { item: '', qty: '', unitPrice: '' }

export default function GoodsReceiptList() {
  const { push } = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [stores, setStores] = useState([])
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState('')

  const [header, setHeader] = useState({ supplier: '', poRef: '', store: '', receivedDate: '', type: 'Consumable', docRef: '', condition: 'New' })
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])
  const [fieldErrors, setFieldErrors] = useState({})

  const isStorekeeper = user?.role === ROLES.STOREKEEPER
  const isStoreHead = user?.role === ROLES.STORE_HEAD
  const userAssignedStore = user?.store || ''
  const isScopedStoreUser = (isStorekeeper || isStoreHead) && !!userAssignedStore
  const isMainStoreHead = isStoreHead && !userAssignedStore
  const assignedStoreNames = user?.assignedStores?.length ? user.assignedStores : [userAssignedStore].filter(Boolean)
  const hasMainStoreAssignment = assignedStoreNames.some((storeName) =>
    stores.some((store) => store.name === storeName && store.type === 'Main Store')
  )
  const receiptCatalogItems = useMemo(() => {
    const selectedStore = stores.find((store) => store.name === header.store)
    if (!selectedStore || selectedStore.type !== 'Main Store') return []

    return uniqueItemsByName(items)
  }, [items, stores, header.store])
  const canManage = isStorekeeper && hasMainStoreAssignment
  const canPost = canManage
  const showPermissionState = !loading
  const canNotifyTec = isStoreHead
  const successToast = { duration: 2000 }
  const canManageRow = (row) => !isStoreHead || !userAssignedStore || assignedStoreNames.includes(row.store)

  async function load() {
    setLoading(true)
    try {
      const [grns, storeList, itemList, supplierList] = await Promise.all([goodsReceiptService.list(), storeService.list(), itemService.listMaster(), supplierService.list()])
      setRows(grns)
      setStores(storeList.filter((store) => store.active !== false))
      setItems(itemList)
      setSuppliers(supplierList)
    } catch (err) {
      push(err.message || 'Could not load goods receipts.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter((r) => `${r.grnRef} ${r.supplier} ${r.poRef} ${r.store}`.toLowerCase().includes(q))
  }, [rows, query])

  function openCreate() {
    if (!canManage) {
      push('You do not have permission to record goods receipts.', 'error')
      return
    }
    const defaultStore = isScopedStoreUser ? userAssignedStore : ''
    setHeader({ supplier: '', poRef: '', store: defaultStore, receivedDate: '', type: 'Consumable', docRef: '', condition: 'New' })
    setLines([{ ...EMPTY_LINE }])
    setModalOpen(true)
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
    setFieldErrors((prev) => ({ ...prev }))
  }

  function removeLine(idx) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  function validateForm() {
    const nextErrors = {}

    if (!header.supplier) nextErrors.supplier = 'Supplier is required.'
    if (!header.poRef) nextErrors.poRef = 'PO / Donation Ref is required.'
    if (!header.store) nextErrors.store = 'Receiving Store is required.'
    if (!header.receivedDate) nextErrors.receivedDate = 'Received Date is required.'
    if (!header.type) nextErrors.type = 'Material Type is required.'

    lines.forEach((line, idx) => {
      if (!line.item) nextErrors[`line_${idx}_item`] = `Line ${idx + 1}: Item is required.`
      if (!line.qty || Number(line.qty) <= 0) nextErrors[`line_${idx}_qty`] = `Line ${idx + 1}: Quantity must be greater than zero.`
      if (!line.unitPrice || Number(line.unitPrice) < 0) nextErrors[`line_${idx}_unitPrice`] = `Line ${idx + 1}: Unit Price is required.`
    })

    if (!lines.some((line) => line.item && line.qty)) {
      nextErrors.items = 'At least one item with quantity is required.'
    }

    return nextErrors
  }

  async function handleCreate(e) {
    e.preventDefault()
    const errors = validateForm()
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      const message = Object.values(errors).slice(0, 5).join(' • ')
      push(`Missing required details: ${message}`, 'error')
      return
    }

    setSaving(true)
    try {
      await goodsReceiptService.create({
        ...header,
        materialType: header.type,
        type: undefined,
        receivedBy: user?.name || 'Storekeeper',
        status: GRN_STATUS.SUBMITTED,
        items: lines.filter((l) => l.item && l.qty),
        evaluationNote: '',
        evaluatedBy: ''
      })
      push('Draft receipt created. No stock changed. Submit it next so the Store Head and Security Officer can act.', 'success', successToast)
      setFieldErrors({})
      setModalOpen(false)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(row) {
    if (actionBusy) return
    setActionBusy(`submit-${row.id}`)
    try {
      await api.action('goodsReceipts', row.id, 'status', { status: GRN_STATUS.SUBMITTED })
      push(`${row.grnRef} submitted. Store Head review and Security gate verification are now required.`, 'success', successToast)
      await load()
    } catch (e) {
      push(e.message, 'error')
    } finally {
      setActionBusy('')
    }
  }

  async function handleNotifyTEC(row) {
    if (actionBusy) return
    setActionBusy(`tec-${row.id}`)
    try {
      await api.action('goodsReceipts', row.id, 'status', { status: GRN_STATUS.PENDING_EVAL })
      push(`${row.grnRef} sent to Technical Evaluation. TEC is the next responsible actor.`, 'success', successToast)
      await load()
    } catch (e) {
      push(e.message, 'error')
    } finally {
      setActionBusy('')
    }
  }

  async function handleStartStoreHeadReview(row) {
    if (actionBusy) return
    setActionBusy(`review-${row.id}`)
    try {
      await api.action('goodsReceipts', row.id, 'status', { status: GRN_STATUS.STORE_HEAD_REVIEW })
      push(`${row.grnRef} is now under Store Head review.`, 'success', successToast)
      await load()
    } catch (e) {
      push(e.message, 'error')
    } finally {
      setActionBusy('')
    }
  }

  async function handleGenerateGRN(row) {
    if (actionBusy) return
    setActionBusy(`generate-${row.id}`)
    try {
      await api.action('goodsReceipts', row.id, 'generate-grn', {})
      push(`Official GRN generated for ${row.grnRef}. No stock changed yet. Review it, then post accepted stock.`, 'success', successToast)
      await load()
    } catch (e) {
      push(e.message, 'error')
    } finally {
      setActionBusy('')
    }
  }

  async function handlePostStock(row) {
    if (actionBusy) return
    setActionBusy(`post-${row.id}`)
    try {
      await api.action('goodsReceipts', row.id, 'post-stock', {})
      const acceptedQty = (row.items || []).reduce((sum, line) => sum + Number(line.qtyAccepted ?? line.qty ?? 0), 0)
      push(`${acceptedQty} accepted unit(s) from ${row.grnRef} posted. Item balances, Stock Cards, Bin Cards, and FIFO lots were updated.`, 'success', successToast)
      await load()
    } catch (e) {
      push(e.message, 'error')
    } finally {
      setActionBusy('')
    }
  }

  async function handleDelete() {
    if (actionBusy) return
    setActionBusy(`delete-${deleteTarget.id}`)
    try {
      await goodsReceiptService.remove(deleteTarget.id)
      push(`Draft ${deleteTarget.grnRef} deleted. No stock was changed.`, 'success', successToast)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      push(e.message, 'error')
    } finally {
      setActionBusy('')
    }
  }

  const columns = [
    { key: 'grnRef', header: 'GRN Ref' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'poRef', header: 'PO / Ref' },
    { key: 'store', header: 'Store' },
    { key: 'receivedDate', header: 'Received', render: (r) => formatDate(r.receivedDate) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1 items-center">
          {canNotifyTec && canManageRow(row) && row.status === GRN_STATUS.SUBMITTED && (
            <button disabled={Boolean(actionBusy)} onClick={() => handleStartStoreHeadReview(row)} className="rounded-md p-1.5 text-info-600 hover:bg-info-50 disabled:cursor-not-allowed disabled:opacity-50" title="Start Store Head review">
              <Send size={15} />
            </button>
          )}
          {canNotifyTec && canManageRow(row) && row.status === GRN_STATUS.STORE_HEAD_REVIEW && row.gateVerified && (
            <button disabled={Boolean(actionBusy)} onClick={() => handleNotifyTEC(row)} className="rounded-md p-1.5 text-info-600 hover:bg-info-50 disabled:cursor-not-allowed disabled:opacity-50" title="Notify TEC">
              <Send size={15} />
            </button>
          )}
          {canManage && canManageRow(row) && row.status === GRN_STATUS.DRAFT && (
            <button disabled={Boolean(actionBusy)} onClick={() => handleSubmit(row)} className="rounded-md p-1.5 text-info-600 hover:bg-info-50 disabled:cursor-not-allowed disabled:opacity-50" title="Submit for review">
              <Send size={15} />
            </button>
          )}
          {canManage && canManageRow(row) && (row.status === GRN_STATUS.ACCEPTED || row.status === GRN_STATUS.PARTIALLY_ACCEPTED) && (
            <button disabled={Boolean(actionBusy)} onClick={() => handleGenerateGRN(row)} className="rounded-md p-1.5 text-success-600 hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-50" title="Generate GRN">
              <FileText size={15} />
            </button>
          )}
          {canPost && canManageRow(row) && row.status === GRN_STATUS.GRN_GENERATED && (
            <button disabled={Boolean(actionBusy)} onClick={() => handlePostStock(row)} className="rounded-md p-1.5 text-success-600 hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-50" title="Post accepted stock">
              <PackageCheck size={15} />
            </button>
          )}
          <button onClick={() => setViewing(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600" title="View">
            <Eye size={15} />
          </button>
          {canManage && canManageRow(row) && [GRN_STATUS.DRAFT, GRN_STATUS.SUBMITTED, GRN_STATUS.STORE_HEAD_REVIEW, GRN_STATUS.PENDING, GRN_STATUS.PENDING_EVAL].includes(row.status) && (
            <button disabled={Boolean(actionBusy)} onClick={() => setDeleteTarget(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-danger-50 hover:text-danger-700 disabled:cursor-not-allowed disabled:opacity-50" title="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader
        title="Goods Receipt"
        subtitle="Record incoming materials, verify against the purchase or donation, and hand off to technical evaluation."
        actions={
          showPermissionState && canManage ? (
            <Button icon={Plus} onClick={openCreate}>
              Record Goods Receipt
            </Button>
          ) : null
        }
      />

      {showPermissionState && !canManage && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Read-only access:</span> this role can view goods receipts but cannot record, process, or delete them.
          </p>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search GRN, supplier, PO..." />
        </div>
        <Table columns={columns} rows={filtered} loading={loading} emptyTitle="No goods receipts yet" emptyMessage="Record a goods receipt when a supplier delivers materials." />
      </div>

      {/* Create GRN modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Goods Receipt"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Create Temporary Receipt
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Supplier" required error={fieldErrors.supplier} options={suppliers.filter((s) => s.active).map((s) => s.name)} value={header.supplier} onChange={(e) => { setHeader((h) => ({ ...h, supplier: e.target.value })); setFieldErrors((prev) => ({ ...prev, supplier: '' })) }} />
            <Input label="PO / Donation Ref" required error={fieldErrors.poRef} value={header.poRef} onChange={(e) => { setHeader((h) => ({ ...h, poRef: e.target.value })); setFieldErrors((prev) => ({ ...prev, poRef: '' })) }} />
            <Input label="Supporting Document Ref" placeholder="e.g. Waybill-123" value={header.docRef} onChange={(e) => setHeader((h) => ({ ...h, docRef: e.target.value }))} />
            {isScopedStoreUser && !isMainStoreHead ? (
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Receiving Store</label>
                <div className="w-full px-3 py-2 border border-ink-300 rounded-md bg-ink-50 text-ink-700">
                  {userAssignedStore}
                </div>
                <input type="hidden" value={userAssignedStore} onChange={(e) => setHeader((h) => ({ ...h, store: e.target.value }))} />
              </div>
            ) : (
              <Select label="Receiving Store" required error={fieldErrors.store} options={stores.map((s) => s.name)} value={header.store} onChange={(e) => { setHeader((h) => ({ ...h, store: e.target.value })); setFieldErrors((prev) => ({ ...prev, store: '' })) }} />
            )}
            <Input label="Received Date" type="date" required error={fieldErrors.receivedDate} value={header.receivedDate} onChange={(e) => { setHeader((h) => ({ ...h, receivedDate: e.target.value })); setFieldErrors((prev) => ({ ...prev, receivedDate: '' })) }} />
            <Select label="Material Type" required error={fieldErrors.type} options={['Consumable', 'Fixed Asset']} value={header.type} onChange={(e) => { setHeader((h) => ({ ...h, type: e.target.value })); setFieldErrors((prev) => ({ ...prev, type: '' })) }} />
            <Select label="Condition on Arrival" options={['New', 'Good', 'Damaged']} value={header.condition} onChange={(e) => setHeader((h) => ({ ...h, condition: e.target.value }))} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label !mb-0">Items Received</p>
              <Button type="button" variant="secondary" icon={Plus} onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}>
                Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-ink-100 p-3 sm:grid-cols-3 bg-ink-50">
                  <div className="sm:col-span-1">
                    <Select
                      label="Item"
                      error={fieldErrors[`line_${idx}_item`]}
                      options={receiptCatalogItems.map((item) => item.name)}
                      value={line.item}
                      onChange={(e) => {
                        updateLine(idx, { item: e.target.value })
                        setFieldErrors((prev) => ({ ...prev, [`line_${idx}_item`]: '' }))
                      }}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Input label="Quantity" type="number" error={fieldErrors[`line_${idx}_qty`]} value={line.qty} onChange={(e) => {
                      updateLine(idx, { qty: e.target.value })
                      setFieldErrors((prev) => ({ ...prev, [`line_${idx}_qty`]: '' }))
                    }} />
                  </div>
                  <div className="sm:col-span-1">
                    <Input label="Unit Price" type="number" error={fieldErrors[`line_${idx}_unitPrice`]} value={line.unitPrice} onChange={(e) => {
                      updateLine(idx, { unitPrice: e.target.value })
                      setFieldErrors((prev) => ({ ...prev, [`line_${idx}_unitPrice`]: '' }))
                    }} />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="mt-2 rounded border border-danger-200 bg-danger-50 px-2 py-1 text-xs font-medium text-danger-700 hover:bg-danger-100"
                        onClick={() => removeLine(idx)}
                      >
                        Remove line
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {fieldErrors.items && <p className="mt-2 text-xs font-medium text-danger-700">{fieldErrors.items}</p>}
          </div>
        </form>
      </Modal>

      {/* View GRN modal */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.grnRef} size="lg">
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Supplier" value={viewing.supplier} />
              <Field label="PO / Donation Ref" value={viewing.poRef} />
              <Field label="Supporting Document" value={viewing.docRef} />
              <Field label="Store" value={viewing.store} />
              <Field label="Material Type" value={viewing.type} />
              <Field label="Condition" value={viewing.condition} />
              <Field label="Received Date" value={formatDate(viewing.receivedDate)} />
              <Field label="Received By" value={viewing.receivedBy} />
              <Field label="Status" value={<StatusBadge status={viewing.status} />} />
            </div>
            <div>
              <p className="mb-2 font-medium text-ink-700">Items</p>
              <table className="w-full text-left text-sm">
                <thead className="text-ink-500 border-b border-ink-100">
                  <tr>
                    <th className="py-2">Item</th>
                    <th className="py-2">Qty</th>
                    <th className="py-2">Accepted</th>
                    <th className="py-2">Rejected</th>
                    <th className="py-2">Unit Price</th>
                    <th className="py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewing.items?.map((l, i) => (
                    <tr key={i} className="border-b border-ink-50">
                      <td className="py-2">{l.item}</td>
                      <td className="py-2">{l.qty}</td>
                      <td className="py-2">{l.qtyAccepted == null ? '-' : l.qtyAccepted}</td>
                      <td className="py-2">{l.qtyRejected == null ? '-' : l.qtyRejected}</td>
                      <td className="py-2">{formatCurrency(l.unitPrice)}</td>
                      <td className="py-2">{formatCurrency(l.qty * l.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewing.evaluationNote && (
              <div className="rounded-lg bg-ink-50 p-4 border border-ink-100 mt-4">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1">Technical Evaluation</p>
                <p className="text-ink-800">{viewing.evaluationNote}</p>
                <p className="mt-2 text-xs text-ink-500">Evaluated by {viewing.evaluatedBy}</p>
                {viewing.evaluationDate && <p className="mt-1 text-xs text-ink-500">Evaluation date: {formatDate(viewing.evaluationDate)}</p>}
                {viewing.evaluationFindings && <p className="mt-2 text-ink-700">Findings: {viewing.evaluationFindings}</p>}
                {viewing.evaluationCondition && <p className="mt-1 text-ink-700">Condition: {viewing.evaluationCondition}</p>}
                {viewing.evaluationEvidence && <p className="mt-1 text-ink-700">Evidence: {viewing.evaluationEvidence}</p>}
              </div>
            )}
            {viewing.status === GRN_STATUS.GRN_GENERATED && (
              <div className="rounded-lg bg-success-50 p-4 border border-success-100 mt-4 flex items-center gap-3">
                <FileText className="text-success-600" />
                <div>
                  <p className="text-sm font-semibold text-success-800">Official Model 19 GRN Generated</p>
                  <p className="text-xs text-success-700">Review the GRN, then use Post Accepted Stock to update inventory.</p>
                </div>
              </div>
            )}
            {viewing.status === GRN_STATUS.POSTED && (
              <div className="rounded-lg bg-success-50 p-4 border border-success-100 mt-4 flex items-center gap-3">
                <PackageCheck className="text-success-600" />
                <div>
                  <p className="text-sm font-semibold text-success-800">Accepted stock posted</p>
                  <p className="text-xs text-success-700">Stock cards and bin cards were updated atomically.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        message={`Delete receipt "${deleteTarget?.grnRef}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-ink-500 mb-0.5">{label}</p>
      <p className="font-medium text-ink-900">{value ?? '-'}</p>
    </div>
  )
}
