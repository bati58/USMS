import { Search } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative flex w-full items-center">
      <Search size={17} className="pointer-events-none absolute left-3 text-ink-400" aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input w-full pl-10"
      />
    </div>
  )
}
