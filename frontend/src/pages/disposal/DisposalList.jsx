import { useEffect, useMemo, useState } from 'react'
import { Plus, Eye, CheckCircle2, XCircle, Trash2, Play, RotateCcw } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import StatusBadge from '../../components/ui/StatusBadge'
import { disposalService, storeService, itemService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { DISPOSAL_STATUS, ROLES } from '../../utils/constants'
import { canPerformAction } from '../../utils/rolePermissions'

export default function DisposalList() {
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

  const [formData, setFormData] = useState({ item: '', store: '', qty: '', reason: '', dateFlagged: '' })

  const canCreate = canPerformAction(user?.role, 'create', 'disposals')
  const canDelete = canPerformAction(user?.role, 'delete', 'disposals')
  const canApprove = canPerformAction(user?.role, 'approve', 'disposals')

  // Operational disposal approvals belong to the store leadership; admin is read-only.
  const isStoreHead = user?.role === ROLES.STORE_HEAD

  async function load() {
    setLoading(true)
    try {
      const [dsps, storeList, itemList] = await Promise.all([disposalService.list(), storeService.list(), itemService.list()])
      setRows(dsps)
      setStores(storeList.filter((store) => store.active !== false))
      setItems(itemList)
    } catch (err) {
      push(err.message || 'Could not load disposals.', 'error')
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
    return rows.filter((r) => `${r.disposalRef} ${r.item} ${r.store} ${r.reason}`.toLowerCase().includes(q))
  }, [rows, query])

  function openCreate() {
    if (!canCreate) {
      push('You do not have permission to flag items for disposal.', 'error')
      return
    }
    setFormData({ item: '', store: '', qty: '', reason: '', dateFlagged: new Date().toISOString().slice(0, 10) })
    setModalOpen(true)
  }

  function handleOpenView(row) {
    setViewing(row)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await disposalService.create({
        item: formData.item,
        store: formData.store,
        qty: formData.qty,
        reason: formData.reason,
        dateFlagged: formData.dateFlagged
      })
      push(`Disposal request created successfully.`, 'success')
      setModalOpen(false)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function decide(decision) {
    if (!canApprove) {
      push('You do not have permission to approve/reject disposal requests.', 'error')
      return
    }
    try {
      await api.action('disposals', viewing.id, 'approve', { decision })
      push(`Disposal request ${viewing.disposalRef} ${decision.toLowerCase()}.`, decision === 'Returned for Correction' ? 'info' : 'success')
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function executeDisposal() {
    if (!canApprove) {
      push('You do not have permission to execute disposal requests.', 'error')
      return
    }
    try {
      await api.action('disposals', viewing.id, 'execute', {})
      push(`Disposal request ${viewing.disposalRef} executed and stock removed.`, 'success')
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handleDelete() {
    try {
      await disposalService.remove(deleteTarget.id)
      push('Disposal request deleted.', 'success')
      setDeleteTarget(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Disposal Management" subtitle="Flag obsolete or damaged stock and manage the disposal workflow.">
        <div className="flex items-center gap-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search disposals..." />
          {canCreate && (
            <Button onClick={openCreate} className="gap-2 shadow-md">
              <Plus size={18} />
              Flag for Disposal
            </Button>
          )}
        </div>
      </PageHeader>

      <Table
        loading={loading}
        rows={filtered}
        columns={[
          { header: 'Ref', key: 'disposalRef', render: (r) => <span className="font-medium text-slate-700">{r.disposalRef}</span> },
          { header: 'Item', key: 'item' },
          { header: 'Store', key: 'store' },
          { header: 'Qty', key: 'qty' },
          { header: 'Date Flagged', key: 'dateFlagged', render: (r) => formatDate(r.dateFlagged) },
          { header: 'Status', key: 'status', render: (r) => <StatusBadge status={r.status} /> },
          {
            header: 'Actions',
            key: 'actions',
            render: (r) => (
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleOpenView(r)}>
                  <Eye size={18} />
                </Button>
                {canDelete && ['Pending', 'Flagged', 'Requested', 'Pending Review'].includes(r.status) && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={18} />
                  </Button>
                )}
              </div>
            )
          }
        ]}
      />

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title="Flag Item for Disposal" size="lg">
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Store" value={formData.store} onChange={(e) => setFormData({ ...formData, store: e.target.value })} required>
              <option value="">-- Select Store --</option>
              {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
            <Select label="Item" value={formData.item} onChange={(e) => setFormData({ ...formData, item: e.target.value })} required>
              <option value="">-- Select Item --</option>
              {items.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </Select>
            <Input label="Quantity" type="number" min="0.01" step="0.01" value={formData.qty} onChange={(e) => setFormData({ ...formData, qty: e.target.value })} required />
            <Input label="Date Flagged" type="date" value={formData.dateFlagged} onChange={(e) => setFormData({ ...formData, dateFlagged: e.target.value })} required />
          </div>
          <Input label="Reason for Disposal" type="textarea" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} required />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Request</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Disposal Request: ${viewing?.disposalRef}`} size="lg">
        {viewing && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div>
                <p className="text-slate-500">Item</p>
                <p className="font-medium">{viewing.item}</p>
              </div>
              <div>
                <p className="text-slate-500">Store</p>
                <p className="font-medium">{viewing.store}</p>
              </div>
              <div>
                <p className="text-slate-500">Quantity</p>
                <p className="font-medium">{viewing.qty}</p>
              </div>
              <div>
                <p className="text-slate-500">Date Flagged</p>
                <p className="font-medium">{formatDate(viewing.dateFlagged)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">Reason</p>
                <p className="p-3 bg-slate-50 rounded-lg text-slate-700 whitespace-pre-wrap">{viewing.reason}</p>
              </div>
              <div>
                <p className="text-slate-500">Current Status</p>
                <div className="mt-1"><StatusBadge status={viewing.status} /></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>

              {canApprove && (['Pending', 'Flagged', 'Requested', 'Pending Review'].includes(viewing.status)) && (
                <>
                  <Button variant="danger" onClick={() => decide('Rejected')} className="gap-2">
                    <XCircle size={18} /> Reject
                  </Button>
                  <Button variant="secondary" onClick={() => decide('Returned for Correction')} className="gap-2">
                    <RotateCcw size={18} /> Return for Correction
                  </Button>
                  <Button variant="primary" onClick={() => decide('Approved')} className="gap-2 bg-emerald-600 hover:bg-emerald-700 border-transparent text-white">
                    <CheckCircle2 size={18} /> Approve
                  </Button>
                </>
              )}

              {canApprove && viewing.status === 'Approved' && (
                <Button variant="primary" onClick={executeDisposal} className="gap-2 bg-blue-600 hover:bg-blue-700 border-transparent text-white">
                  <Play size={18} /> Execute Disposal (Remove Stock)
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Disposal Request"
        message={`Are you sure you want to delete disposal request ${deleteTarget?.disposalRef}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
