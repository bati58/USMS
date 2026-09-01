import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="print-shell flex h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Sidebar - Fixed on desktop, overlays on mobile */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Sticky Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Scrollable content area */}
        <main className="print-content flex-1 overflow-y-auto bg-[var(--page-bg)] px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-5 text-center text-xs text-[var(--text-muted)]">
          <p className="font-medium text-[var(--text-secondary)]">Stock Management System</p>
          <p className="mt-1 text-[var(--text-muted)]">Version 1.0 • All rights reserved © 2026</p>
        </footer>
      </div>
    </div>
  )
}
