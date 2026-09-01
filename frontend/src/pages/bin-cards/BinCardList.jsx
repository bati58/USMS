import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { binCardService } from '../../services'
import { formatDate, formatNumber } from '../../utils/formatters'

export default function BinCardList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState(null)
  const [movements, setMovements] = useState([])
  const [movementLoading, setMovementLoading] = useState(false)

  useEffect(() => {
    binCardService.list().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter((r) => `${r.bin} ${r.store} ${r.item}`.toLowerCase().includes(q))
  }, [rows, query])

  async function viewMovements(row) {
    setViewing(row)
    setMovementLoading(true)
    try {
      setMovements(await binCardService.movements(row.id))
    } finally {
      setMovementLoading(false)
    }
  }

  const columns = [
    { key: 'bin', header: 'Bin', render: (r) => <Badge className="bg-brand-50 text-brand-700">{r.bin}</Badge> },
    { key: 'store', header: 'Store' },
    { key: 'item', header: 'Item Stored' },
    { key: 'lastMovement', header: 'Last Movement', render: (r) => formatDate(r.lastMovement) },
    { key: 'balance', header: 'Quantity on Hand', render: (r) => formatNumber(r.balance) },
    { key: '__actions', header: 'Actions', className: 'text-right', render: (row) => <Button variant="secondary" icon={Eye} onClick={() => viewMovements(row)}>History</Button> }
  ]

  return (
    <div>
      <PageHeader
        title="Bin Cards"
        subtitle="Auto-generated per bin and location, recording inbound and outbound movement with the running balance."
      />
      <div className="card p-5">
        <div className="mb-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search bin, store or item..." />
        </div>
        <Table columns={columns} rows={filtered} loading={loading} emptyTitle="No bin cards yet" emptyMessage="Bin cards appear automatically once an item is assigned to a bin." />
      </div>
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing ? `${viewing.bin} Movement History` : ''} size="xl">
        {viewing && (
          <Table
            columns={[
              { key: 'movement_date', header: 'Date', render: (row) => formatDate(row.movement_date) },
              { key: 'reference', header: 'Reference' },
              { key: 'type', header: 'Type' },
              { key: 'qty_in', header: 'In', render: (row) => formatNumber(row.qty_in) },
              { key: 'qty_out', header: 'Out', render: (row) => formatNumber(row.qty_out) },
              { key: 'balance', header: 'Balance', render: (row) => formatNumber(row.balance) },
              { key: 'actor_name', header: 'Actor' }
            ]}
            rows={movements}
            loading={movementLoading}
            emptyTitle="No movement history"
            emptyMessage="This bin has no recorded movements yet."
          />
        )}
      </Modal>
    </div>
  )
}
