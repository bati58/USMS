import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Truck } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import SearchInput from '../../components/ui/SearchInput'
import { goodsReceiptService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { GRN_STATUS } from '../../utils/constants'

export default function GatePassVerification() {
  const { push } = useToast()
  const { user } = useAuth()
  const canVerify = user?.role === 'Security Officer'
  const [grns, setGrns] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [actionBusy, setActionBusy] = useState('')
  const successToast = { duration: 2000 }

  async function load() {
    setLoading(true)
    try {
      const g = await goodsReceiptService.list()
      setGrns(g)
    } catch (err) {
      push(err.message || 'Could not load gate-pass records.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function verifyRecord(resource, row, label) {
    if (!canVerify || actionBusy) return
    setActionBusy(`${resource}-${row.id}`)
    try {
      await api.verifyGate(resource, row.id)
      push(`${label} gate verification recorded. The next workflow action may proceed.`, 'success', successToast)
      await load()
    } catch (err) {
      push(err.message || 'Could not record gate verification.', 'error')
    } finally {
      setActionBusy('')
    }
  }

  const incomingRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return grns
      .filter((g) => ['Submitted', 'Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected', GRN_STATUS.GRN_GENERATED, GRN_STATUS.POSTED].includes(g.status))
      .filter((g) => !q || `${g.grnRef} ${g.supplier} ${g.store}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.receivedDate || 0) - new Date(a.receivedDate || 0))
  }, [grns, query])

  const pendingIncoming = incomingRows.filter((g) => !g.gateVerified).length

  const incomingColumns = [
    { key: 'grnRef', header: 'GRN Ref' },
    { key: 'supplier', header: 'Supplier / Donor' },
    { key: 'store', header: 'Destination Store' },
    { key: 'receivedDate', header: 'Received', render: (r) => formatDate(r.receivedDate) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'gate',
      header: 'Gate Status',
      render: (r) =>
        r.gateVerified ? (
          <span className="text-xs font-medium text-success-700">Verified · {r.gateVerifiedBy}</span>
        ) : (
          <span className="text-xs font-medium text-warning-700">Awaiting verification</span>
        )
    },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) =>
        !canVerify ? (
          <span className="text-xs text-ink-400">Security verification only</span>
        ) : !row.gateVerified ? (
          <Button variant="secondary" icon={ShieldCheck} loading={actionBusy === `goodsReceipts-${row.id}`} disabled={Boolean(actionBusy)} onClick={() => verifyRecord('goodsReceipts', row, row.grnRef)}>
            Verify Entry
          </Button>
        ) : (
          <span className="text-xs text-ink-400">{formatDate(row.gateVerifiedAt?.slice(0, 10))}</span>
        )
    }
  ]

  return (
    <div>
      <PageHeader
        title="Gate Pass Verification"
        subtitle="Verify incoming materials at the campus gate before technical evaluation."
      />

      {!canVerify && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Read-only monitoring: only Security Officers can record gate verification.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50 text-success-500">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-sm text-ink-500">Incoming — pending verification</p>
              <p className="text-2xl font-semibold text-ink-900">{pendingIncoming}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="card p-5">
        <div className="mb-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search GRN, supplier, store..."
          />
        </div>

        <Table
          columns={incomingColumns}
          rows={incomingRows}
          loading={loading}
          emptyTitle="No incoming deliveries"
          emptyMessage="Approved or pending goods receipts will appear here for gate verification."
        />
      </div>
    </div>
  )
}
