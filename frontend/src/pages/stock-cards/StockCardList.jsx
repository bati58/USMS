import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { itemService, stockTransactionService } from '../../services'
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters'

export default function StockCardList() {
  const [items, setItems] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    Promise.all([itemService.list(), stockTransactionService.list()]).then(([i, t]) => {
      setItems(i)
      setTransactions(t)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((i) => `${i.code} ${i.name}`.toLowerCase().includes(q))
  }, [items, query])

  const ledger = useMemo(() => {
    if (!viewing) return []
    return transactions.filter((t) => t.item === viewing.name)
  }, [viewing, transactions])

  const columns = [
    { key: 'code', header: 'Item Code' },
    { key: 'name', header: 'Item Name' },
    { key: 'store', header: 'Store' },
    { key: 'unit', header: 'Unit' },
    { key: 'qtyOnHand', header: 'Balance on Hand', render: (r) => formatNumber(r.qtyOnHand) },
    { key: 'unitPrice', header: 'Latest Unit Price', render: (r) => formatCurrency(r.unitPrice) },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <Button variant="secondary" icon={Eye} onClick={() => setViewing(row)}>
          View Card
        </Button>
      )
    }
  ]

  return (
    <div>
      <PageHeader
        title="Stock Cards"
        subtitle="Auto-updated cost and quantity ledger for every item, valued using FIFO."
      />

      <div className="card p-5">
        <div className="mb-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search item code or name..." />
        </div>
        <Table columns={columns} rows={filtered} loading={loading} emptyTitle="No items yet" emptyMessage="Add items to see their stock cards." />
      </div>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing ? `Stock Card — ${viewing.name}` : ''} size="xl">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Field label="Item Code" value={viewing.code} />
              <Field label="Store" value={viewing.store} />
              <Field label="Bin" value={viewing.bin} />
              <Field label="Balance" value={`${formatNumber(viewing.qtyOnHand)} ${viewing.unit}`} />
            </div>
            <div className="overflow-x-auto rounded-lg border border-ink-100">
              <table className="min-w-full divide-y divide-ink-100 text-sm">
                <thead className="bg-ink-50 text-ink-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-right">Qty In</th>
                    <th className="px-3 py-2 text-right">Qty Out</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-ink-400">
                        No transactions recorded for this item yet.
                      </td>
                    </tr>
                  )}
                  {ledger.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2">{formatDate(t.date)}</td>
                      <td className="px-3 py-2">{t.type}</td>
                      <td className="px-3 py-2">{t.ref}</td>
                      <td className="px-3 py-2 text-right">{t.qtyIn || '-'}</td>
                      <td className="px-3 py-2 text-right">{t.qtyOut || '-'}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(t.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatNumber(t.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-400">
              Valuation method: First-In-First-Out, applied consistently across the stock ledger.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="font-medium text-ink-800">{value ?? '-'}</p>
    </div>
  )
}
