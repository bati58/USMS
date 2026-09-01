export default function Card({ title, subtitle, actions, children, className = '', compact = false }) {
  return (
    <div className={`card ${compact ? 'p-4' : 'p-6'} ${className}`}>
      {(title || actions) && (
        <div className={`${compact ? 'mb-3 gap-2' : 'mb-6 gap-4'} flex flex-col items-start justify-between sm:flex-row sm:items-center`}>
          <div className="min-w-0">
            {title && <h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-[var(--text-primary)]`}>{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
