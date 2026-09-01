import { useEffect, useState } from 'react'
import CrudPage from '../../components/crud/CrudPage'
import { binTransferService, itemService } from '../../services'
import { formatDate } from '../../utils/formatters'

export default function StockTransfer() {
  const [itemOptions, setItemOptions] = useState([])

  useEffect(() => {
    itemService.list().then((items) => setItemOptions(items.map((i) => i.name)))
  }, [])

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
      columns={[
        { key: 'item', header: 'Item' },
        { key: 'fromBin', header: 'From Bin' },
        { key: 'toBin', header: 'To Bin' },
        { key: 'qty', header: 'Qty' },
        { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
        { key: 'transferredBy', header: 'Transferred By' }
      ]}
      fields={[
        { name: 'item', label: 'Item', type: 'select', required: true, options: itemOptions },
        { name: 'fromBin', label: 'From Bin', required: true, placeholder: 'e.g. A-01' },
        { name: 'toBin', label: 'To Bin', required: true, placeholder: 'e.g. A-03' },
        { name: 'qty', label: 'Quantity', type: 'number', required: true },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'transferredBy', label: 'Transferred By', required: true }
      ]}
    />
  )
}
