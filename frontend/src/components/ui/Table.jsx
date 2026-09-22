import { useEffect, useMemo, useState } from 'react'
import Loader from './Loader'
import EmptyState from './EmptyState'
import Pagination from './Pagination'

// Generic, config-driven data table.
// columns: [{ key, header, render?(row), className? }]
export default function Table({ columns, rows = [], loading, emptyTitle, emptyMessage, pageSize = 8, rowKey = 'id' }) {
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [rows, pageSize])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, page, pageSize])

  if (loading) return <Loader />
  if (!rows.length) return <EmptyState title={emptyTitle} message={emptyMessage} />

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]">
        <table className="min-w-full divide-y divide-[var(--border-subtle)] text-sm">
          <thead className="bg-[var(--surface-strong)]">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`whitespace-nowrap px-3 py-3 text-left font-semibold text-[var(--text-secondary)] sm:px-6 sm:py-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface)]">
            {paged.map((row, idx) => {
              const rowClassName = idx % 2 === 0
                ? 'bg-transparent hover:bg-[var(--surface-subtle)]'
                : 'bg-[var(--surface-subtle)] hover:bg-[var(--surface-contrast)]'

              return (
                <tr key={row[rowKey]} className={`transition-colors ${rowClassName}`}>
                  {columns.map((col) => (
                    <td key={col.key} className={`whitespace-nowrap px-3 py-3 text-[var(--text-primary)] sm:px-6 sm:py-4 ${col.className || ''}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={rows.length} onPageChange={setPage} />
    </div>
  )
}
