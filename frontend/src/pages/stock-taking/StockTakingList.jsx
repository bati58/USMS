import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Table from '../../components/ui/Table'
import { stockTakingService, storeService, itemService, userService } from '../../services/index'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Plus, CheckCircle2, Send, X } from 'lucide-react'
import { ROLES } from '../../utils/constants'

export default function StockTakingList() {
    const { user } = useAuth()
    const { push } = useToast()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
    const [stores, setStores] = useState([])
    const [items, setItems] = useState([])
    const [clerks, setClerks] = useState([])
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [selectedSession, setSelectedSession] = useState(null)
    const [selectedVarianceItem, setSelectedVarianceItem] = useState(null)
    const [countDraft, setCountDraft] = useState([])
    const [showApproveDialog, setShowApproveDialog] = useState(false)
    const [showPostDialog, setShowPostDialog] = useState(false)
    const [createForm, setCreateForm] = useState({
        storeId: '',
        countDate: new Date().toISOString().split('T')[0],
        assignedTo: '',
        items: []
    })

    // Store-scoping for storekepers and store heads
    const userAssignedStore = user?.store || ''
    const isScopedStoreUser = ['Storekeeper', 'Store Head'].includes(user?.role) && !!userAssignedStore
    const isMainStoreHead = user?.role === ROLES.STORE_HEAD && !userAssignedStore

    useEffect(() => {
        loadSessions()
        loadStoresAndItems()
        loadStockClerks()
    }, [])

    const loadSessions = async () => {
        setLoading(true)
        try {
            const sessions = await stockTakingService.list()
            setData(sessions)
        } catch (error) {
            push(error.message || 'Failed to load stock-taking sessions', 'error')
        } finally {
            setLoading(false)
        }
    }

    const loadStoresAndItems = async () => {
        try {
            const [storesList, itemsList] = await Promise.all([
                storeService.list(),
                itemService.list()
            ])
            setStores(storesList.filter((store) => store.active !== false))
            setItems(itemsList)
        } catch (error) {
            push(error.message || 'Failed to load stores and items', 'error')
        }
    }

    const loadStockClerks = async () => {
        try {
            const users = await userService.listStockClerks()
            setClerks(users.filter((entry) => entry.active !== false))
        } catch (error) {
            push(error.message || 'Failed to load stock clerks', 'error')
        }
    }

    const updateItemField = (itemId, field, value) =>
        setCreateForm((prev) => ({
            ...prev,
            items: prev.items.map((i) => (i.itemId === itemId ? { ...i, [field]: value } : i))
        }))

    const handleCreateSession = async () => {
        if (!createForm.storeId || !createForm.assignedTo || createForm.items.length === 0) {
            push('Select a store, assign a stock clerk, and add at least one item', 'error')
            return
        }
        try {
            await stockTakingService.create({
                store: stores.find((store) => String(store.id) === String(createForm.storeId))?.name,
                countDate: createForm.countDate,
                assignedTo: createForm.assignedTo,
                items: createForm.items.map(item => ({
                    item: items.find((catalogItem) => catalogItem.id === item.itemId)?.name
                }))
            })
            push('Stock-taking session created successfully', 'success')
            setShowCreateModal(false)
            setCreateForm({ storeId: '', countDate: new Date().toISOString().split('T')[0], assignedTo: '', items: [] })
            loadSessions()
        } catch (error) {
            push(error.message || 'Failed to create session', 'error')
        }
    }

    const handleSubmitSession = async () => {
        try {
            await stockTakingService.submit(selectedSession.id)
            push('Session submitted for approval', 'success')
            setShowApproveDialog(false)
            loadSessions()
            setShowDetailModal(false)
        } catch (error) {
            push(error.message || 'Failed to submit session', 'error')
        }
    }

    const handleSaveCount = async () => {
        try {
            const updated = await stockTakingService.update(selectedSession.id, countDraft)
            setSelectedSession(updated)
            push('Physical counts saved. Official stock remains unchanged.', 'success')
            loadSessions()
        } catch (error) {
            push(error.message || 'Failed to save count', 'error')
        }
    }

    const handleRequestRecount = async () => {
        const reason = window.prompt('Reason for recount')
        if (!reason?.trim()) return
        try {
            const updated = await stockTakingService.requestRecount(selectedSession.id, reason.trim())
            setSelectedSession(updated)
            push('Recount requested from the Stock Clerk.', 'success')
            loadSessions()
        } catch (error) {
            push(error.message || 'Failed to request recount', 'error')
        }
    }

    const handleVerifySession = async () => {
        try {
            await stockTakingService.verify(selectedSession.id)
            push('Count verified. No adjustment is required.', 'success')
            loadSessions()
            setShowDetailModal(false)
        } catch (error) {
            push(error.message || 'The count could not be verified', 'error')
        }
    }

    const handleReconcileSession = async () => {
        try {
            await stockTakingService.reconcile(selectedSession.id)
            push('Session sent to PAO for adjustment approval.', 'success')
            loadSessions()
            setShowDetailModal(false)
        } catch (error) {
            push(error.message || 'The session could not be sent for reconciliation', 'error')
        }
    }

    const handleApproveSession = async () => {
        try {
            await stockTakingService.approve(selectedSession.id)
            push('Session approved successfully', 'success')
            setShowApproveDialog(false)
            loadSessions()
            setShowDetailModal(false)
        } catch (error) {
            push(error.message || 'Failed to approve session', 'error')
        }
    }

    const handlePostSession = async () => {
        const missingCounts = (selectedSession?.items || []).filter((item) => item.physicalQty == null && item.recountPhysicalQty == null)
        if (missingCounts.length > 0) {
            setShowPostDialog(false)
            push(`Enter a physical count before posting: ${missingCounts.map((item) => item.item).join(', ')}.`, 'error')
            return
        }
        const missingReasons = (selectedSession?.items || []).filter((item) => {
            const physicalQty = item.recountPhysicalQty ?? item.physicalQty
            const variance = Number(physicalQty) - Number(item.systemQty)
            return Math.abs(variance) > 0.0001 && !String(item.reason || '').trim()
        })
        if (missingReasons.length > 0) {
            setShowPostDialog(false)
            push(`Add a reason for each variance before posting: ${missingReasons.map((item) => item.item).join(', ')}.`, 'error')
            return
        }

        try {
            await stockTakingService.post(selectedSession.id)
            push('Session posted and adjustments applied', 'success')
            setShowPostDialog(false)
            loadSessions()
            setShowDetailModal(false)
        } catch (error) {
            push(error.message || 'Failed to post session', 'error')
        }
    }

    const getStockStatus = (session) => {
        const variant = {
            'Draft': 'default',
            'Scheduled': 'default',
            'In Progress': 'info',
            'Submitted': 'warning',
            'Under Review': 'warning',
            'Recount Required': 'warning',
            'Variance Detected': 'warning',
            'Investigation': 'info',
            'Adjustment Proposed': 'info',
            'Approved': 'success',
            'Rejected': 'danger',
            'Posted': 'success',
            'Closed': 'success'
        }[session.status] || 'default'
        return <Badge variant={variant}>{session.status}</Badge>
    }

    const canSubmit = ['Draft', 'Scheduled', 'In Progress', 'Recount Required'].includes(selectedSession?.status) &&
        user?.role === ROLES.STOCK_CLERK &&
        selectedSession?.assignedTo === user?.name
    const canEditCount = selectedSession && ['Draft', 'Scheduled', 'In Progress', 'Recount Required'].includes(selectedSession.status) && user?.role === ROLES.STOCK_CLERK && selectedSession.assignedTo === user?.name
    const canReview = ['Submitted', 'Under Review'].includes(selectedSession?.status) && user?.role === ROLES.STORE_HEAD
    const canRequestRecount = canReview
    const canApprove = selectedSession?.status === 'Pending Approval' && user?.role === ROLES.PAO
    const canPost = selectedSession?.status === 'Approved' &&
        [ROLES.PAO, ROLES.STORE_HEAD].includes(user?.role)

    const columns = [
        { key: 'sessionRef', header: 'Reference', width: '15%' },
        { key: 'store', header: 'Store', width: '20%' },
        { key: 'countDate', header: 'Count Date', width: '15%', render: (row) => new Date(row.countDate).toLocaleDateString() },
        { key: 'status', header: 'Status', width: '15%', render: (row) => getStockStatus(row) },
        {
            key: 'actions',
            header: 'Actions',
            width: '35%',
            render: (row) => (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        setSelectedSession(row)
                        setCountDraft((row.items || []).map((item) => ({ itemId: item.itemId, physicalQty: item.recountPhysicalQty ?? item.physicalQty, reason: item.reason || '' })))
                        setShowDetailModal(true)
                    }}
                >
                    View Details
                </Button>
            )
        }
    ]

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Stock Taking Sessions</h1>
                {user?.role === ROLES.STORE_HEAD && (
                    <Button onClick={() => {
                        if (isScopedStoreUser) {
                            const assignedStoreId = stores.find((s) => s.name === userAssignedStore)?.id || ''
                            setCreateForm({ ...createForm, storeId: assignedStoreId })
                        }
                        setShowCreateModal(true)
                    }} size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        New Session
                    </Button>
                )}
            </div>

            <div className="card p-6">
                <Table
                    columns={columns}
                    rows={data}
                    loading={loading}
                    emptyTitle="No stock taking sessions"
                    emptyMessage="Stock taking sessions will appear here once created."
                    rowKey="id"
                />
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedSession && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Stock Taking Session {selectedSession.sessionRef}</h2>
                            <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                            <div>
                                <p className="text-sm text-gray-600">Store</p>
                                <p className="font-semibold">{selectedSession.store}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Count Date</p>
                                <p className="font-semibold">{new Date(selectedSession.countDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Status</p>
                                <p>{getStockStatus(selectedSession)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Created By</p>
                                <p className="font-semibold">{selectedSession.createdBy}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Assigned Clerk</p>
                                <p className="font-semibold">{selectedSession.assignedTo || 'Not assigned'}</p>
                            </div>
                        </div>

                        {/* Variance Items */}
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold mb-3">Counted Items</h3>
                            {selectedSession.items && selectedSession.items.length > 0 ? (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {selectedSession.items.map((item) => {
                                        const physicalQty = item.recountPhysicalQty ?? item.physicalQty
                                        const variance = physicalQty == null ? null : Number(physicalQty) - Number(item.systemQty)
                                        const hasVariance = Math.abs(variance) > 0.0001
                                        return (
                                            <div key={item.id} className={`p-3 border rounded ${hasVariance ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50'}`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <p className="font-semibold">{item.item}</p>
                                                        <div className="grid grid-cols-4 gap-2 text-sm mt-1 text-gray-600">
                                                            <div>
                                                                <p className="text-xs uppercase">System Qty</p>
                                                                <p className="font-semibold">{Number(item.systemQty).toFixed(2)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs uppercase">Physical Qty</p>
                                                                <p className="font-semibold">{physicalQty == null ? '-' : Number(physicalQty).toFixed(2)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs uppercase">Variance</p>
                                                                <p className={`font-semibold ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : ''}`}>
                                                                    {variance > 0 ? '+' : ''}{Number(item.recountVariance ?? variance).toFixed(2)}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs uppercase">Bin</p>
                                                                <p className="font-semibold">{item.bin || '-'}</p>
                                                            </div>
                                                        </div>
                                                        {item.reason && (
                                                            <p className="text-sm text-gray-700 mt-2"><strong>Reason:</strong> {item.reason}</p>
                                                        )}
                                                        {item.counter && (
                                                            <p className="text-xs text-gray-500 mt-1">Counted by: {item.counter}</p>
                                                        )}
                                                        {item.verifiedBy && (
                                                            <p className="text-xs text-gray-500">Verified by: {item.verifiedBy}</p>
                                                        )}
                                                        {canEditCount && (
                                                            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                <input type="number" min="0" step="any" value={countDraft.find((draft) => draft.itemId === item.itemId)?.physicalQty ?? ''} onChange={(e) => setCountDraft((drafts) => drafts.map((draft) => draft.itemId === item.itemId ? { ...draft, physicalQty: e.target.value } : draft))} className="rounded-md border border-gray-300 px-2 py-1 text-sm" placeholder="Physical quantity" />
                                                                <input value={countDraft.find((draft) => draft.itemId === item.itemId)?.reason ?? ''} onChange={(e) => setCountDraft((drafts) => drafts.map((draft) => draft.itemId === item.itemId ? { ...draft, reason: e.target.value } : draft))} className="rounded-md border border-gray-300 px-2 py-1 text-sm" placeholder="Reason if variance" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <EmptyState>No items in this session</EmptyState>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-end pt-4 border-t">
                            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                                Close
                            </Button>
                            {canSubmit && (
                                <Button onClick={handleSubmitSession} variant="primary">
                                    <Send className="w-4 h-4 mr-2" />
                                    Submit Session
                                </Button>
                            )}
                            {canEditCount && (
                                <Button onClick={handleSaveCount} variant="outline">Save Count</Button>
                            )}
                            {canRequestRecount && (
                                <Button onClick={handleRequestRecount} variant="outline">Request Recount</Button>
                            )}
                            {canReview && (
                                <>
                                    <Button onClick={handleVerifySession} variant="primary">Verify Count</Button>
                                    <Button onClick={handleReconcileSession} variant="outline">Send for Reconciliation</Button>
                                </>
                            )}
                            {canApprove && (
                                <Button
                                    onClick={() => setShowApproveDialog(true)}
                                    variant="primary"
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Approve Session
                                </Button>
                            )}
                            {canPost && (
                                <Button
                                    onClick={() => setShowPostDialog(true)}
                                    variant="primary"
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Post & Apply Adjustments
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Create Stock Taking Session</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Store</label>
                                {isScopedStoreUser && !isMainStoreHead ? (
                                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
                                        {userAssignedStore}
                                    </div>
                                ) : (
                                    <select
                                        value={createForm.storeId}
                                        onChange={(e) => setCreateForm({ ...createForm, storeId: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select a store</option>
                                        {stores.map((store) => (
                                            <option key={store.id} value={store.id}>
                                                {store.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Count Date</label>
                                <input
                                    type="date"
                                    value={createForm.countDate}
                                    onChange={(e) => setCreateForm({ ...createForm, countDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Assign to Stock Clerk</label>
                                <select
                                    value={createForm.assignedTo}
                                    onChange={(e) => setCreateForm({ ...createForm, assignedTo: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select a stock clerk</option>
                                    {clerks.map((clerk) => (
                                        <option key={clerk.id} value={clerk.name}>
                                            {clerk.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Select Items to Count</label>
                                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-2">
                                    {items
                                        .filter((item) => !createForm.storeId || item.store === stores.find((store) => String(store.id) === String(createForm.storeId))?.name)
                                        .map((item) => {
                                            const selected = createForm.items.find((i) => i.itemId === item.id)
                                            return (
                                                <div key={item.id} className="rounded-md border border-gray-100 p-2">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(selected)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setCreateForm((prev) => ({
                                                                        ...prev,
                                                                        items: [...prev.items, { itemId: item.id, physicalQty: '', reason: '' }]
                                                                    }))
                                                                } else {
                                                                    setCreateForm((prev) => ({
                                                                        ...prev,
                                                                        items: prev.items.filter((i) => i.itemId !== item.id)
                                                                    }))
                                                                }
                                                            }}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="text-sm">
                                                            {item.name} (Bin: {item.bin || '-'})
                                                            <span className="text-gray-400"> · System: {Number(item.qtyOnHand ?? 0)}</span>
                                                        </span>
                                                    </label>
                                                    {selected && <p className="mt-1 ml-6 text-xs text-gray-500">The assigned Stock Clerk will enter the physical count after the session is created.</p>}
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateSession} variant="primary">
                                Create Session
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Approve Confirmation */}
            <ConfirmDialog
                open={showApproveDialog}
                title="Approve Stock Taking Session?"
                message={`Approve session ${selectedSession?.sessionRef}? The session can be posted after approval.`}
                confirmLabel="Approve"
                onConfirm={handleApproveSession}
                onClose={() => setShowApproveDialog(false)}
            />

            {/* Post Confirmation */}
            <ConfirmDialog
                open={showPostDialog}
                title="Post Stock Adjustments?"
                message={`Post all variance adjustments for session ${selectedSession?.sessionRef}? This will update stock quantities and create adjustment transactions. Every non-zero variance must have a reason.`}
                confirmLabel="Post & Apply"
                onConfirm={handlePostSession}
                onClose={() => setShowPostDialog(false)}
            />
        </div>
    )
}
