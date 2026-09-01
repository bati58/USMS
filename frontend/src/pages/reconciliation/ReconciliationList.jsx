import { useEffect, useState } from 'react'
import { useToast } from '../../context/ToastContext'
import Table from '../../components/ui/Table'
import { reconciliationService } from '../../services/index'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { Download } from 'lucide-react'

export default function ReconciliationList() {
    const { push } = useToast()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadReconciliation()
    }, [])

    const loadReconciliation = async () => {
        setLoading(true)
        try {
            const report = await reconciliationService.list()
            setData(report)
        } catch (error) {
            push(error.message || 'Failed to load reconciliation report', 'error')
        } finally {
            setLoading(false)
        }
    }

    const getVarianceStatus = (variance) => {
        const val = Number(variance)
        if (val > 0) return <Badge variant="success">Surplus (+{val.toFixed(2)})</Badge>
        if (val < 0) return <Badge variant="destructive">Shortage ({val.toFixed(2)})</Badge>
        return <Badge variant="default">No Variance</Badge>
    }

    const getStatusBadge = (status) => {
        const variant = {
            'Draft': 'default',
            'Submitted': 'warning',
            'Approved': 'info',
            'Closed': 'success'
        }[status] || 'default'
        return <Badge variant={variant}>{status}</Badge>
    }

    const columns = [
        { key: 'session_ref', header: 'Session Ref', width: '12%' },
        { key: 'store', header: 'Store', width: '12%' },
        { key: 'item', header: 'Item', width: '18%' },
        { key: 'bin', header: 'Bin', width: '10%' },
        { key: 'systemQty', header: 'System Qty', width: '10%', render: (row) => Number(row.systemQty).toFixed(2) },
        { key: 'physicalQty', header: 'Physical Qty', width: '10%', render: (row) => Number(row.physicalQty).toFixed(2) },
        {
            key: 'variance',
            header: 'Variance',
            width: '12%',
            render: (row) => getVarianceStatus(row.variance)
        },
        { key: 'reason', header: 'Reason', width: '16%', render: (row) => row.reason ? <span className="text-sm">{row.reason}</span> : '-' }
    ]

    const exportToCsv = () => {
        if (data.length === 0) {
            push('No data to export', 'info')
            return
        }

        const headers = columns.map(col => col.header)
        const rows = data.map(row =>
            columns.map(col => {
                const val = row[col.key]
                if (col.key === 'variance') return val
                if (col.key === 'systemQty' || col.key === 'physicalQty') return Number(val).toFixed(2)
                return val || ''
            })
        )

        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reconciliation_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
        push('Report exported successfully', 'success')
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Reconciliation Report</h1>
                    <p className="text-gray-600 text-sm mt-1">
                        All stock variances from completed stock-taking sessions
                    </p>
                </div>
                <button
                    onClick={exportToCsv}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            <div className="card p-6">
                <Table
                    columns={columns}
                    rows={data}
                    loading={loading}
                    emptyTitle="No variances found"
                    emptyMessage="All stock counts match system records."
                    rowKey="id"
                />
            </div>

            {/* Summary Statistics */}
            {data.length > 0 && (
                <Card className="p-4">
                    <h3 className="font-semibold mb-3">Summary</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Total Variances</p>
                            <p className="text-2xl font-bold">{data.length}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Surplus</p>
                            <p className="text-2xl font-bold text-green-600">
                                +{data.filter(item => Number(item.variance) > 0)
                                    .reduce((sum, item) => sum + Number(item.variance), 0)
                                    .toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Shortage</p>
                            <p className="text-2xl font-bold text-red-600">
                                {data.filter(item => Number(item.variance) < 0)
                                    .reduce((sum, item) => sum + Number(item.variance), 0)
                                    .toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Net Variance</p>
                            <p className="text-2xl font-bold">
                                {(data.reduce((sum, item) => sum + Number(item.variance), 0)).toFixed(2)}
                            </p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}
