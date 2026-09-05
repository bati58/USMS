import { useEffect, useMemo, useState } from 'react'
import { Plus, Eye, CheckCircle2, XCircle, Trash2, Printer, Send } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import StatusBadge from '../../components/ui/StatusBadge'
import { materialReturnService, storeService, itemService, departmentService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { RETURN_STATUS, STATUS, ROLES } from '../../utils/constants'
import { canPerformAction } from '../../utils/rolePermissions'
import { uniqueItemsByName } from '../../utils/itemOptions'

const EMPTY_LINE = { item: '', qty: '', condition: 'Good', reason: 'Excess' }

export default function MaterialReturnList() {
  const { push } = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [stores, setStores] = useState([])
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [receiveInput, setReceiveInput] = useState({ actualQty: '', acceptedQty: '', rejectedQty: '', condition: '', remarks: '', rejectionReason: '' })
  const successToast = { duration: 2000 }

  const [header, setHeader] = useState({ department: '', store: '', date: '', originalIssueRef: '' })
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])
  const [rejectReason, setRejectReason] = useState('')

  const canReview = canPerformAction(user?.role, 'approve', 'materialReturns')
  const canReceive = user?.role === ROLES.STOREKEEPER
  const canCreate = canPerformAction(user?.role, 'create', 'materialReturns')
  const canDelete = canPerformAction(user?.role, 'delete', 'materialReturns')
  const REVIEWABLE_RETURN_STATUSES = [RETURN_STATUS.SUBMITTED, RETURN_STATUS.PENDING_REVIEW, STATUS.PENDING]
  const canReviewRow = (row) => REVIEWABLE_RETURN_STATUSES.includes(row.status) && canReview

  const userAssignedStore = user?.store || ''
  const isScopedStoreUser = user?.role === ROLES.STOREKEEPER && !!userAssignedStore
  const isMainStoreKeeper = user?.role === ROLES.STOREKEEPER && !userAssignedStore

  async function load() {
    setLoading(true)
    try {
      const [returns, storeList, itemList, departmentList] = await Promise.all([
        materialReturnService.list(),
        storeService.list(),
        itemService.list(),
        departmentService.list()
      ])
      setRows(returns)
      setStores(storeList.filter((store) => store.active !== false))
      setItems(itemList)
      setDepartments(departmentList.filter((department) => department.active))
    } catch (err) {
      push(err.message || 'Could not load material returns.', 'error')
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
    return rows.filter((r) => `${r.srnRef} ${r.department} ${r.store}`.toLowerCase().includes(q))
  }, [rows, query])

  function openCreate() {
    const defaultStore = isScopedStoreUser ? userAssignedStore : ''
    setHeader({
      department: user?.department || '',
      store: defaultStore,
      date: new Date().toISOString().slice(0, 10)
    })
    setLines([{ ...EMPTY_LINE }])
    setModalOpen(true)
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!header.department || !header.date || !lines.length || lines.some((line) => !line.item || !line.qty || Number(line.qty) <= 0)) {
      push('Returning department, date, and valid item and quantity details are required for every line.', 'error')
      return
    }
    if (new Set(lines.map((line) => line.item)).size !== lines.length) {
      push('Each returned item can only appear once in an SRN batch.', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await materialReturnService.createBatch({
        ...header,
        returnedBy: user?.name || 'Department Head',
        status: RETURN_STATUS.SUBMITTED,
        lines: lines.map((line) => ({ ...line, qty: Number(line.qty) }))
      })
      const createdRows = Array.isArray(created) ? created : [created]
      const createdRefs = createdRows.map((returnRow) => returnRow.srnRef)
      push(`${createdRefs.length} Store Return Note${createdRefs.length === 1 ? '' : 's'} created: ${createdRefs.join(', ')}`, 'success')
      setModalOpen(false)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(row) {
    try {
      await api.action('materialReturns', row.id, 'submit', {})
      push(`${row.srnRef} submitted for inspection.`, 'success')
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handleDecide(status) {
    if (!canReview) {
      push('Only store personnel can review returns.', 'error')
      return
    }

    const isReject = status !== RETURN_STATUS.RETURNED_TO_STOCK
    if (isReject && !rejectReason.trim()) {
      push('A rejection reason is required before rejecting this return.', 'error')
      return
    }

    setSaving(true)
    try {
      await api.action('materialReturns', viewing.id, 'approve', {
        decision: status === RETURN_STATUS.RETURNED_TO_STOCK ? 'Approved' : 'Rejected',
        qtyApproved: status === RETURN_STATUS.RETURNED_TO_STOCK ? (viewing.qtyApprovedInput ?? viewing.qty) : 0,
        findings: viewing.findingsInput,
        recommendation: viewing.recommendationInput,
        reason: isReject ? rejectReason.trim() : undefined
      })

      if (status === RETURN_STATUS.RETURNED_TO_STOCK) {
        push(`${viewing.srnRef} accepted. Materials returned to active stock.`, 'success')
      } else {
        push(`${viewing.srnRef} rejected.`, 'info')
      }

      setRejectReason('')
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReceive() {
    const actualQty = Number(receiveInput.actualQty)
    const acceptedQty = Number(receiveInput.acceptedQty)
    const rejectedQty = Number(receiveInput.rejectedQty)
    if (!Number.isFinite(actualQty) || actualQty < 0 || !Number.isFinite(acceptedQty) || acceptedQty < 0 || !Number.isFinite(rejectedQty) || rejectedQty < 0 || Math.abs(acceptedQty + rejectedQty - actualQty) > 0.0001) {
      push('Actual, accepted, and rejected quantities must be valid and accepted plus rejected must equal actual received.', 'error')
      return
    }
    setSaving(true)
    try {
      await api.action('materialReturns', viewing.id, 'receive', receiveInput)
      push(`${viewing.srnRef} received. Accepted quantity was returned to stock and Stock Cards, Bin Cards, and FIFO lots were updated.`, 'success', successToast)
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await materialReturnService.remove(deleteTarget.id)
      push(`Draft ${deleteTarget.srnRef} deleted. No stock changed.`, 'success', successToast)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      push(err.message || 'Could not delete return.', 'error')
    }
  }

  function openView(row) {
    setViewing(row)
    setRejectReason('')
    setReceiveInput({
      actualQty: row.qtyApproved ?? row.qty,
      acceptedQty: row.qtyApproved ?? row.qty,
      rejectedQty: 0,
      condition: row.condition || 'Good',
      remarks: '',
      rejectionReason: ''
    })
  }

  const hasAnyAction = filtered.some((row) => {
    const canView = true
    const canSubmit = row.status === RETURN_STATUS.DRAFT && canCreate
    const canRemove = row.status === RETURN_STATUS.SUBMITTED && canDelete
    return canView || canSubmit || canRemove
  })

  const columns = [
    { key: 'srnRef', header: 'SRN Ref' },
    { key: 'department', header: 'Department' },
    { key: 'store', header: 'Store' },
    { key: 'returnedBy', header: 'Returned By' },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ...(hasAnyAction ? [{
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1 items-center">
          <button onClick={() => openView(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600">
            <Eye size={15} />
          </button>
          {row.status === RETURN_STATUS.DRAFT && canCreate && row.returnedBy === user?.name && (
            <button onClick={() => handleSubmit(row)} className="rounded-md p-1.5 text-info-600 hover:bg-info-50" title="Submit return">
              <Send size={15} />
            </button>
          )}
          {row.status === RETURN_STATUS.SUBMITTED && canDelete && (
            <button onClick={() => setDeleteTarget(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-danger-50 hover:text-danger-700">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }] : [])
  ]

  return (
    <div>
      <PageHeader
        title="Material Returns"
        subtitle="Process unused, defective, or excess materials returned by departments."
        actions={canCreate ? <Button icon={Plus} onClick={openCreate}>New Return Request</Button> : null}
      />

      <div className="card p-5">
        <div className="mb-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search SRN ref, department..." />
        </div>
        <Table columns={columns} rows={filtered} loading={loading} emptyTitle="No returns yet" emptyMessage="Create a Store Return Note when a department returns unused materials." />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Store Return Note"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Submit Return Note
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {user?.role === ROLES.DEPT_HEAD ? (
              <Input
                label="Returning Department"
                required
                value={header.department || user?.department || ''}
                disabled
                readOnly
              />
            ) : (
              <Select
                label="Returning Department"
                required
                options={departments.map((department) => department.name)}
                value={header.department}
                onChange={(e) => setHeader((h) => ({ ...h, department: e.target.value }))}
                placeholder="Select a department..."
              />
            )}
            {isScopedStoreUser && !isMainStoreKeeper ? (
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Returning To Store</label>
                <div className="w-full px-3 py-2 border border-ink-300 rounded-md bg-ink-50 text-ink-700">
                  {userAssignedStore}
                </div>
              </div>
            ) : (
              <Select label="Returning To Store" required options={stores.map((s) => s.name)} value={header.store} onChange={(e) => setHeader((h) => ({ ...h, store: e.target.value }))} />
            )}
            <Input label="Date" type="date" required value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} />
            <Input label="Original SIV Reference" placeholder="e.g. SIV-2026-0001" value={header.originalIssueRef} onChange={(e) => setHeader((h) => ({ ...h, originalIssueRef: e.target.value }))} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label !mb-0">Materials to Return</p>
              <Button type="button" variant="secondary" icon={Plus} onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}>
                Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-ink-100 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <Select label="Item" options={uniqueItemsByName(items).map((i) => i.name)} value={line.item} onChange={(e) => updateLine(idx, { item: e.target.value })} />
                  <Input label="Quantity" type="number" value={line.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
                  <Select label="Reason" options={['Excess', 'Defective', 'Expired', 'Wrong Item']} value={line.reason} onChange={(e) => updateLine(idx, { reason: e.target.value })} />
                  <Select label="Condition" options={['Good', 'Damaged', 'Usable']} value={line.condition} onChange={(e) => updateLine(idx, { condition: e.target.value })} />
                  <Button type="button" variant="secondary" icon={Trash2} onClick={() => setLines((prev) => prev.length > 1 ? prev.filter((_, lineIdx) => lineIdx !== idx) : prev)} disabled={lines.length === 1} title="Remove line" />
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => {
          setViewing(null)
          setRejectReason('')
        }}
        title={viewing?.srnRef}
        size="lg"
        footer={
          viewing?.status === RETURN_STATUS.APPROVED && canReceive ? (
            <>
              <Button variant="secondary" icon={Printer} onClick={() => printReturnNote(viewing)}>Print SRN</Button>
              <Button icon={CheckCircle2} loading={saving} onClick={handleReceive}>Receive and Return to Stock</Button>
            </>
          ) : viewing && canReviewRow(viewing) ? (
            <>
              <Button variant="secondary" icon={Printer} onClick={() => printReturnNote(viewing)}>Print SRN Preview</Button>
              <Button variant="danger" icon={XCircle} loading={saving} onClick={() => handleDecide(RETURN_STATUS.REJECTED)}>
                Reject Return
              </Button>
              <Button icon={CheckCircle2} loading={saving} onClick={() => handleDecide(RETURN_STATUS.RETURNED_TO_STOCK)}>
                Accept to Stock
              </Button>
            </>
          ) : (
            <Button variant="secondary" icon={Printer} onClick={() => printReturnNote(viewing)}>Print SRN</Button>
          )
        }
      >
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Department" value={viewing.department} />
              <Field label="Store" value={viewing.store} />
              <Field label="Returned By" value={viewing.returnedBy} />
              <Field label="Status" value={<StatusBadge status={viewing.status} />} />
            </div>
            <div>
              <p className="mb-2 font-medium text-ink-700">Returned Materials</p>
              <table className="w-full text-left text-sm border border-ink-100 rounded">
                <thead className="bg-ink-50 text-ink-600">
                  <tr>
                    <th className="p-2 font-medium">Item</th>
                    <th className="p-2 font-medium">Qty</th>
                    <th className="p-2 font-medium">Reason</th>
                    <th className="p-2 font-medium">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  <tr>
                    <td className="p-2">{viewing.item || '-'}</td>
                    <td className="p-2">{viewing.qty ?? '-'}</td>
                    <td className="p-2">{viewing.reason || '-'}</td>
                    <td className="p-2">{viewing.condition || '-'}</td>
                  </tr>
                </tbody>
              </table>
              {viewing.status === RETURN_STATUS.APPROVED && canReceive && (
                <div className="mt-4 rounded-lg border border-success-100 bg-success-50 p-3 text-success-900">
                  <p className="mb-2 text-sm font-medium">Receiving Verification</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input label="Actual Received Qty" type="number" min="0" value={receiveInput.actualQty} onChange={(e) => setReceiveInput((current) => ({ ...current, actualQty: e.target.value }))} />
                    <Input label="Accepted Qty" type="number" min="0" value={receiveInput.acceptedQty} onChange={(e) => setReceiveInput((current) => ({ ...current, acceptedQty: e.target.value }))} />
                    <Input label="Rejected Qty" type="number" min="0" value={receiveInput.rejectedQty} onChange={(e) => setReceiveInput((current) => ({ ...current, rejectedQty: e.target.value }))} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select label="Received Condition" options={['Good', 'Usable', 'Damaged', 'Rejected']} value={receiveInput.condition} onChange={(e) => setReceiveInput((current) => ({ ...current, condition: e.target.value }))} />
                    <Input label="Receiving Remarks" value={receiveInput.remarks} onChange={(e) => setReceiveInput((current) => ({ ...current, remarks: e.target.value }))} />
                  </div>
                </div>
              )}
              {canReviewRow(viewing) && (
                <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-lg text-brand-800">
                  <p className="font-medium text-sm mb-1">Store Head Review Required</p>
                  <p className="text-xs text-brand-600">
                    Verify the physical items. If you choose "Accept to Stock", the items will be added back to the inventory and the bin card will be updated.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input label="Approved Quantity" type="number" min="0" max={viewing.qty} value={viewing.qtyApprovedInput ?? viewing.qty} onChange={(e) => setViewing((current) => ({ ...current, qtyApprovedInput: e.target.value }))} />
                    <Input label="Evaluation Recommendation" placeholder="Return to stock, repair, or disposal" value={viewing.recommendationInput || ''} onChange={(e) => setViewing((current) => ({ ...current, recommendationInput: e.target.value }))} />
                  </div>
                  <Input label="Inspection Findings" className="mt-3" value={viewing.findingsInput || ''} onChange={(e) => setViewing((current) => ({ ...current, findingsInput: e.target.value }))} />
                  <Input
                    label="Rejection Reason"
                    className="mt-3"
                    placeholder="Required only when rejecting this return"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} message={`Delete return request "${deleteTarget?.srnRef}"?`} confirmLabel="Delete" onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
    </div>
  )
}

function printReturnNote(record) {
  if (!record) return

  const finalStatuses = [RETURN_STATUS.FULLY_ACCEPTED, RETURN_STATUS.PARTIALLY_ACCEPTED, RETURN_STATUS.RETURNED_TO_STOCK]
  const statusLabel = finalStatuses.includes(record.status) ? record.status : `DRAFT - ${record.status || RETURN_STATUS.DRAFT}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${record.srnRef || 'SRN'} - ${statusLabel}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111827; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; }
          .title { font-size: 30px; font-weight: 700; margin: 0; }
          .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .ref { text-align: right; }
          .ref-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
          .ref-value { font-size: 24px; font-weight: 700; color: #1d4ed8; }
          .status { display: inline-block; margin-top: 6px; padding: 4px 8px; border: 1px solid #9ca3af; color: #374151; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-bottom: 24px; }
          .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; }
          .value { font-size: 14px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; }
          .sign { margin-top: 32px; border-top: 1px solid #374151; padding-top: 8px; font-size: 12px; }
          @page { size: A4; margin: 18mm; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Store Return Note</h1>
            <div class="subtitle">Material Return / SRN</div>
          </div>
          <div class="ref">
            <div class="ref-label">SRN Ref</div>
            <div class="ref-value">${record.srnRef || '-'}</div>
            <div class="status">${statusLabel}</div>
          </div>
        </div>

        <div class="grid">
          <div><div class="label">Department</div><div class="value">${record.department || '-'}</div></div>
          <div><div class="label">Store</div><div class="value">${record.store || '-'}</div></div>
          <div><div class="label">Returned By</div><div class="value">${record.returnedBy || '-'}</div></div>
          <div><div class="label">Status</div><div class="value">${record.status || '-'}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Reason</th>
              <th>Condition</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${record.item || '-'}</td>
              <td>${record.qty ?? '-'}</td>
              <td>${record.reason || '-'}</td>
              <td>${record.condition || '-'}</td>
            </tr>
          </tbody>
        </table>

        <div class="sign">
          <div>Prepared on: ${record.date ? new Date(record.date).toLocaleDateString() : '-'}</div>
        </div>
      </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-ink-500 mb-0.5">{label}</p>
      <p className="font-medium text-ink-900">{value ?? '-'}</p>
    </div>
  )
}
