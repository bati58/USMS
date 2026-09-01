import { useEffect, useMemo, useState } from 'react'
import { Plus, Eye, CheckCircle2, XCircle, Truck, PackageCheck, Trash2, RotateCcw } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import StatusBadge from '../../components/ui/StatusBadge'
import { materialTransferService, storeService, itemService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { TRANSFER_STATUS, ROLES } from '../../utils/constants'
import { canPerformAction } from '../../utils/rolePermissions'

const EMPTY_LINE = { item: '', qty: '' }

export default function MaterialTransferList() {
  const { push } = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [stores, setStores] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const [header, setHeader] = useState({ fromStore: '', toStore: '', date: '', destinationBin: '' })
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])

  const canApprove = canPerformAction(user?.role, 'approve', 'materialTransfers')
  const canCreate = canPerformAction(user?.role, 'create', 'materialTransfers')
  // Store operators who physically move goods (backend: material-transfers-execute).
  const isStorekeeper = [ROLES.STOREKEEPER, ROLES.STORE_HEAD].includes(user?.role)

  async function load() {
    setLoading(true)
    try {
      const [transfers, storeList, itemList] = await Promise.all([materialTransferService.list(), storeService.list(), itemService.list()])
      setRows(transfers)
      setStores(storeList.filter((store) => store.active !== false))
      setItems(itemList)
    } catch (err) {
      push(err.message || 'Could not load material transfers.', 'error')
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
    return rows.filter((r) => `${r.transferRef} ${r.fromStore} ${r.toStore}`.toLowerCase().includes(q))
  }, [rows, query])

  function openCreate() {
    setHeader({
      fromStore: '',
      toStore: '',
      date: new Date().toISOString().slice(0, 10),
      destinationBin: ''
    })
    setLines([{ ...EMPTY_LINE }])
    setModalOpen(true)
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (header.fromStore === header.toStore) {
      push('Source and destination stores must be different.', 'error')
      return
    }
    const line = lines[0]
    if (!header.fromStore || !header.toStore || !header.date || !line.item || !line.qty || Number(line.qty) <= 0) {
      push('Source store, destination store, date, item, and a positive quantity are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const count = rows.length + 1
      const transferRef = `TRF-2026-${String(count).padStart(4, '0')}`
      await materialTransferService.create({
        transferRef,
        ...header,
        requestedBy: user?.name || 'Storekeeper',
        status: TRANSFER_STATUS.PENDING_APPROVAL,
        item: line.item,
        qty: Number(line.qty),
        destinationBin: header.destinationBin
      })
      push(`Transfer request ${transferRef} submitted for PAO approval.`, 'success')
      setModalOpen(false)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDecide(status) {
    setSaving(true)
    try {
      if (status === TRANSFER_STATUS.APPROVED) {
        await api.action('materialTransfers', viewing.id, 'approve', { decision: 'Approved' })
        push(`${viewing.transferRef} approved. Source store can now dispatch materials.`, 'success')
      } else if (status === TRANSFER_STATUS.DISPATCHED) {
        await api.action('materialTransfers', viewing.id, 'execute', { decision: 'Dispatched' })
        push(`${viewing.transferRef} dispatched.`, 'success')
      } else if (status === TRANSFER_STATUS.RECEIVED) {
        await api.action('materialTransfers', viewing.id, 'execute', { decision: 'Received' })
        push(`${viewing.transferRef} completed and stock levels updated.`, 'success')
      } else if (status === TRANSFER_STATUS.RETURNED) {
        await api.action('materialTransfers', viewing.id, 'approve', { decision: 'Returned for Correction' })
        push(`${viewing.transferRef} returned for correction.`, 'info')
      } else {
        await api.action('materialTransfers', viewing.id, 'approve', { decision: 'Rejected' })
        push(`${viewing.transferRef} rejected.`, 'info')
      }

      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Re-open a corrected transfer for approval — closes the "Returned for Correction" loop.
  async function handleResubmit() {
    setSaving(true)
    try {
      await api.action('materialTransfers', viewing.id, 'resubmit', {})
      push(`${viewing.transferRef} resubmitted for approval.`, 'success')
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    await materialTransferService.remove(deleteTarget.id)
    push('Transfer request deleted.', 'success')
    setDeleteTarget(null)
    await load()
  }

  const columns = [
    { key: 'transferRef', header: 'Transfer Ref' },
    { key: 'fromStore', header: 'From' },
    { key: 'toStore', header: 'To' },
    { key: 'requestedBy', header: 'Requested By' },
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
          {[TRANSFER_STATUS.PENDING_APPROVAL, TRANSFER_STATUS.RETURNED].includes(row.status) && (
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
        title="Store Transfers"
        subtitle="Request, approve, and execute material transfers between stores."
        actions={
          canCreate ? <Button icon={Plus} onClick={openCreate}>New Transfer Request</Button> : null
        }
      />

      <div className="card p-5">
        <div className="mb-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search transfer ref, store..." />
        </div>
        <Table columns={columns} rows={filtered} loading={loading} emptyTitle="No transfers yet" emptyMessage="Create a transfer request to move stock between stores." />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Store Transfer"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Submit Request
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="Source Store" required options={stores.map((s) => s.name)} value={header.fromStore} onChange={(e) => setHeader((h) => ({ ...h, fromStore: e.target.value }))} />
            <Select label="Destination Store" required options={stores.map((s) => s.name)} value={header.toStore} onChange={(e) => setHeader((h) => ({ ...h, toStore: e.target.value }))} />
            <Input label="Date" type="date" required value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} />
            <Input label="Destination Bin" placeholder="e.g. E03-02-04" value={header.destinationBin} onChange={(e) => setHeader((h) => ({ ...h, destinationBin: e.target.value }))} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label !mb-0">Materials to Transfer</p>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-ink-100 p-3 sm:grid-cols-2">
                  <Select label="Item" options={items.map((i) => i.name)} value={line.item} onChange={(e) => updateLine(idx, { item: e.target.value })} />
                  <Input label="Quantity" type="number" value={line.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.transferRef}
        size="lg"
        footer={
          <>
            {viewing?.status === TRANSFER_STATUS.PENDING_APPROVAL && canApprove && (
              <>
                <Button variant="danger" icon={XCircle} loading={saving} onClick={() => handleDecide(TRANSFER_STATUS.REJECTED)}>
                  Reject Transfer
                </Button>
                <Button icon={CheckCircle2} loading={saving} onClick={() => handleDecide(TRANSFER_STATUS.APPROVED)}>
                  Approve Transfer
                </Button>
                <Button variant="secondary" icon={RotateCcw} loading={saving} onClick={() => handleDecide('Returned for Correction')}>
                  Return for Correction
                </Button>
              </>
            )}
            {viewing?.status === TRANSFER_STATUS.APPROVED && isStorekeeper && (
              <Button icon={Truck} loading={saving} onClick={() => handleDecide(TRANSFER_STATUS.DISPATCHED)}>
                Dispatch Materials (Model 22)
              </Button>
            )}
            {viewing?.status === TRANSFER_STATUS.DISPATCHED && isStorekeeper && (
              <Button icon={PackageCheck} loading={saving} onClick={() => handleDecide(TRANSFER_STATUS.RECEIVED)}>
                Receive Materials
              </Button>
            )}
            {viewing?.status === TRANSFER_STATUS.RETURNED && canCreate && (
              <Button icon={RotateCcw} loading={saving} onClick={handleResubmit}>
                Resubmit for Approval
              </Button>
            )}
          </>
        }
      >
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Source Store" value={viewing.fromStore} />
              <Field label="Destination Store" value={viewing.toStore} />
              <Field label="Requested By" value={viewing.requestedBy} />
              <Field label="Status" value={<StatusBadge status={viewing.status} />} />
            </div>
            <div>
              <p className="mb-2 font-medium text-ink-700">Materials Being Transferred</p>
              <table className="w-full text-left text-sm border border-ink-100 rounded">
                <thead className="bg-ink-50 text-ink-600">
                  <tr>
                    <th className="p-2 font-medium">Item</th>
                    <th className="p-2 font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  <tr>
                    <td className="p-2">{viewing.item}</td>
                    <td className="p-2">{viewing.qty}</td>
                  </tr>
                </tbody>
              </table>
              {viewing.status === TRANSFER_STATUS.PENDING_APPROVAL && canApprove && (
                <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-lg text-brand-800">
                  <p className="font-medium text-sm mb-1">PAO Review Required</p>
                  <p className="text-xs text-brand-600">Approve this transfer to allow the source store to dispatch materials.</p>
                </div>
              )}
              {viewing.status === TRANSFER_STATUS.APPROVED && isStorekeeper && (
                <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-lg text-brand-800">
                  <p className="font-medium text-sm mb-1">Source Store Action Required</p>
                  <p className="text-xs text-brand-600">Click Dispatch when materials physically leave your store. This acts as your issue voucher (Model 22).</p>
                </div>
              )}
              {viewing.status === TRANSFER_STATUS.DISPATCHED && isStorekeeper && (
                <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-lg text-brand-800">
                  <p className="font-medium text-sm mb-1">Destination Store Action Required</p>
                  <p className="text-xs text-brand-600">Click Receive when materials physically arrive. This records the receipt and updates stock levels for both stores.</p>
                </div>
              )}
              {viewing.status === TRANSFER_STATUS.RETURNED && (
                <div className="mt-4 p-3 bg-warning-50 border border-warning-100 rounded-lg text-warning-800">
                  <p className="font-medium text-sm mb-1">Returned for Correction</p>
                  <p className="text-xs text-warning-600">The approver returned this transfer. Resubmit it for approval, or delete it and raise a corrected request.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} message={`Delete transfer request "${deleteTarget?.transferRef}"?`} confirmLabel="Delete" onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
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
