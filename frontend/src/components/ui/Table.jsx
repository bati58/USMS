import { useMemo, useState } from 'react'
import Loader from './Loader'
import EmptyState from './EmptyState'
import Pagination from './Pagination'

// Generic, config-driven data table.
// columns: [{ key, header, render?(row), className? }]
export default function Table({ columns, rows = [], loading, emptyTitle, emptyMessage, pageSize = 8, rowKey = 'id' }) {
  const [page, setPage] = useState(1)

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page, pageSize])

  if (loading) return <Loader />
  if (!rows.length) return <EmptyState title={emptyTitle} message={emptyMessage} />

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-ink-100">
        <table className="min-w-full divide-y divide-ink-100 text-sm">
          <thead className="bg-gradient-to-r from-brand-50 via-white to-info-50/40">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`whitespace-nowrap px-3 py-3 text-left font-semibold text-ink-700 sm:px-6 sm:py-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 bg-white">
            {paged.map((row, idx) => (
              <tr
                key={row[rowKey]}
                className={`transition-colors ${idx % 2 === 0 ? 'hover:bg-brand-50/60' : 'bg-ink-50/30 hover:bg-brand-50/60'
                  }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`whitespace-nowrap px-3 py-3 text-ink-700 sm:px-6 sm:py-4 ${col.className || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={rows.length} onPageChange={setPage} />
    </div>
  )
}
