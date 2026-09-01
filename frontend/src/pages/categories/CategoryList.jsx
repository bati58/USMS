import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import { categoryService, storeService } from '../../services'
import { useEffect, useState } from 'react'

export default function CategoryList() {
  const [storeOptions, setStoreOptions] = useState([])

  useEffect(() => {
    storeService.list().then((stores) => setStoreOptions(stores.map((s) => s.name)))
  }, [])

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
        { key: 'code', header: 'Account Code' },
        { key: 'name', header: 'Category Name' },
        { key: 'store', header: 'Belongs To Store' },
        { key: 'description', header: 'Description' },
        { key: 'active', header: 'Status', render: (row) => <StatusBadge status={row.active !== false ? 'Active' : 'Inactive'} /> }
      ]}
      fields={[
        { name: 'code', label: 'Account Code', required: true, placeholder: 'e.g. 4402' },
        { name: 'name', label: 'Category Name', required: true },
        { name: 'store', label: 'Belongs To Store', type: 'select', required: true, options: storeOptions },
        { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
        { name: 'active', label: 'Active', type: 'checkbox' }
      ]}
    />
  )
}
