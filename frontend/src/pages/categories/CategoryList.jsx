import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import { categoryService } from '../../services'

export default function CategoryList() {
  return (
    <CrudPage
      title="Item Categories"
      subtitle="Maintain item categories per store and align them with your accounting structure."
      service={categoryService}
      addLabel="Add Category"
      entityType="categories"
      searchKeys={['name', 'code', 'store']}
      emptyTitle="No categories yet"
      emptyMessage="Add a category such as Office Supplies or Spare Parts."
      columns={[
        { key: 'code', header: 'Category Code' },
        { key: 'name', header: 'Category Name' },
        { key: 'description', header: 'Description' },
        { key: 'active', header: 'Status', render: (row) => <StatusBadge status={row.active !== false ? 'Active' : 'Inactive'} /> }
      ]}
      fields={[
        { name: 'code', label: 'Category Code', required: true, placeholder: 'e.g. CAT-LAB' },
        { name: 'name', label: 'Category Name', required: true, placeholder: 'e.g. Office Supplies' },
        { name: 'description', label: 'Description', type: 'textarea', placeholder: 'e.g. Stationery and general office materials', fullWidth: true },
        { name: 'active', label: 'Active', type: 'checkbox' }
      ]}
    />
  )
}
