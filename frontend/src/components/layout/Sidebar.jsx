import { NavLink } from 'react-router-dom'
import { X, ChevronDown } from 'lucide-react'
import { getNavSections } from './navConfig'
import { useAuth } from '../../context/AuthContext'
import { useState } from 'react'

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth()
  const [expandedSections, setExpandedSections] = useState({})

  // Toggle section expansion
  const toggleSection = (sectionLabel) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionLabel]: !prev[sectionLabel]
    }))
  }

  // Sections are already scoped, grouped, and labelled per the user's role.
  const visibleSections = getNavSections(user?.role)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-ink-900/50 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 transform flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-xl shadow-[var(--shadow-soft)] backdrop-blur transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[var(--brand-soft)] shadow-md shadow-[var(--shadow-soft)]">
              <img src="/logo-img.png" alt="Stock Management System logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-[var(--text-primary)]">Stock Management</p>
              <p className="text-xs leading-tight text-[var(--text-muted)]">System</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-5 pb-6">
          {visibleSections.map((section) => {
            const isExpanded = expandedSections[section.label] !== false // Default to true
            return (
              <div key={section.label}>
                {/* Section Header with Collapse/Expand Icon */}
                <button
                  onClick={() => toggleSection(section.label)}
                  className="flex w-full items-center justify-between gap-2 px-2 pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                >
                  <span className="max-w-[calc(100%-20px)] leading-snug break-words">{section.label}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'
                      }`}
                  />
                </button>

                {/* Section Items - Collapsible */}
                {isExpanded && (
                  <div className="space-y-0.5 mb-1">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${isActive
                            ? 'bg-[var(--brand-soft)] text-[var(--brand-700)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                          }`
                        }
                      >
                        <item.icon size={17} />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Role indicator at the bottom */}
        <div className="flex-shrink-0 space-y-3 border-t border-[var(--border-subtle)] px-3 py-4">
          {/* User role indicator */}
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--brand-soft)] px-3 py-2.5">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Your Role</p>
            <p className="mt-1 text-xs font-medium text-[var(--brand-700)]">{user?.role}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
