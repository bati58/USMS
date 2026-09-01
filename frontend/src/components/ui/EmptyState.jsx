import { Inbox } from 'lucide-react'

export default function EmptyState({ title = 'Nothing here yet', message = 'No records found.', icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      <p className="max-w-xs text-sm text-ink-400">{message}</p>
      {action}
    </div>
  )
}
