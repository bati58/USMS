import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--surface-overlay)] p-4 pt-10 sm:pt-16">
      <div className={`w-full ${sizes[size]} rounded-xl bg-[var(--surface)] shadow-2xl shadow-[var(--shadow-strong)]`}>
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-secondary)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 text-[var(--text-primary)] sm:px-6 sm:py-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse items-stretch justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-strong)] px-4 py-4 sm:flex-row sm:items-center sm:px-6 sm:py-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
