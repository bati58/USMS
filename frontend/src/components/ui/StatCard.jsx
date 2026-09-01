export default function StatCard({ label, value, icon: Icon, tone = 'brand', hint }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    warning: 'bg-warning-50 text-warning-500',
    success: 'bg-success-50 text-success-500',
    danger: 'bg-danger-50 text-danger-500',
    info: 'bg-info-50 text-info-500'
  }
  return (
    <div className="card flex items-center gap-4 border-brand-100/70 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-500">{label}</p>
        <p className="text-xl font-semibold text-ink-900">{value}</p>
        {hint && <p className="text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  )
}
