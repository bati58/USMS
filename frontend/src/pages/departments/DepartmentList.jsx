import { useEffect, useState } from 'react'
import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import { departmentService, userService } from '../../services'

export default function DepartmentList() {
    const [userOptions, setUserOptions] = useState([])

    useEffect(() => {
        userService.list().then((users) => {
            setUserOptions(users.map(u => ({ label: `${u.name} (${u.username})`, value: u.id })))
        }).catch(console.error)
    }, [])

    return (
        <CrudPage
            title="Departments"
            subtitle="Maintain departments used for requests, ownership, and approval scope."
            service={departmentService}
            entityType="departments"
            addLabel="Add Department"
            searchKeys={['code', 'name', 'head']}
            emptyTitle="No departments yet"
            emptyMessage="Create departments before assigning request and approval ownership."
            columns={[
                { key: 'code', header: 'Department Code' },
                { key: 'name', header: 'Department Name' },
                { key: 'head', header: 'Department Head' },
                { key: 'active', header: 'Status', render: (row) => <StatusBadge status={row.active ? 'Approved' : 'Cancelled'} /> }
            ]}
            fields={[
                { name: 'code', label: 'Department Code', required: true, placeholder: 'e.g. DEPT-EEE' },
                { name: 'name', label: 'Department Name', required: true },
                { name: 'headUserId', label: 'Department Head', type: 'select', options: userOptions, placeholder: 'Select a user...' },
                { name: 'active', label: 'Active', type: 'checkbox' }
            ]}
        />
    )
}