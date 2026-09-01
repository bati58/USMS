import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, Lock } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import { itemService, categoryService, storeService, businessRulesService } from '../../services'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { canPerformAction } from '../../utils/rolePermissions'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import { UNITS } from '../../utils/constants'

const EMPTY_FORM = {
  code: '',
  name: '',
  category: '',
  store: '',
  section: '',
  rack: '',
  shelf: '',
  bin: '',
  unit: '',
  minLevel: '',
  maxLevel: '',
  reorderLevel: '',
  qtyOnHand: '',
  unitPrice: '',
  expiryDate: '',
  batchNo: '',
  condition: ''
}

export default function ItemList() {
  const { push } = useToast()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [shelfLifeWarningDays, setShelfLifeWarningDays] = useState(90)

  // Permission checks
  const canCreate = canPerformAction(user?.role, 'create', 'items')
  const canEdit = canPerformAction(user?.role, 'edit', 'items')
  const canDelete = canPerformAction(user?.role, 'delete', 'items')

  async function load() {
    setLoading(true)
    try {
      const [itemsData, categoriesData, storesData] = await Promise.all([
        itemService.list(),
        categoryService.list(),
        storeService.list()
      ])
      setItems(itemsData)
      setCategories(categoriesData)
      setStores(storesData)
      try {
        const rule = await businessRulesService.getRule('SHELF_LIFE_WARNING_DAYS')
        if (Number.isFinite(Number(rule.value)) && Number(rule.value) >= 0) setShelfLifeWarningDays(Number(rule.value))
      } catch {
        // Keep the default when rules are unavailable to non-admin sessions.
      }
    } catch (err) {
      push(err.message || 'Could not load items.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((i) => `${i.code} ${i.name} ${i.category} ${i.store}`.toLowerCase().includes(q))
  }, [items, query])

  function openCreate() {
    if (!canCreate) {
      push('You do not have permission to create items.', 'error')
      return
    }
    setForm(EMPTY_FORM)
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(row) {
    if (!canEdit) {
      push('You do not have permission to edit items.', 'error')
      return
    }
    setForm(row)
    setEditing(row)
    setModalOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        minLevel: Number(form.minLevel) || 0,
        maxLevel: Number(form.maxLevel) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        qtyOnHand: Number(form.qtyOnHand) || 0,
        unitPrice: Number(form.unitPrice) || 0
      }
      if (editing) {
        await itemService.update(editing.id, payload)
        push('Item updated.', 'success')
      } else {
        await itemService.create(payload)
        push('Item created.', 'success')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!canDelete) {
      push('You do not have permission to delete items.', 'error')
      return
    }
    await itemService.remove(deleteTarget.id)
    push('Item deleted.', 'success')
    setDeleteTarget(null)
    await load()
  }

  const columns = [
    { key: 'code', header: 'Item Code' },
    { key: 'name', header: 'Item Name' },
    { key: 'category', header: 'Category' },
    { key: 'store', header: 'Store' },
    { key: 'location', header: 'Location', render: (r) => [r.section, r.rack, r.shelf, r.bin].filter(Boolean).join('-') || r.bin },
    {
      key: 'qtyOnHand',
      header: 'Qty on Hand',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{formatNumber(r.qtyOnHand)} {r.unit}</span>
          {Number(r.qtyOnHand) <= Number(r.reorderLevel) && (
            <span title="At or below reorder level">
              <AlertTriangle size={14} className="text-warning-500" />
            </span>
          )}
          {r.expiryDate && new Date(r.expiryDate) < new Date(Date.now() + shelfLifeWarningDays * 24 * 60 * 60 * 1000) && (
            <span title={`Expiring on ${r.expiryDate}`}>
              <AlertTriangle size={14} className="text-danger-500" />
            </span>
          )}
        </div>
      )
    },
    { key: 'unitPrice', header: 'Unit Price', render: (r) => formatCurrency(r.unitPrice) },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        if (!canEdit && !canDelete) return null

        return (
          <div className="flex justify-end gap-1">
            {canEdit && (
              <button
                onClick={() => openEdit(row)}
                className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600 transition-colors"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDeleteTarget(row)}
                className="rounded-md p-1.5 text-ink-500 hover:bg-danger-50 hover:text-danger-700 transition-colors"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div>
      <PageHeader
        title="Items"
        subtitle="Maintain the item master, its bin location, and min/max/reorder levels."
        actions={canCreate ? <Button icon={Plus} onClick={openCreate}>Add Item</Button> : null}
      />

      {!canCreate && !canEdit && !canDelete && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Read-only access:</span> this role can view inventory records but cannot create, edit, or delete items.
          </p>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search item code, name, category..." />
          <Badge className="bg-ink-100 text-ink-600">{filtered.length} item(s)</Badge>
        </div>
        <Table
          columns={columns}
          rows={filtered}
          loading={loading}
          emptyTitle="No items yet"
          emptyMessage="Add an item to the catalog to start tracking stock."
        />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Item' : 'Add Item'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Item Code" required placeholder="e.g. 4402-001-001" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          <Input label="Item Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select
            label="Category"
            required
            options={categories.map((c) => c.name)}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <Select
            label="Store"
            required
            options={stores.map((s) => s.name)}
            value={form.store}
            onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
          />
          <Select label="Unit of Issue" required options={UNITS} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />

          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-ink-100 py-4 my-2">
            <Input label="Section" placeholder="e.g. A" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />
            <Input label="Rack" placeholder="e.g. 12" value={form.rack} onChange={(e) => setForm((f) => ({ ...f, rack: e.target.value }))} />
            <Input label="Shelf" placeholder="e.g. 3" value={form.shelf} onChange={(e) => setForm((f) => ({ ...f, shelf: e.target.value }))} />
            <Input label="Bin" placeholder="e.g. 05" required value={form.bin} onChange={(e) => setForm((f) => ({ ...f, bin: e.target.value }))} />
          </div>

          <Input label="Quantity on Hand" type="number" required value={form.qtyOnHand} onChange={(e) => setForm((f) => ({ ...f, qtyOnHand: e.target.value }))} />
          <Input label="Unit Price (Birr)" type="number" required value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} />
          <Input label="Minimum Level" type="number" value={form.minLevel} onChange={(e) => setForm((f) => ({ ...f, minLevel: e.target.value }))} />
          <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
          <Input label="Maximum Level" type="number" value={form.maxLevel} onChange={(e) => setForm((f) => ({ ...f, maxLevel: e.target.value }))} />
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-ink-100 pt-4 mt-2">
            <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
            <Input label="Batch Number" value={form.batchNo} onChange={(e) => setForm((f) => ({ ...f, batchNo: e.target.value }))} />
            <Select label="Condition" options={['New', 'Good', 'Fair', 'Poor', 'Damaged']} value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        message={`Delete item "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
