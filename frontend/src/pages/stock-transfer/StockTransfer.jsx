import { useEffect, useState } from 'react'
import CrudPage from '../../components/crud/CrudPage'
import { useAuth } from '../../context/AuthContext'
import { binCardService, binTransferService, itemInventoryService, locationService } from '../../services'
import { formatDate } from '../../utils/formatters'
import { uniqueItemsByName } from '../../utils/itemOptions'

export default function StockTransfer() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [sourceBins, setSourceBins] = useState([])

  useEffect(() => {
    Promise.all([itemInventoryService.list(), locationService.list()]).then(([loadedItems, loadedLocations]) => {
      const availableItems = loadedItems.filter((item) => {
        if (user?.role !== 'Storekeeper') return true
        const assignedStores = user.assignedStores?.length ? user.assignedStores : [user.store].filter(Boolean)
        return assignedStores.includes(item.store) && Number(item.qtyOnHand) > 0
      })
      const uniqueAvailableItems = uniqueItemsByName(availableItems)
      setItems(uniqueAvailableItems)
      setLocations(loadedLocations.filter((location) => location.active !== false && location.type === 'BIN'))
    })
  }, [user])

  async function validateBinTransfer(payload) {
    const selectedItem = items.find((item) => item.name === payload.item)
    const requestedQty = Number(payload.qty)
    const availableQty = Number(selectedItem?.qtyOnHand)
    if (!selectedItem || !payload.fromLocationId || !payload.toLocationId || !Number.isFinite(requestedQty) || requestedQty <= 0) {
      throw new Error('Select an item and enter a positive quantity.')
    }
    if (requestedQty > availableQty) {
      throw new Error(`Insufficient stock. ${selectedItem.name} has only ${availableQty} available.`)
    }
  }

  return (
    <CrudPage
      title="Stock Transfer Between Bins"
      subtitle="Move stock from one bin or location to another within the same store."
      service={binTransferService}
      addLabel="New Bin Transfer"
      entityType="stockTransfer"
      searchKeys={['item', 'fromBin', 'toBin']}
      emptyTitle="No bin transfers yet"
      emptyMessage="Record a transfer when materials are moved between bins."
      validatePayload={validateBinTransfer}
      columns={[
        { key: 'item', header: 'Item' },
        { key: 'fromBin', header: 'From Bin' },
        { key: 'toBin', header: 'To Bin' },
        { key: 'qty', header: 'Qty' },
        { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
        { key: 'transferredBy', header: 'Transferred By' }
      ]}
      fields={[
        {
          name: 'item',
          label: 'Item',
          type: 'select',
          required: true,
          options: items.map((item) => ({ value: item.name, label: `${item.name} (qty: ${item.qtyOnHand})` })),
          onChange: async (e, { setForm }) => {
            const selectedItem = items.find((entry) => entry.name === e.target.value)
            setForm((prev) => ({
              ...prev,
              item: e.target.value,
              itemId: selectedItem?.id || '',
              fromLocationId: '',
              toLocationId: ''
            }))
            setSourceBins([])
            if (!selectedItem) return
            try {
              const cards = await binCardService.listByItem(selectedItem.id)
              setSourceBins(cards.filter((card) => Number(card.balance) > 0 && Number(card.storeId) === Number(selectedItem.storeId)))
            } catch (error) {
              throw new Error(`Could not load bins for ${selectedItem.name}: ${error.message}`)
            }
          }
        },
        { name: 'fromLocationId', label: 'From Bin', type: 'select', required: true, options: sourceBins.map((bin) => ({ value: bin.locationId, label: `${bin.bin} (available: ${bin.balance})` })).filter((bin) => bin.value) },
        { name: 'toLocationId', label: 'To Bin', type: 'select', required: true, options: (form) => locations.filter((location) => location.storeId === items.find((item) => item.name === form.item)?.storeId && Number(location.id) !== Number(form.fromLocationId)).map((location) => ({ value: location.id, label: `${location.code} - ${location.name}` })) },
        { name: 'qty', label: 'Quantity', type: 'number', required: true },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'transferredBy', label: 'Transferred By', required: true }
      ]}
    />
  )
}
