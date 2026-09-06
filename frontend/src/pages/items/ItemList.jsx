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
import { itemService, categoryService, storeService, locationService, businessRulesService } from '../../services'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { canPerformAction } from '../../utils/rolePermissions'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import { UNITS } from '../../utils/constants'

function LocationSelectors({ locations, store, storeId, locationId, onChange, required }) {
  const [selectedPath, setSelectedPath] = useState({ sectionId: '', rackId: '', shelfId: '', binId: '' })
  const storeLocations = locations.filter((location) => (
    storeId ? Number(location.storeId) === Number(storeId) : location.store === store
  ))
  const sections = storeLocations.filter((location) => location.type === 'SECTION')
  const selectedSection = storeLocations.find((location) => String(location.id) === String(selectedPath.sectionId))
  const selectedRack = storeLocations.find((location) => String(location.id) === String(selectedPath.rackId))
  const selectedShelf = storeLocations.find((location) => String(location.id) === String(selectedPath.shelfId))
  const selectedBin = storeLocations.find((location) => String(location.id) === String(selectedPath.binId))
  const racks = storeLocations.filter((location) => location.type === 'RACK' && (!selectedSection || String(location.parentId) === String(selectedSection.id)))
  const shelves = storeLocations.filter((location) => location.type === 'SHELF' && (!selectedRack || String(location.parentId) === String(selectedRack.id)))
  const bins = storeLocations.filter((location) => location.type === 'BIN' && (!selectedShelf || String(location.parentId) === String(selectedShelf.id)))

  useEffect(() => {
    if (!storeLocations.length) {
      setSelectedPath({ sectionId: '', rackId: '', shelfId: '', binId: '' })
      return
    }

    const bin = storeLocations.find((location) => String(location.id) === String(locationId) && location.type === 'BIN')
    const shelf = bin?.parentId ? storeLocations.find((location) => String(location.id) === String(bin.parentId)) : null
    const rack = shelf?.parentId ? storeLocations.find((location) => String(location.id) === String(shelf.parentId)) : null
    const section = rack?.parentId ? storeLocations.find((location) => String(location.id) === String(rack.parentId)) : null
    setSelectedPath((current) => bin
      ? { sectionId: section?.id || '', rackId: rack?.id || '', shelfId: shelf?.id || '', binId: bin.id }
      : current.binId && !storeLocations.some((location) => String(location.id) === String(current.binId))
        ? { sectionId: '', rackId: '', shelfId: '', binId: '' }
        : current)
  }, [store, storeId, locationId, locations])

  function selectLevel(type, value) {
    const selected = storeLocations.find((location) => String(location.id) === String(value))
    if (!selected) {
      setSelectedPath({ sectionId: '', rackId: '', shelfId: '', binId: '' })
      onChange('')
      return
    }

    const nextPath = type === 'SECTION'
      ? { sectionId: selected.id, rackId: '', shelfId: '', binId: '' }
      : type === 'RACK'
        ? { ...selectedPath, rackId: selected.id, shelfId: '', binId: '' }
        : type === 'SHELF'
          ? { ...selectedPath, shelfId: selected.id, binId: '' }
          : { ...selectedPath, binId: selected.id }
    setSelectedPath(nextPath)
    onChange(nextPath.binId)
  }

  return (
    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-4 border-y border-ink-100 py-4 my-2">
      <LocationSelect label="Section" value={selectedSection?.id || ''} options={sections} onChange={(value) => selectLevel('SECTION', value)} />
      <LocationSelect label="Rack" value={selectedRack?.id || ''} options={racks} onChange={(value) => selectLevel('RACK', value)} disabled={!selectedSection} />
      <LocationSelect label="Shelf" value={selectedShelf?.id || ''} options={shelves} onChange={(value) => selectLevel('SHELF', value)} disabled={!selectedRack} />
      <LocationSelect label="Bin" value={selectedBin?.id || ''} options={bins} onChange={(value) => selectLevel('BIN', value)} disabled={!selectedShelf} required={required} />
      {store && !sections.length && <p className="sm:col-span-4 text-xs text-warning-700">No sections exist for this store. Create the location hierarchy in Locations first: Section, Rack, Shelf, then Bin.</p>}
      {selectedSection && !racks.length && <p className="sm:col-span-4 text-xs text-warning-700">No racks exist in this section. Add a Rack under the selected Section in Locations.</p>}
      {selectedRack && !shelves.length && <p className="sm:col-span-4 text-xs text-warning-700">No shelves exist in this rack. Add a Shelf under the selected Rack in Locations.</p>}
      {selectedShelf && !bins.length && <p className="sm:col-span-4 text-xs text-warning-700">No bins exist on this shelf. Add a Bin under the selected Shelf in Locations.</p>}
    </div>
  )
}

