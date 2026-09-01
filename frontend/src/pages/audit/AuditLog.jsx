import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, X } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Select from '../../components/ui/Select'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { auditLogService } from '../../services'
import { canPerformAction } from '../../utils/rolePermissions'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime } from '../../utils/formatters'
import { AUDIT_OUTCOME_COLOR } from '../../utils/constants'

const DEFAULT_FILTERS = {
  role: 'all',
  module: 'all',
  action: 'all',
  outcome: 'all',
  startDate: '',
  endDate: ''
}

function OutcomeBadge({ value }) {
  return <Badge className={AUDIT_OUTCOME_COLOR[value] || 'bg-ink-100 text-ink-600'}>{value || 'SUCCESS'}</Badge>
}

export default function AuditLog() {
  const { user } = useAuth()
  const canExport = canPerformAction(user?.role, 'exportAuditLog')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedRow, setSelectedRow] = useState(null)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    auditLogService.list().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  const moduleOptions = useMemo(() => {
    const uniqueModules = [...new Set(rows.map((row) => row.module).filter(Boolean))]
    return [{ value: 'all', label: 'All Modules' }, ...uniqueModules.map((module) => ({ value: module, label: module }))]
  }, [rows])

  const actionOptions = useMemo(() => {
    const uniqueActions = [...new Set(rows.map((row) => row.action).filter(Boolean))]
    return [{ value: 'all', label: 'All Actions' }, ...uniqueActions.map((action) => ({ value: action, label: action }))]
  }, [rows])

  const roleOptions = useMemo(() => {
    const uniqueRoles = [...new Set(rows.map((row) => row.actorRole).filter(Boolean))]
    return [{ value: 'all', label: 'All Roles' }, ...uniqueRoles.map((role) => ({ value: role, label: role }))]
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const start = filters.startDate ? new Date(filters.startDate) : null
    const end = filters.endDate ? new Date(filters.endDate) : null
    if (end) end.setHours(23, 59, 59, 999)

    return [...rows]
      .filter((row) => {
        const searchText = [row.actorName, row.actorRole, row.action, row.module, row.entityId, row.entityReference, row.description, row.metadata?.department, row.metadata?.store]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        const matchesSearch = !q || searchText.includes(q)
        const matchesRole = filters.role === 'all' || row.actorRole === filters.role
        const matchesModule = filters.module === 'all' || row.module === filters.module
        const matchesAction = filters.action === 'all' || row.action === filters.action
        const matchesOutcome = filters.outcome === 'all' || row.outcome === filters.outcome
        const matchesStart = !start || new Date(row.timestamp) >= start
        const matchesEnd = !end || new Date(row.timestamp) <= end

        return matchesSearch && matchesRole && matchesModule && matchesAction && matchesOutcome && matchesStart && matchesEnd
      })
      .sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime()
        const bTime = new Date(b.timestamp).getTime()
        switch (sortBy) {
          case 'oldest':
            return aTime - bTime
          case 'user':
            return (a.actorName || '').localeCompare(b.actorName || '') || aTime - bTime
          case 'action':
            return (a.action || '').localeCompare(b.action || '') || aTime - bTime
          case 'module':
            return (a.module || '').localeCompare(b.module || '') || aTime - bTime
          case 'outcome':
            return (a.outcome || '').localeCompare(b.outcome || '') || aTime - bTime
          case 'newest':
          default:
            return bTime - aTime
        }
      })
  }, [rows, query, filters, sortBy])

  const summary = useMemo(() => {
    const total = filtered.length
    const today = filtered.filter((row) => {
      const rowDate = new Date(row.timestamp)
      const now = new Date()
      return rowDate.toDateString() === now.toDateString()
    }).length
    const successful = filtered.filter((row) => row.outcome === 'SUCCESS').length
    const failed = filtered.filter((row) => row.outcome === 'FAILED').length
    const critical = filtered.filter((row) => ['GOODS_RECEIPT_ACCEPTED', 'GRN_GENERATED', 'REQUISITION_APPROVED', 'SIV_ISSUED', 'DISPOSAL_EXECUTED', 'SYSTEM_SETTING_CHANGED'].includes(row.action)).length
    return { total, today, successful, failed, critical }
  }, [filtered])

  const columns = [
    { key: 'timestamp', header: 'Timestamp', render: (row) => formatDateTime(row.timestamp) },
    { key: 'actorName', header: 'User' },
    { key: 'actorRole', header: 'Role' },
    { key: 'action', header: 'Action' },
    { key: 'module', header: 'Module' },
    { key: 'entityReference', header: 'Entity / Reference' },
    { key: 'description', header: 'Description' },
    { key: 'outcome', header: 'Outcome', render: (row) => <OutcomeBadge value={row.outcome} /> },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <button onClick={() => setSelectedRow(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600" title="View details">
          <Eye size={15} />
        </button>
      )
    }
  ]

  function handleExport() {
    if (!canExport) return
    if (!filtered.length) return
    auditLogService.exportCsv(filtered)
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Operational audit trail for inventory movements, approvals, user actions, and security events."
        actions={
          canExport ? (
            <Button icon={Download} variant="secondary" onClick={handleExport} disabled={!filtered.length}>
              Export CSV
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Total Events">
          <p className="text-2xl font-semibold text-ink-900">{summary.total}</p>
        </Card>
        <Card title="Today's Events">
          <p className="text-2xl font-semibold text-ink-900">{summary.today}</p>
        </Card>
        <Card title="Successful Actions">
          <p className="text-2xl font-semibold text-success-700">{summary.successful}</p>
        </Card>
        <Card title="Failed Actions">
          <p className="text-2xl font-semibold text-danger-700">{summary.failed}</p>
        </Card>
        <Card title="Critical Actions">
          <p className="text-2xl font-semibold text-warning-700">{summary.critical}</p>
        </Card>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="md:col-span-2 lg:col-span-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search user, action, module, ref..." />
          </div>
          <Select label="Sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'user', label: 'User' }, { value: 'action', label: 'Action' }, { value: 'module', label: 'Module' }, { value: 'outcome', label: 'Outcome' }]} />
          <Select label="Role" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))} options={roleOptions} />
          <Select label="Module" value={filters.module} onChange={(e) => setFilters((prev) => ({ ...prev, module: e.target.value }))} options={moduleOptions} />
          <Select label="Outcome" value={filters.outcome} onChange={(e) => setFilters((prev) => ({ ...prev, outcome: e.target.value }))} options={[{ value: 'all', label: 'All Outcomes' }, { value: 'SUCCESS', label: 'SUCCESS' }, { value: 'FAILED', label: 'FAILED' }, { value: 'WARNING', label: 'WARNING' }]} />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label">From date</label>
            <input
              type="date"
              className="input"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">To date</label>
            <input
              type="date"
              className="input"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Action</label>
            <Select value={filters.action} onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))} options={actionOptions} />
          </div>
        </div>

        <Table
          columns={columns}
          rows={filtered}
          loading={loading}
          emptyTitle="No audit events found"
          emptyMessage="Audit records will appear here as operational activity is performed in the system."
          pageSize={8}
        />
      </div>

      <Modal open={Boolean(selectedRow)} onClose={() => setSelectedRow(null)} title="Audit Event" size="lg">
        {selectedRow && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><p className="text-xs uppercase text-ink-400">Timestamp</p><p className="mt-1 font-medium text-ink-900">{formatDateTime(selectedRow.timestamp)}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Outcome</p><p className="mt-1"><OutcomeBadge value={selectedRow.outcome} /></p></div>
              <div><p className="text-xs uppercase text-ink-400">Actor</p><p className="mt-1 font-medium text-ink-900">{selectedRow.actorName}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Role</p><p className="mt-1 font-medium text-ink-900">{selectedRow.actorRole}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Action</p><p className="mt-1 font-medium text-ink-900">{selectedRow.action}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Module</p><p className="mt-1 font-medium text-ink-900">{selectedRow.module}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Entity</p><p className="mt-1 font-medium text-ink-900">{selectedRow.entityType}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Reference</p><p className="mt-1 font-medium text-ink-900">{selectedRow.entityReference}</p></div>
            </div>

            <div>
              <p className="text-xs uppercase text-ink-400">Description</p>
              <p className="mt-2 text-ink-700">{selectedRow.description}</p>
            </div>

            {selectedRow.changes?.length ? (
              <div>
                <p className="mb-2 text-xs uppercase text-ink-400">Changes</p>
                <div className="overflow-x-auto rounded-lg border border-ink-100">
                  <table className="min-w-full text-sm">
                    <thead className="bg-ink-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-ink-700">Field</th>
                        <th className="px-3 py-2 text-left font-medium text-ink-700">Previous value</th>
                        <th className="px-3 py-2 text-left font-medium text-ink-700">New value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRow.changes.map((change, index) => (
                        <tr key={`${change.field}-${index}`} className="border-t border-ink-100">
                          <td className="px-3 py-2 font-medium text-ink-700">{change.field}</td>
                          <td className="px-3 py-2 text-ink-600">{JSON.stringify(change.oldValue ?? '')}</td>
                          <td className="px-3 py-2 text-ink-600">{JSON.stringify(change.newValue ?? '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><p className="text-xs uppercase text-ink-400">IP Address</p><p className="mt-1 font-medium text-ink-900">{selectedRow.ipAddress || 'N/A'}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Device / Browser</p><p className="mt-1 font-medium text-ink-900">{selectedRow.userAgent || 'Frontend (Browser)'}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Store</p><p className="mt-1 font-medium text-ink-900">{selectedRow.metadata?.store || 'N/A'}</p></div>
              <div><p className="text-xs uppercase text-ink-400">Department</p><p className="mt-1 font-medium text-ink-900">{selectedRow.metadata?.department || 'N/A'}</p></div>
            </div>

            <div>
              <button onClick={() => setShowRaw((prev) => !prev)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                {showRaw ? 'Hide raw details' : 'View raw details'}
              </button>
              {showRaw && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
                  {JSON.stringify(selectedRow, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
