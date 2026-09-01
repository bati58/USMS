import { useEffect, useMemo, useState } from 'react'
import { Send, Eye, Printer, AlertTriangle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import StatusBadge from '../../components/ui/StatusBadge'
import { issueVoucherService, requisitionService, itemService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { SIV_STATUS, REQUISITION_STATUS } from '../../utils/constants'
import { canPerformAction } from '../../utils/rolePermissions'

export default function IssueVoucherList() {
  const { push } = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [approvedReqs, setApprovedReqs] = useState([])
  const [itemsCatalog, setItemsCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSr, setSelectedSr] = useState('')
  const [viewing, setViewing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [amendLines, setAmendLines] = useState([])
  const canGenerate = canPerformAction(user?.role, 'create', 'issueVouchers')
  const canApprove = canPerformAction(user?.role, 'approve', 'issueVouchers')

  const selectedReq = useMemo(
    () => approvedReqs.find((r) => r.srRef === selectedSr) || null,
    [approvedReqs, selectedSr]
  )

  const selectedReqHasStockWarning = useMemo(
    () => (selectedReq ? amendLines.some((line) => Number(line.qtyIssued || 0) > Number(line.stockAvailable || 0)) : false),
    [selectedReq, amendLines]
  )

  async function load() {
    setLoading(true)
    try {
      const requests = [issueVoucherService.list(), canGenerate ? requisitionService.list() : Promise.resolve([]), canGenerate ? itemService.list() : Promise.resolve([])]
      const [vouchers, reqs, allItems] = await Promise.all(requests)
      setRows(vouchers)
      setApprovedReqs(reqs.filter((r) => r.status === REQUISITION_STATUS.APPROVED || r.status === REQUISITION_STATUS.PARTIALLY_APPROVED))
      setItemsCatalog(allItems)
    } catch (err) {
      push(err.message || 'Could not load issue vouchers.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (selectedSr) {
      const req = approvedReqs.find((r) => r.srRef === selectedSr)
      if (req) {
        setAmendLines(req.items.map(i => {
          const qtyApproved = Number(i.qtyApproved ?? i.qty)
          const stockAvailable = Number(itemsCatalog.find(c => c.name === i.item && c.store === req.store)?.qtyOnHand || 0)
          return {
            item: i.item,
            qtyApproved,
            qtyIssued: Math.min(qtyApproved, stockAvailable),
            stockAvailable
          }
        }))
      }
    } else {
      setAmendLines([])
    }
  }, [selectedSr, approvedReqs, itemsCatalog])

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter((r) => `${r.sivRef} ${r.issuedTo} ${r.srRef}`.toLowerCase().includes(q))
  }, [rows, query])

  function updateAmendLine(idx, val) {
    setAmendLines(prev => prev.map((l, i) => i === idx ? { ...l, qtyIssued: val } : l))
  }

  async function handleGenerate(e) {
    e.preventDefault()
    const req = selectedReq
    if (!req) return

    const invalidLines = amendLines.filter((line) => Number(line.qtyIssued || 0) > Number(line.stockAvailable || 0))
    if (invalidLines.length > 0) {
      const itemNames = invalidLines.map((line) => line.item).join(', ')
      push(`Not enough stock available to issue the selected quantity for: ${itemNames}. Reduce the issue quantity or update stock before creating the voucher.`, 'error')
      return
    }

    setSaving(true)
    try {
      const count = rows.length + 1
      const sivRef = `SIV-2026-${String(9 + count).padStart(4, '0')}`

      await issueVoucherService.create({ srRef: req.srRef })
      push(`Preliminary Model 22 Issue Voucher ${sivRef} created. Stock remains unchanged until posting.`, 'success')
      setModalOpen(false)
      setSelectedSr('')
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove(row) {
    try {
      await api.action('issueVouchers', row.id, 'approve', {})
      push(`${row.sivRef} approved and ready for posting.`, 'success')
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  async function handlePost(row) {
    try {
      const stockIssues = (row.items || []).map((line) => {
        const stockItem = itemsCatalog.find((item) => item.name === line.item)
        return {
          item: line.item,
          qtyRequested: Number(line.qty || 0),
          stockAvailable: Number(stockItem?.qtyOnHand || 0)
        }
      })

      const insufficient = stockIssues.filter((line) => line.qtyRequested > line.stockAvailable)
      if (insufficient.length > 0) {
        const names = insufficient.map((line) => `${line.item} (${line.qtyRequested} > ${line.stockAvailable})`).join(', ')
        push(`Cannot post ${row.sivRef}: insufficient stock for ${names}.`, 'error')
        return
      }

      await api.action('issueVouchers', row.id, 'post', {})
      push(`${row.sivRef} posted. Stock levels updated.`, 'success')
      await load()
    } catch (err) {
      push(err.message, 'error')
    }
  }

  const columns = [
    { key: 'sivRef', header: 'Voucher Ref' },
    { key: 'type', header: 'Type' },
    { key: 'srRef', header: 'From Requisition' },
    { key: 'issuedTo', header: 'Issued To' },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          {canApprove && [SIV_STATUS.PRELIMINARY, SIV_STATUS.PENDING_APPROVAL].includes(row.status) && <Button variant="secondary" onClick={() => handleApprove(row)}>Approve</Button>}
          {canGenerate && row.status === SIV_STATUS.APPROVED && <Button onClick={() => handlePost(row)}>Post</Button>}
          <button onClick={() => setViewing(row)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600">
            <Eye size={15} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div>
      <PageHeader
        title="Issue Vouchers"
        subtitle="Generate issue vouchers from approved requisitions and update stock automatically."
        actions={canGenerate ? <Button icon={Send} onClick={() => setModalOpen(true)}>Generate Voucher</Button> : null}
      />

      <div className="card p-5">
        <div className="mb-4">
          <SearchInput value={query} onChange={setQuery} placeholder="Search voucher ref..." />
        </div>
        <Table columns={columns} rows={filtered} loading={loading} emptyTitle="No issue vouchers yet" emptyMessage="Approve a requisition first, then generate its issue voucher here." />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Generate Issue Voucher (Model 22)"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} loading={saving} disabled={!selectedSr || selectedReqHasStockWarning}>
              Create Preliminary Voucher
            </Button>
          </>
        }
      >
        <form onSubmit={handleGenerate}>
          <Select
            label="Approved Requisition"
            required
            options={approvedReqs.map((r) => ({ value: r.srRef, label: `${r.srRef} — ${r.department} (${r.status})` }))}
            value={selectedSr}
            onChange={(e) => setSelectedSr(e.target.value)}
          />
          {!approvedReqs.length && (
            <p className="mt-2 text-xs text-ink-400">No approved requisitions are currently awaiting issue.</p>
          )}

          {selectedSr && amendLines.length > 0 && (
            <div className="mt-6 border-t border-ink-100 pt-4">
              <p className="mb-2 font-medium text-ink-700">Amend Quantities & Verify Stock</p>
              {selectedReqHasStockWarning && (
                <div className="mb-3 rounded border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                  One or more requested issue quantities exceed current stock availability. Reduce the quantities before creating the voucher.
                </div>
              )}
              <table className="w-full text-left text-sm">
                <thead className="text-ink-500 border-b border-ink-100">
                  <tr>
                    <th className="py-2">Item</th>
                    <th className="py-2">Approved Qty</th>
                    <th className="py-2">Stock Available</th>
                    <th className="py-2">Qty to Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {amendLines.map((l, i) => (
                    <tr key={i} className="border-b border-ink-50">
                      <td className="py-2 font-medium">{l.item}</td>
                      <td className="py-2">{l.qtyApproved}</td>
                      <td className="py-2">
                        <span className={l.stockAvailable < l.qtyApproved ? 'text-danger-600 font-semibold' : 'text-success-600'}>
                          {l.stockAvailable}
                        </span>
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          className={`w-24 rounded border px-2 py-1 text-sm focus:outline-none ${l.qtyIssued > l.stockAvailable ? 'border-danger-300 focus:border-danger-500 bg-danger-50' : 'border-ink-200 focus:border-brand-500'}`}
                          value={l.qtyIssued}
                          max={l.qtyApproved}
                          min={0}
                          onChange={(e) => updateAmendLine(i, e.target.value)}
                        />
                        {l.qtyIssued > l.stockAvailable && (
                          <AlertTriangle size={14} className="inline ml-2 text-danger-500" title="Exceeds available stock" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink-500">
                You can amend the issued quantity based on current stock availability.
              </p>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.sivRef}
        footer={
          <Button variant="secondary" icon={Printer} onClick={() => printIssueVoucher(viewing)}>
            Print Model 22
          </Button>
        }
      >
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" value={viewing.type} />
              <Field label="From Requisition" value={viewing.srRef} />
              <Field label="Issued To" value={viewing.issuedTo} />
              <Field label="Issued By" value={viewing.issuedBy} />
            </div>
            <div>
              <p className="mb-2 font-medium text-ink-700">Issued Items</p>
              <table className="w-full text-left text-sm border border-ink-100 rounded">
                <thead className="bg-ink-50 text-ink-600">
                  <tr>
                    <th className="p-2 font-medium">Item</th>
                    <th className="p-2 font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {viewing.items?.map((l, i) => (
                    <tr key={i}>
                      <td className="p-2">{l.item}</td>
                      <td className="p-2 font-medium">{l.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function printIssueVoucher(record) {
  if (!record) return

  const items = (record.items || []).map((item) => `
    <tr>
      <td>${item.item || '-'}</td>
      <td>${item.qty ?? '-'}</td>
      <td>${item.unitPrice ? formatCurrency(item.unitPrice) : '-'}</td>
    </tr>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${record.sivRef || 'Issue Voucher'}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 32px;
            color: #111827;
            background: #fff;
          }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
          .title { font-size: 30px; font-weight: 700; margin: 0; }
          .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
          .ref { text-align: right; }
          .ref-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
          .ref-value { font-size: 24px; font-weight: 700; color: #1d4ed8; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 22px; }
          .field { margin-bottom: 12px; }
          .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
          .value { font-size: 14px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; }
          .footer { margin-top: 30px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
          .signature { border-top: 1px solid #374151; padding-top: 8px; margin-top: 40px; font-size: 12px; }
          @page { size: A4; margin: 18mm; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Issue Voucher</h1>
            <div class="subtitle">Model 22 - Material Issue Register</div>
          </div>
          <div class="ref">
            <div class="ref-label">Voucher Ref</div>
            <div class="ref-value">${record.sivRef || '-'}</div>
          </div>
        </div>

        <div class="grid">
          <div>
            <div class="field"><div class="label">Type</div><div class="value">${record.type || 'SIV'}</div></div>
            <div class="field"><div class="label">Issued To</div><div class="value">${record.issuedTo || '-'}</div></div>
          </div>
          <div>
            <div class="field"><div class="label">From Requisition</div><div class="value">${record.srRef || '-'}</div></div>
            <div class="field"><div class="label">Issued By</div><div class="value">${record.issuedBy || '-'}</div></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit Price</th>
            </tr>
          </thead>
          <tbody>
            ${items || '<tr><td colspan="3">No items available</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          <div>
            <div class="label">Date</div>
            <div class="signature">${record.date ? new Date(record.date).toLocaleDateString() : '-'}</div>
          </div>
          <div>
            <div class="label">Status</div>
            <div class="signature">${record.status || 'Issued'}</div>
          </div>
          <div>
            <div class="label">Authorized By</div>
            <div class="signature">${record.issuedBy || 'System'}</div>
          </div>
        </div>
      </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-ink-500 mb-0.5">{label}</p>
      <p className="font-medium text-ink-900">{value ?? '-'}</p>
    </div>
  )
}
