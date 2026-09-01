export default function Textarea({ label, error, className = '', required, ...rest }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-danger-500">*</span>}
        </label>
      )}
      <textarea className="input min-h-[90px]" {...rest} />
      {error && <p className="mt-1 text-xs text-danger-700">{error}</p>}
    </div>
  )
}
