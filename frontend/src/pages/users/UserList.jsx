import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import { userService } from '../../services'
import { ALL_ROLES } from '../../utils/constants'

export default function UserList() {
  return (
    <CrudPage
      title="Users"
      subtitle="Create accounts and assign roles that drive access across the system."
      service={userService}
      addLabel="Add User"
      entityType="users"
      searchKeys={['name', 'username', 'role', 'email']}
      emptyTitle="No users yet"
      emptyMessage="Add the first user account."
      columns={[
        { key: 'name', header: 'Full Name' },
        { key: 'username', header: 'Username' },
        { key: 'role', header: 'Role' },
        { key: 'email', header: 'Email' },
        {
          key: 'active',
          header: 'Status',
          render: (row) => <StatusBadge status={row.active ? 'Approved' : 'Cancelled'} />
        }
      ]}
      fields={[
        { name: 'name', label: 'Full Name', required: true, placeholder: 'e.g. Abel Tesfaye' },
        { name: 'username', label: 'Username', required: true, placeholder: 'e.g. abel.tesfaye' },
        { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'e.g. abel@example.com' },
        { name: 'role', label: 'Role', type: 'select', required: true, options: ALL_ROLES, placeholder: 'Select a role...' },
        { name: 'active', label: 'Active', type: 'checkbox' }
      ]}
    />
  )
}
