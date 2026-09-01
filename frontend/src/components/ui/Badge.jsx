export default function Badge({ children, className = '' }) {
  return <span className={`badge ${className || 'bg-ink-100 text-ink-600'}`}>{children}</span>
}
