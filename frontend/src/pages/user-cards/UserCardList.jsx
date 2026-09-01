import { useEffect, useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Table from '../../components/ui/Table'
import StatusBadge from '../../components/ui/StatusBadge'
import { itemService, userCardService } from '../../services'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { canPerformAction } from '../../utils/rolePermissions'

const EMPTY_FORM = { user: '', department: '', item: '', issueRef: '', issueDate: '', qty: 1, status: 'In Use', notes: '' }

export default function UserCardList() {
    const { push } = useToast()
    const { user } = useAuth()
    const [rows, setRows] = useState([])
    const [items, setItems] = useState([])
    const [form, setForm] = useState(EMPTY_FORM)
    const [editing, setEditing] = useState(null)
    const [loading, setLoading] = useState(true)
    const canEdit = canPerformAction(user?.role, 'edit', 'userCards')

    async function load() {
        setLoading(true)
        try {
            const [cards, catalog] = await Promise.all([userCardService.list(), itemService.list()])
            setRows(cards)
            setItems(catalog)
        } catch (error) {
            setRows([])
            push(error.message || 'Could not load user material cards.', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    async function save(event) {
        event.preventDefault()
        try {
            const payload = { ...form, qty: Number(form.qty) }
            if (editing) await userCardService.update(editing.id, payload)
            else await userCardService.create(payload)
            setEditing(null)
            setForm(EMPTY_FORM)
            await load()
            push('User material card saved.', 'success')
        } catch (error) {
            push(error.message, 'error')
        }
    }

    async function remove(id) {
        try {
            await userCardService.remove(id)
            await load()
            push('User material card removed.', 'success')
        } catch (error) {
            push(error.message, 'error')
        }
    }

    return (
        <div>
            <PageHeader title="User Material Cards" subtitle="Record material custody after a posted issue voucher." />
            {canEdit && (
                <Card title={editing ? 'Edit custody record' : 'Record custody'} className="mb-6">
                    <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <Input placeholder="User name" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} required />
                        <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                        <select className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} required>
                            <option value="">Select item</option>
                            {items.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                        </select>
                        <Input placeholder="Issue reference" value={form.issueRef} onChange={(e) => setForm({ ...form, issueRef: e.target.value })} required />
                        <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required />
                        <Input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} required />
                        <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            {['In Use', 'Maintenance', 'Lost', 'Damaged', 'Returned'].map((status) => <option key={status}>{status}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <Button type="submit">Save</Button>
                            {editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm(EMPTY_FORM) }}>Cancel</Button>}
                        </div>
                    </form>
                </Card>
            )}
            <Card>
                <Table
                    columns={[
                        { key: 'user', header: 'User' },
                        { key: 'department', header: 'Department' },
                        { key: 'item', header: 'Item' },
                        { key: 'qty', header: 'Qty' },
                        { key: 'issueRef', header: 'Issue Reference' },
                        { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                        ...(canEdit ? [{ key: '__actions', header: 'Actions', render: (row) => <div className="flex gap-2"><Button variant="secondary" onClick={() => { setEditing(row); setForm(row) }}>Edit</Button><Button variant="danger" onClick={() => remove(row.id)}>Delete</Button></div> }] : [])
                    ]}
                    rows={rows}
                    loading={loading}
                    emptyTitle="No user material cards"
                    emptyMessage="No issued materials have been recorded."
                />
            </Card>
        </div>
    )
}
