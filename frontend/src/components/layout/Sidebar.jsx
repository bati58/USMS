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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 transform flex-col border-r border-brand-100 bg-white/95 shadow-xl shadow-brand-900/5 backdrop-blur transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-brand-50 shadow-md shadow-brand-600/20">
              <img src="/logo-img.png" alt="Stock Management System logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-ink-900">Stock Management</p>
              <p className="text-xs leading-tight text-ink-400">System</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 lg:hidden">
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
                  className="w-full flex items-center justify-between px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-400 hover:text-ink-600 transition-colors"
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'
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
                            ? 'bg-gradient-to-r from-brand-50 to-blue-100/70 text-brand-700 shadow-sm'
                            : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
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
        <div className="border-t border-ink-100 px-3 py-4 flex-shrink-0 space-y-3">
          {/* User role indicator */}
          <div className="rounded-lg bg-gradient-to-r from-brand-50 to-brand-100 px-3 py-2.5 border border-brand-200">
            <p className="text-xs font-semibold text-brand-900">Your Role</p>
            <p className="text-xs text-brand-700 mt-1 font-medium">{user?.role}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
