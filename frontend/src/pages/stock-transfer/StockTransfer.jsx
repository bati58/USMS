import { useEffect, useState } from 'react'
import CrudPage from '../../components/crud/CrudPage'
import { useAuth } from '../../context/AuthContext'
import { binTransferService, itemService } from '../../services'
import { formatDate } from '../../utils/formatters'
import { uniqueItemsByName } from '../../utils/itemOptions'

export default function StockTransfer() {
  const { user } = useAuth()
  const [itemOptions, setItemOptions] = useState([])
  const [items, setItems] = useState([])

  useEffect(() => {
    itemService.list().then((loadedItems) => {
      const availableItems = loadedItems.filter((item) => {
        if (user?.role !== 'Storekeeper') return true
        const assignedStores = user.assignedStores?.length ? user.assignedStores : [user.store].filter(Boolean)
        return assignedStores.includes(item.store) && Number(item.qtyOnHand) > 0
      })
      const uniqueAvailableItems = uniqueItemsByName(availableItems)
      setItems(uniqueAvailableItems)
      setItemOptions(uniqueAvailableItems.map((item) => ({
        value: item.name,
        label: `${item.name} (qt: ${item.qtyOnHand})`
      })))
    })
  }, [user])

  async function validateBinTransfer(payload) {
    const selectedItem = items.find((item) => item.name === payload.item)
    const requestedQty = Number(payload.qty)
    const availableQty = Number(selectedItem?.qtyOnHand)
    if (!selectedItem || !Number.isFinite(requestedQty) || requestedQty <= 0) {
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
          options: itemOptions,
          onChange: (e, { setForm }) => {
            const selectedItem = items.find((entry) => entry.name === e.target.value)
            setForm((prev) => ({ ...prev, item: e.target.value, fromBin: selectedItem?.bin || '' }))
          }
        },
        { name: 'fromBin', label: 'From Bin', required: true, placeholder: 'Select an item first', disabled: (form) => Boolean(form.item) },
        { name: 'toBin', label: 'To Bin', required: true, placeholder: 'e.g. A-03' },
        { name: 'qty', label: 'Quantity', type: 'number', required: true },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'transferredBy', label: 'Transferred By', required: true }
      ]}
    />
  )
}
