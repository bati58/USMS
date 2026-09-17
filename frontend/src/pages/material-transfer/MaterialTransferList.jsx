import { useEffect, useMemo, useState } from 'react'
import { Plus, Eye, CheckCircle2, XCircle, Truck, PackageCheck, Trash2, RotateCcw, Minus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import StatusBadge from '../../components/ui/StatusBadge'
import { materialTransferService, storeService, requisitionService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { TRANSFER_STATUS, ROLES } from '../../utils/constants'
import { canPerformAction } from '../../utils/rolePermissions'
import { uniqueItemsByName } from '../../utils/itemOptions'

const EMPTY_LINE = { item: '', qty: '' }

export default function MaterialTransferList() {
  const { push } = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [stores, setStores] = useState([])
  const [requisitions, setRequisitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [actionBusy, setActionBusy] = useState('')
  const successToast = { duration: 2000 }

  const [header, setHeader] = useState({ requisitionId: '', date: '' })
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])
  const [receiveBin, setReceiveBin] = useState('')

  const canApprove = canPerformAction(user?.role, 'approve', 'materialTransfers')
  const canCreate = canPerformAction(user?.role, 'create', 'materialTransfers')
  const userAssignedStore = user?.store || ''
  const assignedStoreNames = user?.assignedStores?.length ? user.assignedStores : (userAssignedStore ? [userAssignedStore] : [])
  const isStoreOperator = ['Storekeeper', 'Store Head'].includes(user?.role)
  const isScopedStoreUser = isStoreOperator && assignedStoreNames.length > 0
  const canCreateTransfer = canCreate && isStoreOperator
  // Only the Storekeeper physically dispatches and receives goods. The Store Head approves transfers.
  const isStorekeeper = user?.role === ROLES.STOREKEEPER
  const canDispatchViewing = isStorekeeper && (!isScopedStoreUser || assignedStoreNames.includes(viewing?.fromStore))
  const canReceiveViewing = isStorekeeper && (!isScopedStoreUser || assignedStoreNames.includes(viewing?.toStore))
  const approvedRequisitions = useMemo(
    () => requisitions.filter((request) => ['Approved', 'Partially Approved'].includes(request.status) && request.issuingStore && request.issuingStore !== request.store),
    [requisitions]
  )
  const selectedRequisition = approvedRequisitions.find((request) => String(request.id) === String(header.requisitionId))
  const availableItems = selectedRequisition?.items || []

  async function load() {
    setLoading(true)
    try {
      const [transfers, storeList, requisitionList] = await Promise.all([materialTransferService.list(), storeService.list(), requisitionService.list()])
      setRows(transfers)
      setStores(storeList.filter((store) => store.active !== false))
      setRequisitions(requisitionList)
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
    let list = rows
    if (isScopedStoreUser) {
      list = list.filter((r) => r.fromStore === userAssignedStore || r.toStore === userAssignedStore)
    }

    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter((r) => `${r.transferRef} ${r.fromStore} ${r.toStore}`.toLowerCase().includes(q))
  }, [rows, query, isScopedStoreUser, userAssignedStore])

  function openCreate() {
    setHeader({
      requisitionId: '',
      date: new Date().toISOString().slice(0, 10),
    })
    setLines([{ ...EMPTY_LINE }])
    setModalOpen(true)
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!isStoreOperator) {
      push('Only an operator assigned to the source store can create material transfers.', 'error')
      return
    }
    if (!selectedRequisition || !lines.length || lines.some((line) => !line.item || !line.qty || Number(line.qty) <= 0)) {
      push('Select an approved requisition and provide an item and positive quantity for every line.', 'error')
      return
    }
    if (new Set(lines.map((line) => line.item)).size !== lines.length) {
      push('Each requested item can only be included once in a transfer batch.', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await materialTransferService.create({
        requisitionId: selectedRequisition.id,
        date: header.date,
        lines: lines.map((line) => ({ item: line.item, qty: Number(line.qty) }))
      })
      const transferCount = Array.isArray(created) ? created.length : 1
      push(`${transferCount} transfer${transferCount === 1 ? '' : 's'} submitted for source Store Head approval. No stock changed.`, 'success', successToast)
      setModalOpen(false)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDecide(status) {
    if (!viewing || actionBusy) return
    setActionBusy(`${status}-${viewing.id}`)
    setSaving(true)
    try {
      if (status === TRANSFER_STATUS.APPROVED) {
        await api.action('materialTransfers', viewing.id, 'approve', { decision: 'Approved' })
        push(`${viewing.transferRef} approved. The source Storekeeper is the next actor and can dispatch materials.`, 'success', successToast)
      } else if (status === TRANSFER_STATUS.DISPATCHED) {
        await api.action('materialTransfers', viewing.id, 'execute', { decision: 'Dispatched' })
        push(`${viewing.transferRef} dispatched. The destination Storekeeper is the next actor and must receive it.`, 'success', successToast)
      } else if (status === TRANSFER_STATUS.RECEIVED) {
        const destinationBin = receiveBin.trim()
        if (!destinationBin) {
          push('Select a destination bin before receiving the materials.', 'error')
          return
        }
        await api.action('materialTransfers', viewing.id, 'execute', { decision: 'Received', destinationBin })
        push(`${viewing.transferRef} received. Destination stock, Stock Cards, Bin Cards, and FIFO lots were updated.`, 'success', successToast)
      } else if (status === TRANSFER_STATUS.RETURNED) {
        await api.action('materialTransfers', viewing.id, 'approve', { decision: 'Returned for Correction' })
        push(`${viewing.transferRef} returned for correction. The requester must update and resubmit it.`, 'info', successToast)
      } else {
        await api.action('materialTransfers', viewing.id, 'approve', { decision: 'Rejected' })
        push(`${viewing.transferRef} rejected. The requester was notified.`, 'info', successToast)
      }

      setViewing(null)
      setReceiveBin('')
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
      setActionBusy('')
    }
  }

  // Re-open a corrected transfer for approval — closes the "Returned for Correction" loop.
  async function handleResubmit() {
    if (!viewing || actionBusy) return
    setActionBusy(`resubmit-${viewing.id}`)
    setSaving(true)
    try {
      await api.action('materialTransfers', viewing.id, 'resubmit', {})
      push(`${viewing.transferRef} resubmitted. Source Store Head approval is the next step.`, 'success', successToast)
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
      setActionBusy('')
    }
  }

  async function handleDelete() {
    try {
      await materialTransferService.remove(deleteTarget.id)
      push(`Draft ${deleteTarget.transferRef} deleted. No stock changed.`, 'success', successToast)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      push(err.message || 'Could not delete transfer.', 'error')
    }
  }

  const hasAnyAction = filtered.some((row) => {
    const canView = true
    const canDelete = [TRANSFER_STATUS.PENDING_APPROVAL, TRANSFER_STATUS.RETURNED].includes(row.status) && canCreate
    return canView || canDelete
  })

  const columns = [
    { key: 'transferRef', header: 'Transfer Ref' },
    { key: 'fromStore', header: 'From' },
    { key: 'toStore', header: 'To' },
    { key: 'requestedBy', header: 'Requested By' },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ...(hasAnyAction ? [{
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1 items-center">
          <button onClick={() => { setViewing(row); setReceiveBin('') }} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600">
            <Eye size={15} />
          </button>
          {[TRANSFER_STATUS.PENDING_APPROVAL, TRANSFER_STATUS.RETURNED].includes(row.status) && canCreate && (
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
        title="Store Transfers"
        subtitle="Request, approve, and execute material transfers between stores."
        actions={
          canCreateTransfer ? <Button icon={Plus} onClick={openCreate}>New Transfer Request</Button> : null
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
            <Select label="Approved Requisition" required options={approvedRequisitions.map((request) => ({ value: request.id, label: `${request.srRef} - ${request.store}` }))} value={header.requisitionId} onChange={(e) => setHeader((h) => ({ ...h, requisitionId: e.target.value }))} />
            <Input label="Source Store" value={selectedRequisition?.issuingStore || ''} readOnly disabled />
            <Input label="Destination Store" value={selectedRequisition?.store || ''} readOnly disabled />
            <Input label="Date" type="date" required value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label !mb-0">Materials to Transfer</p>
            </div>
            {!approvedRequisitions.length && (
              <p className="mb-3 rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-700">
                No approved cross-store requisitions are available. A requisition must be approved by its source Store Head before materials can be selected for transfer.
              </p>
            )}
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-ink-100 p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,1fr)_auto] sm:items-end">
                  <Select
                    label={`Item ${idx + 1}`}
                    disabled={!selectedRequisition || !availableItems.length}
                    options={uniqueItemsByName(availableItems).filter((item) => !lines.some((other, otherIdx) => otherIdx !== idx && other.item === item.item)).map((item) => ({ value: item.item, label: `${item.item} (requested: ${item.qtyApproved ?? item.qty})` }))}
                    value={line.item}
                    onChange={(e) => {
                      const selectedLine = availableItems.find((item) => item.item === e.target.value)
                      updateLine(idx, { item: e.target.value, qty: selectedLine?.qtyApproved ?? selectedLine?.qty ?? '' })
                    }}
                  />
                  <Input label="Quantity" type="number" min="0" value={line.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
                  <Button variant="secondary" icon={Minus} onClick={() => setLines((prev) => prev.length > 1 ? prev.filter((_, lineIdx) => lineIdx !== idx) : prev)} disabled={lines.length === 1} title="Remove line" />
                </div>
              ))}
              <Button variant="secondary" icon={Plus} onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])} disabled={!selectedRequisition || lines.length >= availableItems.length}>
                Add Line
              </Button>
            </div>
            {selectedRequisition && !availableItems.length && (
              <p className="mt-2 text-sm text-danger-600">The selected requisition has no transferable item lines.</p>
            )}
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
            {viewing?.status === TRANSFER_STATUS.APPROVED && canDispatchViewing && (
              <Button icon={Truck} loading={saving} onClick={() => handleDecide(TRANSFER_STATUS.DISPATCHED)}>
                Dispatch Materials (Model 22)
              </Button>
            )}
            {viewing?.status === TRANSFER_STATUS.DISPATCHED && canReceiveViewing && (
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
              {viewing.status === TRANSFER_STATUS.APPROVED && canDispatchViewing && (
                <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-lg text-brand-800">
                  <p className="font-medium text-sm mb-1">Source Store Action Required</p>
                  <p className="text-xs text-brand-600">Click Dispatch when materials physically leave your store. This acts as your issue voucher (Model 22).</p>
                </div>
              )}
              {viewing.status === TRANSFER_STATUS.DISPATCHED && canReceiveViewing && (
                <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-lg text-brand-800">
                  <p className="font-medium text-sm mb-1">Destination Store Action Required</p>
                  <p className="text-xs text-brand-600 mb-3">Select the destination bin, then receive the materials. This records the receipt and updates destination stock.</p>
                  <Input label="Destination Bin" placeholder="e.g. SW-04" value={receiveBin} onChange={(e) => setReceiveBin(e.target.value)} />
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
