import { useEffect, useState } from 'react'
import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import { locationService, storeService } from '../../services'

export default function LocationList() {
    const [storeOptions, setStoreOptions] = useState([])
    const [locationOptions, setLocationOptions] = useState([])

    useEffect(() => {
        storeService.list().then(stores => {
            setStoreOptions(stores.filter(s => s.active).map(s => s.name))
        }).catch(console.error)

        locationService.list().then(locs => {
            setLocationOptions(locs
                .filter(l => l.active)
                .map(l => ({ label: `${l.name} (${l.code})`, value: l.id, store: l.store, type: l.type })))
        }).catch(console.error)
    }, [])

    return (
        <CrudPage
            title="Locations"
            subtitle="Manage the store section, rack, shelf, and bin hierarchy."
            service={locationService}
            entityType="locations"
            addLabel="Add Location"
            searchKeys={['store', 'parent', 'type', 'code', 'name']}
            emptyTitle="No locations yet"
            emptyMessage="Create a structured location before assigning stock to a bin."
            columns={[
                { key: 'store', header: 'Store' },
                { key: 'type', header: 'Level' },
                { key: 'code', header: 'Code' },
                { key: 'name', header: 'Name' },
                { key: 'parent', header: 'Parent Location' },
                { key: 'active', header: 'Status', render: (row) => <StatusBadge status={row.active ? 'Approved' : 'Cancelled'} /> }
            ]}
            fields={[
                { name: 'store', label: 'Store Name', type: 'select', required: true, options: storeOptions, placeholder: 'Select a store...' },
                { name: 'type', label: 'Location Level', type: 'select', required: true, options: ['SECTION', 'RACK', 'SHELF', 'BIN'] },
                {
                    name: 'parentId',
                    label: 'Parent Location',
                    type: 'select',
                    options: (form) => {
                        const parentType = { RACK: 'SECTION', SHELF: 'RACK', BIN: 'SHELF' }[form.type]
                        if (!parentType) return []
                        return locationOptions
                            .filter(location => location.store === form.store && location.type === parentType)
                            .map(({ label, value }) => ({ label, value }))
                    },
                    placeholder: 'Select a parent location...'
                },
                { name: 'code', label: 'Location Code', required: true, placeholder: 'e.g. E03-02-04' },
                { name: 'name', label: 'Location Name', required: true },
                { name: 'active', label: 'Active', type: 'checkbox' }
            ]}
        />
    )
}