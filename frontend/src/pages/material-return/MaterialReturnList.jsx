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

  const [header, setHeader] = useState({ department: '', store: '', date: '', originalIssueRef: '' })
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])

  const canReview = canPerformAction(user?.role, 'approve', 'materialReturns')
  const canReceive = user?.role === ROLES.STOREKEEPER
  const canCreate = canPerformAction(user?.role, 'create', 'materialReturns')
  const canDelete = canPerformAction(user?.role, 'delete', 'materialReturns')
  const canReviewRow = (row) => [RETURN_STATUS.SUBMITTED, STATUS.PENDING, STATUS.UNDER_EVALUATION].includes(row.status) && canReview

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

  async function handleCreate(e) {
    e.preventDefault()
    const line = lines[0]
    if (!header.department || !header.date || !line.item || !line.qty || Number(line.qty) <= 0) {
      push('Returning department, date, item, and a positive quantity are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const count = rows.length + 1
      const srnRef = `SRN-2026-${String(count).padStart(4, '0')}`
      await materialReturnService.create({
        srnRef,
        ...header,
        returnedBy: user?.name || 'Department Head',
        status: RETURN_STATUS.SUBMITTED,
        item: line.item,
        qty: Number(line.qty),
        reason: line.reason,
        condition: line.condition,
        originalIssueRef: header.originalIssueRef
      })
      push(`Draft Store Return Note ${srnRef} created. Submit it from the actions column.`, 'success')
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

    setSaving(true)
    try {
      await api.action('materialReturns', viewing.id, 'approve', {
        decision: status === RETURN_STATUS.RETURNED_TO_STOCK ? 'Approved' : 'Rejected',
        qtyApproved: status === RETURN_STATUS.RETURNED_TO_STOCK ? (viewing.qtyApprovedInput ?? viewing.qty) : 0,
        findings: viewing.findingsInput,
        recommendation: viewing.recommendationInput
      })

      if (status === RETURN_STATUS.RETURNED_TO_STOCK) {
        push(`${viewing.srnRef} accepted. Materials returned to active stock.`, 'success')
      } else {
        push(`${viewing.srnRef} rejected.`, 'info')
      }

      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReceive() {
    setSaving(true)
    try {
      await api.action('materialReturns', viewing.id, 'receive', {})
      push(`${viewing.srnRef} received and returned to stock.`, 'success')
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await materialReturnService.remove(deleteTarget.id)
    push('Return request deleted.', 'success')
    setDeleteTarget(null)
    await load()
  }

  const columns = [
    { key: 'srnRef', header: 'SRN Ref' },
    { key: 'department', header: 'Department' },
    { key: 'store', header: 'Store' },
    { key: 'returnedBy', header: 'Returned By' },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1 items-center">
          <button onClick={() => setViewing(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600">
            <Eye size={15} />
          </button>
          {row.status === RETURN_STATUS.DRAFT && canCreate && (
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
    }
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
            <Select
              label="Returning Department"
              required
              options={user?.role === ROLES.DEPT_HEAD ? [user?.department].filter(Boolean) : departments.map((department) => department.name)}
              value={header.department}
              disabled={user?.role === ROLES.DEPT_HEAD}
              onChange={(e) => setHeader((h) => ({ ...h, department: e.target.value }))}
              placeholder="Select a department..."
            />
            <Select label="Returning To Store" required options={stores.map((s) => s.name)} value={header.store} onChange={(e) => setHeader((h) => ({ ...h, store: e.target.value }))} />
            <Input label="Date" type="date" required value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} />
            <Input label="Original SIV Reference" placeholder="e.g. SIV-2026-0001" value={header.originalIssueRef} onChange={(e) => setHeader((h) => ({ ...h, originalIssueRef: e.target.value }))} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label !mb-0">Materials to Return</p>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-ink-100 p-3 sm:grid-cols-4">
                  <Select label="Item" options={items.map((i) => i.name)} value={line.item} onChange={(e) => updateLine(idx, { item: e.target.value })} />
                  <Input label="Quantity" type="number" value={line.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
                  <Select label="Reason" options={['Excess', 'Defective', 'Expired', 'Wrong Item']} value={line.reason} onChange={(e) => updateLine(idx, { reason: e.target.value })} />
                  <Select label="Condition" options={['Good', 'Damaged', 'Usable']} value={line.condition} onChange={(e) => updateLine(idx, { condition: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
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

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${record.srnRef || 'SRN'}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111827; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; }
          .title { font-size: 30px; font-weight: 700; margin: 0; }
          .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .ref { text-align: right; }
          .ref-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
          .ref-value { font-size: 24px; font-weight: 700; color: #1d4ed8; }
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