function LocationSelect({ label, value, options, onChange, disabled, required }) {
  return (
    <label className="block text-sm font-medium text-ink-700">
      {label}{required && <span className="ml-1 text-danger-600">*</span>}
      <select className="input mt-1 w-full" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={required}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name} ({option.code})</option>)}
      </select>
    </label>
  )
}

const EMPTY_FORM = {
  code: '',
  name: '',
  category: '',
  store: '',
  locationId: '',
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
  const [locations, setLocations] = useState([])
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
  const assignedStoreNames = [user?.store, ...(user?.assignedStores || [])].filter(Boolean)
  const isSingleStoreHead = user?.role === 'Store Head' && assignedStoreNames.length === 1
  const selectedStoreId = stores.find((store) => store.name === form.store)?.id
  const selectedCategories = categories.filter((category) => (
    selectedStoreId ? Number(category.storeId) === Number(selectedStoreId) : category.store === form.store
  ))

  async function load() {
    setLoading(true)
    try {
      const [itemsData, categoriesData, storesData, locationsData] = await Promise.all([
        itemService.list(),
        categoryService.list(),
        storeService.list(),
        canCreate || canEdit ? locationService.list() : Promise.resolve([])
      ])
      setItems(itemsData)
      setCategories(categoriesData)
      const assignedStoreNames = [user?.store, ...(user?.assignedStores || [])].filter(Boolean)
      setStores(storesData.filter((store) => (
        user?.role !== 'Store Head' || assignedStoreNames.length === 0 || assignedStoreNames.includes(store.name)
      )))
      setLocations(locationsData.filter((location) => location.active !== false))
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
    setForm({ ...EMPTY_FORM, ...(isSingleStoreHead ? { store: assignedStoreNames[0] } : {}) })
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(row) {
    if (!canEdit) {
      push('You do not have permission to edit items.', 'error')
      return
    }
    setForm({ ...EMPTY_FORM, ...row, locationId: row.locationId || '' })
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
    { key: 'location', header: 'Location', render: (r) => r.locationPath || r.location || r.bin || '-' },
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
    { key: 'unitPrice', header: 'Unit Price', render: (r) => formatCurrency(r.unitPrice) }
  ].concat(
    !(user?.role === 'Storekeeper' && ['items'].includes('items')) && (canEdit || canDelete)
      ? [{
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
      }]
      : []
  )

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
            options={selectedCategories.map((c) => c.name)}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <Select
            label="Store"
            required
            options={stores.map((s) => s.name)}
            value={form.store}
            disabled={isSingleStoreHead}
            onChange={(e) => setForm((f) => ({ ...f, store: e.target.value, locationId: '' }))}
          />
          <Select label="Unit of Issue" required options={UNITS} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />

          <LocationSelectors
            locations={locations}
            store={form.store}
            storeId={stores.find((store) => store.name === form.store)?.id}
            locationId={form.locationId}
            onChange={(locationId) => setForm((f) => ({ ...f, locationId }))}
            required={!editing}
          />

          <Input label="Quantity on Hand" type="number" required value={form.qtyOnHand} onChange={(e) => setForm((f) => ({ ...f, qtyOnHand: e.target.value }))} />
          <Input label="Unit Price (Birr)" type="number" required value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} />
          <Input label="Minimum Level" type="number" value={form.minLevel} onChange={(e) => setForm((f) => ({ ...f, minLevel: e.target.value }))} />
          <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))} />
          <Input label="Maximum Level" type="number" value={form.maxLevel} onChange={(e) => setForm((f) => ({ ...f, maxLevel: e.target.value }))} />
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-ink-100 pt-4 mt-2">
            <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
            <Input label="Batch Number" value={form.batchNo} onChange={(e) => setForm((f) => ({ ...f, batchNo: e.target.value }))} />
            <Select
              label="Condition"
              options={['New', 'Good', 'Fair', 'Poor', 'Damaged', 'Unusable', 'Obsolete', 'Scrap', 'Condemned']}
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            />
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
