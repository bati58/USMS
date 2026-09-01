import CrudPage from '../../components/crud/CrudPage'
import { fixedAssetService } from '../../services'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function FixedAssetList() {
  return (
    <CrudPage
      title="Fixed Assets"
      subtitle="Register and track fixed assets issued from store."
      service={fixedAssetService}
      addLabel="Register Asset"
      entityType="fixedAssets"
      searchKeys={['assetTag', 'name', 'category', 'assignedTo']}
      emptyTitle="No fixed assets yet"
      emptyMessage="Register an asset such as a printer or lab instrument."
      columns={[
        { key: 'assetTag', header: 'Asset Tag' },
        { key: 'name', header: 'Asset Name' },
        { key: 'category', header: 'Category' },
        { key: 'assignedTo', header: 'Assigned To' },
        { key: 'status', header: 'Status' },
        { key: 'acquisitionDate', header: 'Acquired', render: (r) => formatDate(r.acquisitionDate) },
        { key: 'value', header: 'Value', render: (r) => formatCurrency(r.value) }
      ]}
      fields={[
        { name: 'assetTag', label: 'Asset Tag', required: true, placeholder: 'e.g. FA-2026-0102' },
        { name: 'name', label: 'Asset Name', required: true },
        { name: 'category', label: 'Category', required: true },
        { name: 'store', label: 'Store', required: true },
        { name: 'assignedTo', label: 'Assigned To', required: true },
        { name: 'status', label: 'Status', type: 'select', required: true, options: ['In Use', 'In Store', 'Under Repair', 'Disposed'] },
        { name: 'acquisitionDate', label: 'Acquisition Date', type: 'date', required: true },
        { name: 'value', label: 'Value (Birr)', type: 'number', required: true }
      ]}
    />
  )
}
