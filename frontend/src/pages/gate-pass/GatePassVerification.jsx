import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Truck, LogOut } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import SearchInput from '../../components/ui/SearchInput'
import { goodsReceiptService, issueVoucherService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { GRN_STATUS } from '../../utils/constants'

export default function GatePassVerification() {
  const { push } = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState('incoming')
  const [grns, setGrns] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [g, v] = await Promise.all([goodsReceiptService.list(), issueVoucherService.list()])
      setGrns(g)
      setVouchers(v)
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
    await api.verifyGate(resource, row.id)
    push(`${label} verified at gate.`, 'success')
    await load()
  }

  const incomingRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return grns
      .filter((g) => ['Submitted', 'Pending Evaluation', 'Under Evaluation', 'Accepted', 'Partially Accepted', 'Rejected', GRN_STATUS.GRN_GENERATED, GRN_STATUS.POSTED].includes(g.status))
      .filter((g) => !q || `${g.grnRef} ${g.supplier} ${g.store}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.receivedDate || 0) - new Date(a.receivedDate || 0))
  }, [grns, query])

  const outgoingRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return vouchers
      .filter((voucher) => ['Approved', 'Posted'].includes(voucher.status))
      .filter((voucher) => !q || `${voucher.sivRef} ${voucher.issuedTo}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map((voucher) => ({
        ref: voucher.sivRef,
        type: 'Issue Voucher',
        party: voucher.issuedTo,
        date: voucher.date,
        gateVerified: voucher.gateVerified,
        gateVerifiedBy: voucher.gateVerifiedBy,
        gateVerifiedAt: voucher.gateVerifiedAt,
        resource: 'issue-vouchers',
        serviceId: voucher.id
      }))
  }, [vouchers, query])

  const pendingIncoming = incomingRows.filter((g) => !g.gateVerified).length
  const pendingOutgoing = outgoingRows.filter((row) => !row.gateVerified).length

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
        !row.gateVerified ? (
          <Button variant="secondary" icon={ShieldCheck} onClick={() => verifyRecord('goodsReceipts', row, row.grnRef)}>
            Verify Entry
          </Button>
        ) : (
          <span className="text-xs text-ink-400">{formatDate(row.gateVerifiedAt?.slice(0, 10))}</span>
        )
    }
  ]

  const outgoingColumns = [
    { key: 'ref', header: 'Reference' },
    { key: 'type', header: 'Document Type' },
    { key: 'party', header: 'Issued To / Route' },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    {
      key: 'gate',
      header: 'Gate Status',
      render: (r) =>
        r.gateVerified ? (
          <span className="text-xs font-medium text-success-700">Cleared · {r.gateVerifiedBy}</span>
        ) : (
          <span className="text-xs font-medium text-warning-700">Awaiting clearance</span>
        )
    },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) =>
        !row.gateVerified ? (
          <Button
            variant="secondary"
            icon={ShieldCheck}
            onClick={() => verifyRecord(row.resource, { id: row.serviceId }, row.ref)}
          >
            Clear Exit
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
        subtitle="Monitor and verify materials entering or leaving the organization's premises."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-50 text-warning-500">
              <LogOut size={20} />
            </div>
            <div>
              <p className="text-sm text-ink-500">Outgoing — pending clearance</p>
              <p className="text-2xl font-semibold text-ink-900">{pendingOutgoing}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('incoming')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'incoming' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 border border-ink-200 hover:bg-ink-50'}`}
        >
          Incoming Goods
        </button>
        <button
          type="button"
          onClick={() => setTab('outgoing')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'outgoing' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 border border-ink-200 hover:bg-ink-50'}`}
        >
          Outgoing Materials
        </button>
      </div>

      <div className="card p-5">
        <div className="mb-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tab === 'incoming' ? 'Search GRN, supplier, store...' : 'Search voucher, transfer, destination...'}
          />
        </div>

        {tab === 'incoming' ? (
          <Table
            columns={incomingColumns}
            rows={incomingRows}
            loading={loading}
            emptyTitle="No incoming deliveries"
            emptyMessage="Approved or pending goods receipts will appear here for gate verification."
          />
        ) : (
          <Table
            columns={outgoingColumns}
            rows={outgoingRows}
            loading={loading}
            emptyTitle="No outgoing movements"
            emptyMessage="Internal department issues and store transfers do not require campus gate clearance."
          />
        )}
      </div>
    </div>
  )
}
