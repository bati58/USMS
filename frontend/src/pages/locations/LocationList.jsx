import { useEffect, useState } from 'react'
import CrudPage from '../../components/crud/CrudPage'
import StatusBadge from '../../components/ui/StatusBadge'
import { locationService, storeService } from '../../services'
import { useAuth } from '../../context/AuthContext'

export default function LocationList() {
    const { user } = useAuth()
    const [storeOptions, setStoreOptions] = useState([])
    const [stores, setStores] = useState([])
    const [locationOptions, setLocationOptions] = useState([])
    const assignedStoreNames = [user?.store, ...(user?.assignedStores || [])].filter(Boolean)
    const isStoreScoped = ['Store Head', 'Storekeeper'].includes(user?.role)
    const isSingleStoreUser = isStoreScoped && assignedStoreNames.length === 1

    async function loadLocationOptions() {
        const locs = await locationService.list()
        setLocationOptions(locs
            .filter(l => l.active)
            .map(l => ({ label: `${l.name} (${l.code})`, value: l.id, store: l.store, storeId: l.storeId, type: l.type })))
    }

    useEffect(() => {
        storeService.list().then(stores => {
            const activeStores = stores.filter(s => s.active && (
                !isStoreScoped || assignedStoreNames.length === 0 || assignedStoreNames.includes(s.name)
            ))
            setStores(activeStores)
            setStoreOptions(activeStores.map(s => s.name))
        }).catch(console.error)

        loadLocationOptions().catch(console.error)
    }, [user?.role, user?.store, user?.assignedStores])

    return (
        <CrudPage
            title="Locations"
            subtitle="Manage the store section, rack, shelf, and bin hierarchy."
            service={locationService}
            onSaved={loadLocationOptions}
            initialValues={() => isSingleStoreUser ? { store: assignedStoreNames[0] } : {}}
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
                { name: 'store', label: 'Store Name', type: 'select', required: true, options: storeOptions, placeholder: 'Select a store...', disabled: () => isSingleStoreUser },
                { name: 'type', label: 'Location Level', type: 'select', required: true, options: ['SECTION', 'RACK', 'SHELF', 'BIN'] },
                {
                    name: 'parentId',
                    label: 'Parent Location',
                    type: 'select',
                    required: (form) => form.type !== 'SECTION',
                    options: (form) => {
                        const parentType = { RACK: 'SECTION', SHELF: 'RACK', BIN: 'SHELF' }[form.type]
                        if (!parentType) return []
                        const selectedStore = stores.find(store => store.name === form.store)
                        return locationOptions
                            .filter(location => location.active !== false && location.type === parentType && (
                                selectedStore?.id
                                    ? Number(location.storeId) === Number(selectedStore.id)
                                    : location.store === form.store
                            ))
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