import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import { supplierService } from '../../services'

export default function SupplierList() {
    return (
        <CrudPage
            title="Suppliers"
            subtitle="Maintain approved supplier records for receiving and delivery history."
            service={supplierService}
            entityType="suppliers"
            addLabel="Add Supplier"
            searchKeys={['code', 'name', 'contact', 'address']}
            emptyTitle="No suppliers yet"
            emptyMessage="Register a supplier before recording controlled deliveries."
            columns={[
                { key: 'code', header: 'Supplier Code' },
                { key: 'name', header: 'Supplier Name' },
                { key: 'contact', header: 'Contact' },
                { key: 'address', header: 'Address' },
                { key: 'active', header: 'Status', render: (row) => <StatusBadge status={row.active ? 'Approved' : 'Cancelled'} /> }
            ]}
            fields={[
                { name: 'code', label: 'Supplier Code', required: true, placeholder: 'e.g. SUP-001' },
                { name: 'name', label: 'Supplier Name', required: true },
                { name: 'contact', label: 'Contact' },
                { name: 'address', label: 'Address', type: 'textarea', fullWidth: true },
                { name: 'active', label: 'Active', type: 'checkbox' }
            ]}
        />
    )
}