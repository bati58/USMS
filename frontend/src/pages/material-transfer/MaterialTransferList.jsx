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
import { materialTransferService, storeService, itemService, requisitionService } from '../../services'
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
  const [requisitions, setRequisitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const [header, setHeader] = useState({ requisitionId: '', item: '', qty: '', date: '', destinationBin: '' })
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])

  const canApprove = canPerformAction(user?.role, 'approve', 'materialTransfers')
  const canCreate = canPerformAction(user?.role, 'create', 'materialTransfers')
  const userAssignedStore = user?.store || ''
  const assignedStoreNames = user?.assignedStores?.length ? user.assignedStores : (userAssignedStore ? [userAssignedStore] : [])
  const isDepartmentHead = user?.role === ROLES.DEPT_HEAD
  const isStoreOperator = ['Storekeeper', 'Store Head'].includes(user?.role)
  const isScopedStoreUser = isStoreOperator && assignedStoreNames.length > 0
  const isMainStoreOperator = isStoreOperator && assignedStoreNames.some((name) => stores.find((store) => store.name === name)?.type === 'Main Store')
  const canCreateTransfer = canCreate && isMainStoreOperator
  // Store operators who physically move goods (backend: material-transfers-execute).
  const isStorekeeper = [ROLES.STOREKEEPER, ROLES.STORE_HEAD].includes(user?.role)
  const canDispatchViewing = isStorekeeper && (!isScopedStoreUser || assignedStoreNames.includes(viewing?.fromStore))
  const canReceiveViewing = isStorekeeper && (!isScopedStoreUser || assignedStoreNames.includes(viewing?.toStore))
  const approvedRequisitions = useMemo(
    () => requisitions.filter((request) => ['Approved', 'Partially Approved'].includes(request.status)),
    [requisitions]
  )
  const selectedRequisition = approvedRequisitions.find((request) => String(request.id) === String(header.requisitionId))
  const availableItems = selectedRequisition?.items || []

  async function load() {
    setLoading(true)
    try {
      const [transfers, storeList, itemList, requisitionList] = await Promise.all([materialTransferService.list(), storeService.list(), itemService.list(), requisitionService.list()])
      setRows(transfers)
      setStores(storeList.filter((store) => store.active !== false))
      setItems(itemList)
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
      item: '',
      qty: '',
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
    if (!isMainStoreOperator) {
      push('Only the Main Store can create material transfers.', 'error')
      return
    }
    if (!selectedRequisition || !header.item || !header.qty || Number(header.qty) <= 0) {
      push('An approved requisition, item, and positive quantity are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const count = rows.length + 1
      const transferRef = `TRF-2026-${String(count).padStart(4, '0')}`
      await materialTransferService.create({
        transferRef,
        requisitionId: selectedRequisition.id,
        item: header.item,
        qty: Number(header.qty),
        date: header.date,
        destinationBin: header.destinationBin,
        requestedBy: user?.name || 'Storekeeper',
        status: TRANSFER_STATUS.PENDING_APPROVAL,
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
          <button onClick={() => setViewing(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600">
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
            <Select label="Approved Requisition" required options={approvedRequisitions.map((request) => ({ value: request.id, label: `${request.srRef} - ${request.store}` }))} value={header.requisitionId} onChange={(e) => setHeader((h) => ({ ...h, requisitionId: e.target.value, item: '', qty: '' }))} />
            <Input label="Source Store" value="Main Store" readOnly disabled />
            <Input label="Destination Store" value={selectedRequisition?.store || ''} readOnly disabled />
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
                  <Select
                    label="Item"
                    options={availableItems.map((item) => ({ value: item.item, label: `${item.item} (requested: ${item.qtyApproved ?? item.qty})` }))}
                    value={header.item}
                    onChange={(e) => {
                      const selectedLine = availableItems.find((line) => line.item === e.target.value)
                      setHeader((h) => ({ ...h, item: e.target.value, qty: selectedLine?.qtyApproved ?? selectedLine?.qty ?? '' }))
                    }}
                  />
                  <Input label="Quantity" type="number" value={header.qty} onChange={(e) => setHeader((h) => ({ ...h, qty: e.target.value }))} />
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
