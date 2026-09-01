import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="print-shell flex h-screen bg-gradient-to-b from-ink-50 via-white to-ink-50 overflow-hidden">
      {/* Sidebar - Fixed on desktop, overlays on mobile */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sticky Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Scrollable content area */}
        <main className="print-content flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-ink-100 px-6 py-5 text-center text-xs text-ink-500 bg-white flex-shrink-0">
          <p className="font-medium">Stock Management System</p>
          <p className="text-ink-400 mt-1">Version 1.0 • All rights reserved © 2026</p>
        </footer>
      </div>
    </div>
  )
}
