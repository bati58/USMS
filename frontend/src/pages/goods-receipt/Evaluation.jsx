import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Search } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Textarea from '../../components/ui/Textarea'
import Input from '../../components/ui/Input'
import StatusBadge from '../../components/ui/StatusBadge'
import { goodsReceiptService } from '../../services'
import { api } from '../../services/apiClient'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatters'
import { GRN_STATUS } from '../../utils/constants'

export default function Evaluation() {
  const { push } = useToast()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [acceptedQuantities, setAcceptedQuantities] = useState([])

  async function load() {
    setLoading(true)
    try {
      const grns = await goodsReceiptService.list()
      setRows(grns.filter((g) => g.status === GRN_STATUS.PENDING_EVAL || g.status === GRN_STATUS.UNDER_EVAL))
    } catch (err) {
      push(err.message || 'Could not load evaluations.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function startReview(row) {
    setTarget(row)
    setNote(row.evaluationNote || '')
    setAcceptedQuantities((row.items || []).map((line) => ({ item: line.item, qtyAccepted: line.qty })))

    if (row.status === GRN_STATUS.PENDING_EVAL) {
      try {
        await api.action('goodsReceipts', row.id, 'status', { status: GRN_STATUS.UNDER_EVAL })
        setTarget((current) => current ? { ...current, status: GRN_STATUS.UNDER_EVAL } : current)
      } catch (err) {
        setTarget(null)
        push(err.message || 'Could not start the evaluation.', 'error')
      }
    }
  }

  async function decide(decision) {
    if (!note.trim()) {
      push('Evaluation findings or a decision note is required.', 'error')
      return
    }
    if (decision !== GRN_STATUS.REJECTED && acceptedQuantities.every((line) => Number(line.qtyAccepted) <= 0)) {
      push('Accept at least one positive quantity or reject the receipt.', 'error')
      return
    }
    setSaving(true)
    try {
      await api.action('goodsReceipts', target.id, 'evaluate', {
        decision: decision === GRN_STATUS.ACCEPTED ? 'Approved' : decision === GRN_STATUS.PARTIALLY_ACCEPTED ? 'Partially Approved' : 'Rejected',
        items: acceptedQuantities,
        evaluationNote: note || (decision === GRN_STATUS.ACCEPTED ? 'Inspected and accepted.' : 'Rejected - does not meet specification.')
      })
      push(
        decision === GRN_STATUS.ACCEPTED
          ? 'Materials accepted. Store head notified to generate the official receipt.'
          : 'Materials rejected. Store head notified to arrange return to supplier.',
        decision === GRN_STATUS.ACCEPTED ? 'success' : 'warning'
      )
      setTarget(null)
      await load()
    } catch (err) {
      push(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'grnRef', header: 'GRN Ref' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'store', header: 'Store' },
    { key: 'type', header: 'Material Type' },
    { key: 'receivedDate', header: 'Received', render: (r) => formatDate(r.receivedDate) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: '__actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <Button variant="secondary" onClick={() => startReview(row)} icon={Search}>
          Review
        </Button>
      )
    }
  ]

  return (
    <div>
      <PageHeader
        title="Technical Evaluation"
        subtitle="Inspect materials awaiting evaluation and record an approve or reject decision."
      />

      <div className="card p-5">
        <Table
          columns={columns}
          rows={rows}
          loading={loading}
          emptyTitle="Nothing pending evaluation"
          emptyMessage="All received materials have been evaluated."
        />
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target ? `Evaluate ${target.grnRef}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" icon={XCircle} loading={saving} onClick={() => decide(GRN_STATUS.REJECTED)}>
              Reject (Return to Supplier)
            </Button>
            <Button variant="secondary" loading={saving} onClick={() => decide(GRN_STATUS.PARTIALLY_ACCEPTED)}>
              Partially Accept
            </Button>
            <Button icon={CheckCircle2} loading={saving} onClick={() => decide(GRN_STATUS.ACCEPTED)}>
              Accept Materials
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-ink-500 mb-0.5">Supplier</p>
                <p className="font-medium text-ink-900">{target.supplier}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 mb-0.5">Store</p>
                <p className="font-medium text-ink-900">{target.store}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 mb-0.5">Condition on Arrival</p>
                <p className="font-medium text-ink-900">{target.condition || 'N/A'}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 font-medium text-ink-700">Items to Inspect</p>
              <table className="w-full text-left text-sm">
                <thead className="text-ink-500 border-b border-ink-100">
                  <tr>
                    <th className="py-2">Item</th>
                    <th className="py-2">Received Qty</th>
                    <th className="py-2">Accepted Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {target.items?.map((l, i) => (
                    <tr key={i} className="border-b border-ink-50">
                      <td className="py-2">{l.item}</td>
                      <td className="py-2">{l.qty}</td>
                      <td className="py-2">
                        <Input
                          type="number"
                          min="0"
                          max={l.qty}
                          value={acceptedQuantities[i]?.qtyAccepted ?? l.qty}
                          onChange={(e) => setAcceptedQuantities((prev) => prev.map((line, index) => index === i ? { ...line, qtyAccepted: e.target.value } : line))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Textarea
              label="Evaluation Findings & Decision Note"
              required
              placeholder="Record inspection findings, quality/quantity checks, decision rationale..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
