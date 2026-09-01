export default function Input({ label, error, className = '', required, type = 'text', ...rest }) {
  const isCheckbox = type === 'checkbox'
  const inputClass = isCheckbox
    ? "h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600 cursor-pointer"
    : "input"

  return (
    <div className={`${className} ${isCheckbox ? 'flex items-center gap-2 flex-row-reverse justify-end' : ''}`}>
      {label && (
        <label className={`label ${isCheckbox ? '!mb-0 cursor-pointer' : ''}`}>
          {label} {required && !isCheckbox && <span className="text-danger-500 font-bold">*</span>}
        </label>
      )}
      <input className={inputClass} type={type} {...rest} />
      {error && !isCheckbox && <p className="mt-2 text-xs text-danger-700 font-medium">{error}</p>}
    </div>
  )
}
