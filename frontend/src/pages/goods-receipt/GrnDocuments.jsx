import { useEffect, useState } from 'react'
import { FileText, Printer, Download, Eye } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import { goodsReceiptService } from '../../services'
import { useToast } from '../../context/ToastContext'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { GRN_STATUS } from '../../utils/constants'

export default function GrnDocuments() {
    const { push } = useToast()
    const [grns, setGrns] = useState([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [viewing, setViewing] = useState(null)

    async function load() {
        setLoading(true)
        try {
            const data = await goodsReceiptService.list()
            // Keep posted receipts in the document history. Posting changes the
            // receipt status from GRN Generated to Posted.
            setGrns(data.filter((g) => [GRN_STATUS.GRN_GENERATED, GRN_STATUS.POSTED].includes(g.status)))
        } catch (error) {
            push(error.message || 'Could not load GRN documents.', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const filtered = grns.filter((g) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return `${g.grnRef} ${g.supplier} ${g.store}`.toLowerCase().includes(q)
    })

    function handlePrint(grn) {
        const printWindow = window.open('', '', 'height=600,width=800')
        const htmlContent = renderPrintableGRN(grn)
        printWindow.document.write(htmlContent)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => printWindow.print(), 250)
    }

    function handleDownloadPDF(grn) {
        handlePrint(grn)
        push('The print dialog can save this GRN as a PDF.', 'info')
    }

    const columns = [
        { key: 'grnRef', header: 'GRN Reference' },
        { key: 'supplier', header: 'Supplier / Donor' },
        { key: 'poRef', header: 'PO / Donation Ref' },
        { key: 'store', header: 'Receiving Store' },
        { key: 'receivedDate', header: 'Received Date', render: (r) => formatDate(r.receivedDate) },
        {
            key: 'itemCount',
            header: 'Items',
            render: (r) => `${r.items?.length || 0} line(s)`
        },
        {
            key: '__actions',
            header: 'Actions',
            className: 'text-right',
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <button
                        onClick={() => setViewing(row)}
                        className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-600 transition-colors"
                        title="View Document"
                    >
                        <Eye size={15} />
                    </button>
                    <button
                        onClick={() => handlePrint(row)}
                        className="rounded-md p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                        title="Print"
                    >
                        <Printer size={15} />
                    </button>
                </div>
            )
        }
    ]

    return (
        <div>
            <PageHeader
                title="GRN Documents"
                subtitle="View, print, and download official Goods Received Notes that have been generated."
            />

            <div className="card p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <SearchInput
                        value={query}
                        onChange={setQuery}
                        placeholder="Search GRN reference, supplier, store..."
                    />
                </div>
                <Table
                    columns={columns}
                    rows={filtered}
                    loading={loading}
                    emptyTitle="No GRN documents generated"
                    emptyMessage="GRN documents appear here after materials have been received, evaluated, and approved."
                />
            </div>

            {/* View GRN Document Modal */}
            <Modal
                open={Boolean(viewing)}
                onClose={() => setViewing(null)}
                title={viewing?.grnRef}
                size="xl"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setViewing(null)}>
                            Close
                        </Button>
                        <Button icon={Printer} onClick={() => handlePrint(viewing)}>
                            Print
                        </Button>
                        <Button icon={Download} variant="secondary" onClick={() => handleDownloadPDF(viewing)}>
                            Download PDF
                        </Button>
                    </>
                }
            >
                {viewing && (
                    <div className="bg-white p-6 rounded-lg print:p-0 print:bg-transparent">
                        <GrnPrintView grn={viewing} />
                    </div>
                )}
            </Modal>
        </div>
    )
}

