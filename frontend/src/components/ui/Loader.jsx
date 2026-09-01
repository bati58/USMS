import { Loader2 } from 'lucide-react'

export default function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-ink-400">
      <Loader2 size={26} className="animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
