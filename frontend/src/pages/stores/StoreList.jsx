import { useEffect, useState } from 'react'
import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import { storeService, userService } from '../../services'

export default function StoreList() {
  const [userOptions, setUserOptions] = useState([])

  useEffect(() => {
    userService.list().then(users => {
      const options = users.map(u => ({
        label: `${u.name} (${u.username})`,
        value: u.name,
        role: u.role
      }))
      setUserOptions(options)
    }).catch(console.error)
  }, [])

  const storeHeadOptions = userOptions.filter(u => u.role === 'Store Head')
  const storekeeperOptions = userOptions.filter(u => u.role === 'Storekeeper')

  return (
    <CrudPage
      title="Stores"
      subtitle="Manage the main store and each department / cafe store."
      service={storeService}
      addLabel="Add Store" entityType="stores" searchKeys={['name', 'code', 'type', 'location']}
      emptyTitle="No stores yet"
      emptyMessage="Register the main store and department stores to get started."
      columns={[
        { key: 'code', header: 'Code' },
        { key: 'name', header: 'Store Name' },
        { key: 'type', header: 'Type' },
        { key: 'department', header: 'Department' },
        { key: 'location', header: 'Location' },
        { key: 'headOfStore', header: 'Store Head' },
        { key: 'storekeeper', header: 'Storekeeper' },
        { key: 'contactInfo', header: 'Contact' },
        { key: 'description', header: 'Description' },
        {
          key: 'active',
          header: 'Status',
          render: (row) => <StatusBadge status={row.active ? 'Active' : 'Inactive'} />
        }
      ]}
      fields={[
        { name: 'name', label: 'Store Name', required: true },
        { name: 'code', label: 'Store Code', required: true, placeholder: 'e.g. STR-EEE' },
        {
          name: 'type',
          label: 'Store Type',
          type: 'select',
          required: true,
          options: ['Main Store', 'Department Store', 'Cafe Store', 'Specialized/Laboratory']
        },
        { name: 'department', label: 'Department/Org Unit', placeholder: 'e.g. Electrical Engineering' },
        { name: 'location', label: 'Physical Location', required: true },
        { name: 'contactInfo', label: 'Contact Info', placeholder: 'Phone or Email' },
        { name: 'headOfStore', label: 'Store Head', type: 'select', options: storeHeadOptions, required: true, placeholder: 'Select a store head...' },
        { name: 'storekeeper', label: 'Storekeeper', type: 'select', options: storekeeperOptions, placeholder: 'Select storekeeper...' },
        { name: 'description', label: 'Description', type: 'textarea', fullWidth: true },
        { name: 'active', label: 'Active', type: 'checkbox' }
      ]}
    />
  )
}
