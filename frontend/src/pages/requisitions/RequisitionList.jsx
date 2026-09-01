import { useEffect, useMemo, useState } from 'react'
import { Plus, Eye, CheckCircle2, XCircle, Trash2, Edit, Send, RotateCcw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import StatusBadge from '../../components/ui/StatusBadge'
import { requisitionService, storeService, itemService, departmentService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { REQUISITION_STATUS, ROLES } from '../../utils/constants'
import {
  canPerformAction,
  canApproveRequisition,
  canRejectRequisition
} from '../../utils/rolePermissions'

const EMPTY_LINE = { item: '', qty: '' }

export default function RequisitionList() {
  const { push } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id: requisitionId } = useParams()
  const [rows, setRows] = useState([])
  const [stores, setStores] = useState([])
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [approveLines, setApproveLines] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const [header, setHeader] = useState({ department: '', store: '', date: '' })
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])
  const [fieldErrors, setFieldErrors] = useState({})

  const canCreate = canPerformAction(user?.role, 'create', 'requisitions')
  const canDelete = canPerformAction(user?.role, 'delete', 'requisitions')
  const isPao = user?.role === ROLES.PAO
  const isDeptHead = user?.role === ROLES.DEPT_HEAD

  async function load() {
    setLoading(true)
    try {
      const [reqs, storeList, itemList, departmentList] = await Promise.all([
        requisitionService.list(),
        storeService.list(),
        itemService.list(),
        departmentService.list()
      ])
      setRows(reqs)
      setStores(storeList.filter((store) => store.active !== false))
      setItems(itemList)
      setDepartments(departmentList.filter((department) => department.active))
    } catch (err) {
      push(err.message || 'Could not load requisitions.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!requisitionId || loading) return
    const row = rows.find((requisition) => String(requisition.id) === String(requisitionId))
    if (row) handleOpenView(row)
  }, [requisitionId, rows, loading])

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter((r) => `${r.srRef} ${r.department} ${r.store}`.toLowerCase().includes(q))
  }, [rows, query])

  function openCreate() {
    if (!canCreate) {
      push('You do not have permission to create requisitions.', 'error')
      return
    }
    setHeader({
      department: user?.department || '',
      store: '',
      date: new Date().toISOString().slice(0, 10)
    })
    setLines([{ ...EMPTY_LINE }])
    setModalOpen(true)
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function removeLine(idx) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  function updateApproveLine(idx, patch) {
    setApproveLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function handleOpenView(row) {
    setViewing(row)
    setApproveLines(row.items.map(i => ({ ...i, qtyApproved: i.qtyApproved ?? i.qty })))
  }

  async function handleCreate(e) {
    e.preventDefault()

    const nextErrors = {}
    if (!header.department) nextErrors.department = 'Department is required.'
    if (!header.store) nextErrors.store = 'Issuing Store is required.'
    if (!header.date) nextErrors.date = 'Date is required.'

    lines.forEach((line, idx) => {
      if (!line.item) nextErrors[`line_${idx}_item`] = `Line ${idx + 1}: Item is required.`
      if (!line.qty || Number(line.qty) <= 0) nextErrors[`line_${idx}_qty`] = `Line ${idx + 1}: Quantity must be greater than zero.`
    })

    if (!lines.some((line) => line.item && line.qty)) {
      nextErrors.items = 'At least one item with quantity is required.'
    }

    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const message = Object.values(nextErrors).slice(0, 5).join(' • ')
      push(`Missing required details: ${message}`, 'error')
      return
    }

    setSaving(true)
    try {
      const count = rows.length + 1
      const srRef = `SR-2026-${String(40 + count).padStart(4, '0')}`
      await requisitionService.create({
        srRef,
        ...header,
        requestedBy: user?.name || 'Department Head',
        status: REQUISITION_STATUS.PENDING,
        items: lines.filter((l) => l.item && l.qty)
      })
      push(`Requisition ${srRef} submitted for approval.`, 'success')
      setFieldErrors({})
      setModalOpen(false)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function decide(status) {
    const allowed =
      status === REQUISITION_STATUS.APPROVED || status === REQUISITION_STATUS.PARTIALLY_APPROVED
        ? canApproveRequisition(user, viewing)
        : canRejectRequisition(user, viewing)

    if (!allowed) {
      push('You do not have permission to action this requisition.', 'error')
      return
    }

    // Check if it's partially approved
    let finalStatus = status
    if (status === REQUISITION_STATUS.APPROVED) {
      const isPartial = approveLines.some(l => Number(l.qtyApproved) < Number(l.qty) && Number(l.qtyApproved) >= 0)
      if (isPartial) finalStatus = REQUISITION_STATUS.PARTIALLY_APPROVED
    }

    await api.action('requisitions', viewing.id, 'approve', {
      decision: finalStatus,
      items: approveLines
    })
    push(finalStatus === REQUISITION_STATUS.REJECTED ? `${viewing.srRef} rejected.` : `${viewing.srRef} approved. Storekeeper can now create the issue voucher.`, finalStatus === REQUISITION_STATUS.REJECTED ? 'info' : 'success')
    setViewing(null)
    await load()
  }

  async function submitRequisition() {
    setSaving(true)
    try {
      await api.action('requisitions', viewing.id, 'submit', {})
      push(`${viewing.srRef} submitted for approval.`, 'success')
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await requisitionService.remove(deleteTarget.id)
    push('Requisition deleted.', 'success')
    setDeleteTarget(null)
    await load()
  }

  const columns = [
    { key: 'srRef', header: 'SR Ref' },
    { key: 'department', header: 'Department' },
    { key: 'store', header: 'Store' },
    { key: 'requestedBy', header: 'Requested By' },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => handleOpenView(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600">
            <Eye size={15} />
          </button>
          {canDelete && (
            <button onClick={() => setDeleteTarget(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-danger-50 hover:text-danger-700">
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
        title="Store Requisitions"
        subtitle={
          isPao
            ? 'Review and approve department requisitions before the storekeeper issues materials.'
            : isDeptHead
              ? 'Submit and approve requisitions for your department.'
              : 'Departments raise store requisitions for approval before issue.'
        }
        actions={
          canCreate ? (
            <Button icon={Plus} onClick={openCreate}>
              New Requisition
            </Button>
          ) : null
        }
      />

      <div className="card p-5">
        <div className="mb-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search SR ref, department..." />
        </div>
        <Table columns={columns} rows={filtered} loading={loading} emptyTitle="No requisitions yet" emptyMessage="Submit a store requisition to request materials." />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Store Requisition"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Submit Requisition
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Requesting Department"
              required
              error={fieldErrors.department}
              options={isDeptHead ? [user?.department].filter(Boolean) : departments.map((department) => department.name)}
              value={header.department}
              disabled={isDeptHead}
              onChange={(e) => { setHeader((h) => ({ ...h, department: e.target.value })); setFieldErrors((prev) => ({ ...prev, department: '' })) }}
              placeholder="Select a department..."
            />
            <Select label="Issuing Store" required error={fieldErrors.store} options={stores.map((s) => s.name)} value={header.store} onChange={(e) => { setHeader((h) => ({ ...h, store: e.target.value })); setFieldErrors((prev) => ({ ...prev, store: '' })) }} />
            <Input label="Date" type="date" required error={fieldErrors.date} value={header.date} onChange={(e) => { setHeader((h) => ({ ...h, date: e.target.value })); setFieldErrors((prev) => ({ ...prev, date: '' })) }} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label !mb-0">Items Requested</p>
              <Button type="button" variant="secondary" icon={Plus} onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}>
                Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-ink-100 p-3 sm:grid-cols-2">
                  <Select label="Item" error={fieldErrors[`line_${idx}_item`]} options={items.map((i) => i.name)} value={line.item} onChange={(e) => { updateLine(idx, { item: e.target.value }); setFieldErrors((prev) => ({ ...prev, [`line_${idx}_item`]: '' })) }} />
                  <div>
                    <Input label="Quantity" type="number" error={fieldErrors[`line_${idx}_qty`]} value={line.qty} onChange={(e) => { updateLine(idx, { qty: e.target.value }); setFieldErrors((prev) => ({ ...prev, [`line_${idx}_qty`]: '' })) }} />
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

      <Modal
        open={Boolean(viewing)}
        onClose={() => {
          setViewing(null)
          if (requisitionId) navigate('/requisitions', { replace: true })
        }}
        title={viewing?.srRef}
        size="lg"
        footer={
          <>
            {viewing?.status === REQUISITION_STATUS.DRAFT && canCreate && (
              <Button icon={Send} loading={saving} onClick={submitRequisition}>
                Submit for Approval
              </Button>
            )}
            {viewing?.status === REQUISITION_STATUS.SUBMITTED &&
              (canApproveRequisition(user, viewing) || canRejectRequisition(user, viewing)) && (
                <>
                  {canRejectRequisition(user, viewing) && (
                    <Button variant="danger" icon={XCircle} loading={saving} onClick={() => decide(REQUISITION_STATUS.REJECTED)}>
                      Reject
                    </Button>
                  )}
                  {canApproveRequisition(user, viewing) && (
                    <>
                      <Button variant="secondary" icon={RotateCcw} loading={saving} onClick={() => decide(REQUISITION_STATUS.RETURNED)}>
                        Return for Correction
                      </Button>
                      <Button icon={CheckCircle2} loading={saving} onClick={() => decide(REQUISITION_STATUS.APPROVED)}>
                        Approve (Full/Partial)
                      </Button>
                    </>
                  )}
                </>
              )}
          </>
        }
      >
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Department" value={viewing.department} />
              <Field label="Store" value={viewing.store} />
              <Field label="Requested By" value={viewing.requestedBy} />
              <Field label="Status" value={<StatusBadge status={viewing.status} />} />
            </div>
            <div>
              <p className="mb-2 font-medium text-ink-700">Requested Items</p>
              <table className="w-full text-left text-sm">
                <thead className="text-ink-500 border-b border-ink-100">
                  <tr>
                    <th className="py-2">Item</th>
                    <th className="py-2">Requested Qty</th>
                    <th className="py-2">Approved Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {approveLines.map((l, i) => (
                    <tr key={i} className="border-b border-ink-50">
                      <td className="py-2 font-medium">{l.item}</td>
                      <td className="py-2">{l.qty}</td>
                      <td className="py-2">
                        {viewing.status === REQUISITION_STATUS.SUBMITTED && canApproveRequisition(user, viewing) ? (
                          <input
                            type="number"
                            className="w-20 rounded border border-ink-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                            value={l.qtyApproved}
                            max={l.qty}
                            min={0}
                            onChange={(e) => updateApproveLine(i, { qtyApproved: e.target.value })}
                          />
                        ) : (
                          <span className="font-semibold text-brand-700">{l.qtyApproved}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewing.status === REQUISITION_STATUS.SUBMITTED && canApproveRequisition(user, viewing) && (
                <p className="mt-2 text-xs text-ink-500">
                  You can adjust the Approved Qty to issue a partial approval.
                </p>
              )}
            </div>
            {viewing.approvals?.length > 0 && (
              <div className="border-t border-ink-100 pt-4">
                <p className="mb-2 font-medium text-ink-700">Approval History</p>
                <div className="space-y-2">
                  {viewing.approvals.map((approval, index) => (
                    <div key={`${approval.approvedAt}-${index}`} className="rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-ink-800">{approval.decision}</span>
                        <span className="text-ink-500">{formatDate(approval.approvedAt)}</span>
                      </div>
                      <p className="mt-1 text-ink-600">By {approval.approvedBy || 'Unknown'}</p>
                      {approval.comments && <p className="mt-1 text-ink-600">{approval.comments}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} message={`Delete requisition "${deleteTarget?.srRef}"?`} confirmLabel="Delete" onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
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
