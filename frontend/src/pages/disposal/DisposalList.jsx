import { useEffect, useMemo, useState } from 'react'
import { Plus, Eye, Trash2, Play } from 'lucide-react'
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
import { uniqueItemsByName } from '../../utils/itemOptions'

export default function DisposalList() {
  const { push } = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [stores, setStores] = useState([])
  const [items, setItems] = useState([])
  const [disposalOptions, setDisposalOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({ item: '', store: '', qty: '', reason: '', dateFlagged: '', supportingDocument: '' })

  const canCreate = canPerformAction(user?.role, 'create', 'disposals')
  const canDelete = canPerformAction(user?.role, 'delete', 'disposals')
  const canApprove = canPerformAction(user?.role, 'approve', 'disposals')
  const canExecute = user?.role === ROLES.STOREKEEPER
  const canCommittee = user?.role === ROLES.DISPOSAL_COMMITTEE

  // Operational disposal approvals belong to the store leadership; admin is read-only.
  const isStoreHead = user?.role === ROLES.STORE_HEAD
  const assignedStoreNames = Array.isArray(user?.assignedStores) ? user.assignedStores.filter(Boolean) : []
  const assignedStoreName = user?.store || (assignedStoreNames.length === 1 ? assignedStoreNames[0] : '')
  const isScopedStoreHead = isStoreHead && Boolean(assignedStoreName)
  const disposalStores = isScopedStoreHead ? stores.filter((store) => store.name === assignedStoreName) : stores
  const selectedStore = stores.find((store) => store.name === formData.store)
  const availableItems = useMemo(() => {
    if (!formData.store) return []
    if (isScopedStoreHead) return uniqueItemsByName(items)
    const selectedStoreName = String(formData.store).trim().toLowerCase()
    return uniqueItemsByName(items.filter((item) => {
      const belongsToSelectedStore = (selectedStore?.id && Number(item.storeId) === Number(selectedStore.id)) ||
        String(item.store || '').trim().toLowerCase() === selectedStoreName
      const condition = String(item.condition || '').trim().toLowerCase()
      const expired = item.expiryTracked && item.expiryDate && item.expiryDate < new Date().toISOString().slice(0, 10)
      const eligible = ['damaged', 'unusable', 'obsolete', 'expired', 'scrap', 'condemned'].includes(condition) || expired
      return belongsToSelectedStore && Number(item.qtyOnHand) > 0 && eligible
    }))
  }, [items, formData.store, isScopedStoreHead, selectedStore?.id])
  const selectedDisposalItem = disposalOptions.find((item) => String(item.id) === String(formData.item))

  async function load() {
    setLoading(true)
    try {
      const canLoadSupportingMasterData = canCreate || isStoreHead
      const results = await Promise.allSettled([
        disposalService.list(),
        canLoadSupportingMasterData ? storeService.list() : Promise.resolve([]),
        canLoadSupportingMasterData ? itemService.listInventory() : Promise.resolve([])
      ])
      const [disposalResult, storeResult, itemResult] = results
      if (disposalResult.status === 'fulfilled') setRows(disposalResult.value)
      else push(disposalResult.reason?.message || 'Could not load disposal records.', 'error')

      if (storeResult.status === 'fulfilled') {
        const activeStores = storeResult.value.filter((store) => store.active !== false)
        setStores(activeStores.length ? activeStores : assignedStoreNames.map((name) => ({ name, active: true })))
      } else {
        setStores(assignedStoreNames.map((name) => ({ name, active: true })))
        push(storeResult.reason?.message || 'Could not load store options.', 'error')
      }

      if (itemResult.status === 'fulfilled') setItems(itemResult.value)
      else push(itemResult.reason?.message || 'Could not load item options.', 'error')
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

  async function openCreate() {
    if (!canCreate) {
      push('You do not have permission to flag items for disposal.', 'error')
      return
    }
    try {
      const latestItems = assignedStoreName
        ? await disposalService.eligibleItems(assignedStoreName)
        : await itemService.listInventory()
      setDisposalOptions(Array.isArray(latestItems) ? latestItems : [])
    } catch (err) {
      push(err.message || 'Could not refresh item conditions.', 'error')
      return
    }
    setFormData({ item: '', store: assignedStoreName || '', qty: '', reason: '', dateFlagged: new Date().toISOString().slice(0, 10), supportingDocument: '' })
    setModalOpen(true)
  }

  function handleOpenView(row) {
    setViewing(row)
  }

  async function handleCreate(e) {
    e.preventDefault()
    const selectedItem = disposalOptions.find((item) => String(item.id) === String(formData.item))
    const requestedQty = Number(formData.qty)
    if (!selectedItem || !Number.isFinite(requestedQty) || requestedQty <= 0) {
      push('Select a valid item and enter a positive quantity.', 'error')
      return
    }
    if (requestedQty > Number(selectedItem.qtyOnHand)) {
      push(`Insufficient stock. ${selectedItem.name} has only ${selectedItem.qtyOnHand} available in ${formData.store}.`, 'error')
      return
    }
    setSaving(true)
    try {
      await disposalService.create({
        itemId: selectedItem.id,
        item: selectedItem.name,
        store: formData.store,
        qty: formData.qty,
        reason: formData.reason,
        dateFlagged: formData.dateFlagged,
        supportingDocument: formData.supportingDocument
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

  async function executeDisposal() {
    if (!canExecute) {
      push('You do not have permission to execute disposal requests.', 'error')
      return
    }
    const disposalMethod = window.prompt('Disposal method (for example: condemned and destroyed)')
    if (!disposalMethod?.trim()) return
    const witness = window.prompt('Name of disposal witness')
    if (!witness?.trim()) return
    try {
      await api.action('disposals', viewing.id, 'execute', { disposalDate: new Date().toISOString().slice(0, 10), disposalMethod: disposalMethod.trim(), witness: witness.trim() })
      push(`Disposal request ${viewing.disposalRef} executed and stock removed.`, 'success')
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function runDisposalAction(action, data = {}, successMessage = 'Disposal updated.') {
    try {
      await api.action('disposals', viewing.id, action, data)
      push(successMessage, 'success')
      setViewing(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  function assessDisposal() {
    const result = window.prompt('Assessment result: Repairable, Unusable, or Return to Stock')
    if (!result?.trim()) return
    const notes = window.prompt('Assessment notes') || ''
    runDisposalAction('assess', { result: result.trim(), notes })
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
      <PageHeader
        title="Disposal Management"
        subtitle="Flag obsolete or damaged stock and manage the disposal workflow."
        actions={
          <div className="flex items-center gap-4">
            <SearchInput value={query} onChange={setQuery} placeholder="Search disposals..." />
            {canCreate && (
              <Button onClick={openCreate} className="gap-2 shadow-md">
                <Plus size={18} />
                Flag for Disposal
              </Button>
            )}
          </div>
        }
      />

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
                {canDelete && ['Flagged', 'Quarantined', 'Under Technical Assessment', 'Repairable', 'Unusable', 'Send for Repair', 'Disposal Requested', 'Pending Store Head Review', 'Store Head Review', 'Recommended for Disposal', 'Requested', 'Pending Review', 'Returned for Correction'].includes(r.status) && (
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
            {isScopedStoreHead ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">Store <span className="text-danger-600">*</span></label>
                <div className="input bg-ink-50 text-ink-700">{assignedStoreName}</div>
              </div>
            ) : (
              <Select label="Store" value={formData.store} onChange={(e) => setFormData({ ...formData, store: e.target.value, item: '' })} required>
                <option value="">-- Select Store --</option>
                {disposalStores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </Select>
            )}
            <Select label="Item" value={formData.item} onChange={(e) => setFormData({ ...formData, item: e.target.value })} required>
              <option value="">{!formData.store ? 'Select a store first' : disposalOptions.length ? '-- Select Item --' : 'No eligible stock in this store'}</option>
              {disposalOptions.map(i => {
                const condition = String(i.condition || '').trim().toLowerCase()
                const reason = i.expiryTracked && i.expiryDate && i.expiryDate < new Date().toISOString().slice(0, 10)
                  ? 'Expired'
                  : i.condition || 'Review required'
                return <option key={i.id} value={i.id}>{i.name} ({i.code}) - {reason} - available: {i.qtyOnHand}</option>
              })}
            </Select>
            <div>
              <Input
                label="Quantity"
                type="number"
                min="0.01"
                max={selectedDisposalItem?.qtyOnHand || undefined}
                step="0.01"
                value={formData.qty}
                onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                required
              />
              {selectedDisposalItem && <p className="mt-1 text-xs text-ink-500">Available for disposal: {selectedDisposalItem.qtyOnHand}. You may dispose of only part of this quantity.</p>}
            </div>
            <Input label="Date Flagged" type="date" value={formData.dateFlagged} onChange={(e) => setFormData({ ...formData, dateFlagged: e.target.value })} required />
          </div>
          <Input label="Reason for Disposal" type="textarea" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} required />
          <Input label="Supporting Document Reference" placeholder="Inspection report or committee decision" value={formData.supportingDocument} onChange={(e) => setFormData({ ...formData, supportingDocument: e.target.value })} />

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
              <div>
                <p className="text-slate-500">Requested By</p>
                <p className="font-medium">{viewing.createdBy || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Approved By</p>
                <p className="font-medium">{viewing.approvedBy || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Executed By</p>
                <p className="font-medium">{viewing.executedBy || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Witness</p>
                <p className="font-medium">{viewing.witness || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-500">Supporting Document</p>
                <p className="font-medium">{viewing.supportingDocument || '-'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>

              {canExecute && ['Approved', 'Ready for Disposal', 'Executed'].includes(viewing.status) && (
                <Button variant="primary" onClick={executeDisposal} className="gap-2 bg-blue-600 hover:bg-blue-700 border-transparent text-white">
                  <Play size={18} /> Execute Disposal (Remove Stock)
                </Button>
              )}

              {['Flagged'].includes(viewing.status) && (canExecute || isStoreHead) && <Button onClick={() => runDisposalAction('quarantine')}>Quarantine</Button>}
              {viewing.status === 'Quarantined' && user?.role === ROLES.TEC && <Button onClick={() => runDisposalAction('start-assessment')}>Start Assessment</Button>}
              {viewing.status === 'Under Technical Assessment' && user?.role === ROLES.TEC && <Button onClick={assessDisposal}>Record Assessment</Button>}
              {viewing.status === 'Repairable' && canExecute && <Button onClick={() => runDisposalAction('repair')}>Send for Repair</Button>}
              {viewing.status === 'Send for Repair' && user?.role === ROLES.TEC && <Button onClick={() => runDisposalAction('reassess')}>Reassess Repair</Button>}
              {viewing.status === 'Unusable' && isStoreHead && <Button onClick={() => runDisposalAction('request')}>Create Disposal Request</Button>}
              {viewing.status === 'Disposal Requested' && isStoreHead && <Button onClick={() => runDisposalAction('review')}>Start Store Head Review</Button>}
              {viewing.status === 'Store Head Review' && isStoreHead && <Button onClick={() => runDisposalAction('recommend')}>Recommend Disposal</Button>}
              {viewing.status === 'Recommended for Disposal' && isStoreHead && <Button onClick={() => runDisposalAction('submit-authorization')}>Submit Authorization</Button>}
              {['Pending Authorization', 'Pending Review', 'Requested'].includes(viewing.status) && (canApprove || canCommittee) && (
                <>
                  <Button variant="danger" onClick={() => runDisposalAction(viewing.status === 'Pending Authorization' || canCommittee ? 'authorize' : 'approve', { decision: 'Rejected' }, 'Disposal rejected.')}>Reject</Button>
                  <Button variant="secondary" onClick={() => runDisposalAction(viewing.status === 'Pending Authorization' || canCommittee ? 'authorize' : 'approve', { decision: 'Returned for Correction' }, 'Disposal returned for correction.')}>Return</Button>
                  <Button onClick={() => runDisposalAction(viewing.status === 'Pending Authorization' || canCommittee ? 'authorize' : 'approve', { decision: 'Approved' }, 'Disposal authorized.')}>Authorize</Button>
                </>
              )}
              {viewing.status === 'Disposed' && canExecute && <Button onClick={() => runDisposalAction('submit-confirmation')}>Submit Confirmation</Button>}
              {viewing.status === 'Pending Confirmation' && (canApprove || canCommittee) && <Button onClick={() => runDisposalAction('confirm')}>Confirm Disposal</Button>}
              {viewing.status === 'Confirmed' && (canApprove || canCommittee) && <Button onClick={() => runDisposalAction('post')}>Post Disposal</Button>}
              {viewing.status === 'Posted' && (canApprove || canCommittee) && <Button onClick={() => runDisposalAction('complete')}>Complete</Button>}
              {viewing.status === 'Completed' && (canApprove || canCommittee) && <Button onClick={() => runDisposalAction('close')}>Close</Button>}
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
