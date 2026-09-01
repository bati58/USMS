export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="bg-gradient-to-r from-ink-900 via-brand-800 to-brand-600 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-base text-ink-500">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  )
}
