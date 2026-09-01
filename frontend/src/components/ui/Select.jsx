export default function Select({ label, error, className = '', inputClassName = '', required, options = [], placeholder = 'Select...', ...rest }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-danger-500 font-bold">*</span>}
        </label>
      )}
      <select className={`input cursor-pointer ${inputClassName}`} {...rest}>
        <option value="">{placeholder}</option>
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value
          const text = typeof opt === 'string' ? opt : opt.label
          return (
            <option key={value} value={value}>
              {text}
            </option>
          )
        })}
      </select>
      {error && <p className="mt-2 text-xs text-danger-700 font-medium">{error}</p>}
    </div>
  )
}
