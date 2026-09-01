import { STATUS_COLOR } from '../../utils/constants'
import Badge from './Badge'

export default function StatusBadge({ status }) {
  return <Badge className={STATUS_COLOR[status] || 'bg-ink-100 text-ink-600'}>{status}</Badge>
}