// Printable GRN Document Component
function GrnPrintView({ grn }) {
    const itemTotal = (grn.items || []).reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitPrice)), 0)

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="border-b border-ink-200 pb-4 mb-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-ink-900">GOODS RECEIVED NOTE</h1>
                        <p className="text-sm text-ink-500">Model 19 - Official Receipt Document</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold text-ink-700">GRN Reference</p>
                        <p className="text-xl font-bold text-brand-600">{grn.grnRef}</p>
                    </div>
                </div>
            </div>

            {/* Receipt Details */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">From</p>
                    <div className="space-y-2 text-sm">
                        <p className="font-semibold text-ink-900">{grn.supplier}</p>
                        <p className="text-ink-600">PO / Donation Ref: <span className="font-medium">{grn.poRef}</span></p>
                        <p className="text-ink-600">Supporting Doc: <span className="font-medium">{grn.docRef || 'N/A'}</span></p>
                    </div>
                </div>
                <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">To</p>
                    <div className="space-y-2 text-sm">
                        <p className="font-semibold text-ink-900">{grn.store}</p>
                        <p className="text-ink-600">Received By: <span className="font-medium">{grn.receivedBy}</span></p>
                        <p className="text-ink-600">Date: <span className="font-medium">{formatDate(grn.receivedDate)}</span></p>
                    </div>
                </div>
            </div>

            {/* Material Details */}
            <div className="mb-6">
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                        <p className="text-xs text-ink-500 mb-1">Material Type</p>
                        <p className="font-medium text-ink-900">{grn.type || 'Consumable'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-ink-500 mb-1">Condition on Arrival</p>
                        <p className="font-medium text-ink-900">{grn.condition || 'Good'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-ink-500 mb-1">Status</p>
                        <p className="font-medium text-success-700">Accepted & Generated</p>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-6">
                <p className="text-sm font-semibold text-ink-700 mb-3">Items Received</p>
                <table className="w-full border-collapse border border-ink-200">
                    <thead className="bg-ink-50">
                        <tr>
                            <th className="border border-ink-200 px-3 py-2 text-left text-sm font-semibold text-ink-700">Item Description</th>
                            <th className="border border-ink-200 px-3 py-2 text-center text-sm font-semibold text-ink-700 w-20">Quantity</th>
                            <th className="border border-ink-200 px-3 py-2 text-right text-sm font-semibold text-ink-700 w-28">Unit Price</th>
                            <th className="border border-ink-200 px-3 py-2 text-right text-sm font-semibold text-ink-700 w-32">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {grn.items?.map((item, idx) => (
                            <tr key={idx}>
                                <td className="border border-ink-200 px-3 py-2 text-sm text-ink-900">{item.item}</td>
                                <td className="border border-ink-200 px-3 py-2 text-center text-sm text-ink-900">{item.qty}</td>
                                <td className="border border-ink-200 px-3 py-2 text-right text-sm text-ink-900">{formatCurrency(item.unitPrice)}</td>
                                <td className="border border-ink-200 px-3 py-2 text-right text-sm font-medium text-ink-900">
                                    {formatCurrency(item.qty * item.unitPrice)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Total */}
            <div className="flex justify-end mb-6">
                <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm border-b border-ink-200 pb-2">
                        <span className="text-ink-600">Subtotal:</span>
                        <span className="font-medium text-ink-900">{formatCurrency(itemTotal)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                        <span className="text-ink-900">Total Value:</span>
                        <span className="text-brand-600">{formatCurrency(itemTotal)}</span>
                    </div>
                </div>
            </div>

            {/* Evaluation Details */}
            {grn.evaluationNote && (
                <div className="bg-success-50 border border-success-200 rounded-lg p-4 mb-6">
                    <p className="text-xs font-semibold text-success-700 uppercase tracking-wide mb-2">Technical Evaluation</p>
                    <p className="text-sm text-success-900 mb-2">{grn.evaluationNote}</p>
                    <p className="text-xs text-success-700">Evaluated by: {grn.evaluatedBy}</p>
                </div>
            )}

            {/* Footer / Signature Area */}
            <div className="border-t border-ink-200 pt-4 grid grid-cols-3 gap-6 text-sm">
                <div>
                    <p className="text-xs text-ink-500 mb-6">Received By</p>
                    <p className="border-t border-ink-400 pt-2 text-center text-ink-600">
                        {grn.receivedBy}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-ink-500 mb-6">Evaluated By</p>
                    <p className="border-t border-ink-400 pt-2 text-center text-ink-600">
                        {grn.evaluatedBy || 'Technical Evaluation Committee'}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-ink-500 mb-6">Date Generated</p>
                    <p className="border-t border-ink-400 pt-2 text-center text-ink-600">
                        {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>

            {/* Document Info */}
            <div className="mt-6 pt-4 border-t border-ink-200 text-xs text-ink-500 text-center">
                <p>This is an officially generated goods received note.</p>
                <p>Document Reference: {grn.grnRef} | Generated: {new Date().toLocaleString()}</p>
            </div>
        </div>
    )
}

// Helper for printing
function renderPrintableGRN(grn) {
    const itemTotal = (grn.items || []).reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitPrice)), 0)

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${grn.grnRef}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; }
        .subtitle { font-size: 12px; color: #666; }
        .ref-box { float: right; text-align: right; }
        .ref-label { font-size: 12px; color: #666; }
        .ref-value { font-size: 20px; font-weight: bold; color: #2563eb; }
        .clearfix { clear: both; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 20px 0; }
        .section-title { font-size: 12px; font-weight: bold; color: #666; text-transform: uppercase; margin-bottom: 10px; }
        .details { font-size: 13px; }
        .details p { margin: 5px 0; }
        .bold { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #f0f0f0; border: 1px solid #ccc; padding: 10px; text-align: left; font-weight: bold; }
        td { border: 1px solid #ccc; padding: 10px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .total-box { width: 300px; margin-left: auto; margin-top: 20px; }
        .total-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .eval-box { background-color: #ecfdf5; border: 1px solid #86efac; padding: 15px; margin: 20px 0; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; text-align: center; }
        .sig-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="ref-box">
          <div class="ref-label">GRN Reference</div>
          <div class="ref-value">${grn.grnRef}</div>
        </div>
        <div class="title">GOODS RECEIVED NOTE</div>
        <div class="subtitle">Model 19 - Official Receipt Document</div>
        <div class="clearfix"></div>
      </div>

      <div class="grid">
        <div>
          <div class="section-title">From</div>
          <div class="details">
            <p class="bold">${grn.supplier}</p>
            <p>PO / Donation Ref: <span class="bold">${grn.poRef}</span></p>
            <p>Supporting Doc: <span class="bold">${grn.docRef || 'N/A'}</span></p>
          </div>
        </div>
        <div>
          <div class="section-title">To</div>
          <div class="details">
            <p class="bold">${grn.store}</p>
            <p>Received By: <span class="bold">${grn.receivedBy}</span></p>
            <p>Date: <span class="bold">${formatDate(grn.receivedDate)}</span></p>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item Description</th>
            <th class="text-center" width="100">Quantity</th>
            <th class="text-right" width="120">Unit Price</th>
            <th class="text-right" width="150">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(grn.items || []).map((item) => `
            <tr>
              <td>${item.item}</td>
              <td class="text-center">${item.qty}</td>
              <td class="text-right">${formatCurrency(item.unitPrice)}</td>
              <td class="text-right"><strong>${formatCurrency(item.qty * item.unitPrice)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="total-box">
        <div class="total-row">
          <span>Total Value:</span>
          <strong>${formatCurrency(itemTotal)}</strong>
        </div>
      </div>

      ${grn.evaluationNote ? `
        <div class="eval-box">
          <div class="section-title">Technical Evaluation</div>
          <p>${grn.evaluationNote}</p>
          <p style="margin-top: 10px;">Evaluated by: ${grn.evaluatedBy}</p>
        </div>
      ` : ''}

      <div class="signatures">
        <div>
          <div class="section-title">Received By</div>
          <div class="sig-line">${grn.receivedBy}</div>
        </div>
        <div>
          <div class="section-title">Evaluated By</div>
          <div class="sig-line">${grn.evaluatedBy || 'TEC'}</div>
        </div>
        <div>
          <div class="section-title">Date Generated</div>
          <div class="sig-line">${new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #999;">
        <p>Document Reference: ${grn.grnRef} | Generated: ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `
}
