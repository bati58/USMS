import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogIn, Mail, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const DEMO_ACCOUNTS = [
  'admin',
  'pao',
  'storehead',
  'storekeeper',
  'clerk',
  'tec',
  'depthead',
  'accountant',
  'security'
]

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDemo, setShowDemo] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.username, form.password)
      push(`Welcome back, ${user.name.split(' ')[0]}.`, 'success')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(username) {
    setForm({ username, password: 'sms1234' })
    setError('')
    setShowDemo(false)
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#e9ecef]">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        {/* Logo & title */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-md ring-4 ring-white/80">
            <img src="/logo-img.png" alt="Stock Management System logo" className="h-16 w-16 rounded-full object-cover" />
          </div>
          <h1 className="text-2xl font-normal tracking-wide text-[#495057] sm:text-[26px]">
            Stock Management System
          </h1>
        </div>

        {/* Login card */}
        <div className="w-full max-w-[420px] rounded-sm bg-white px-8 py-7 shadow-[0_2px_10px_rgba(0,0,0,0.12)]">
          <p className="mb-5 text-center text-[15px] text-[#6c757d]">For Staff Only</p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full rounded border border-[#ced4da] bg-white py-2.5 pl-3 pr-10 text-sm text-[#495057] placeholder:text-[#adb5bd] focus:border-[#80bdff] focus:outline-none focus:ring-2 focus:ring-[#007bff]/25"
                />
                <Mail
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#adb5bd]"
                />
              </div>

              <div className="relative">
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded border border-[#ced4da] bg-white py-2.5 pl-3 pr-10 text-sm text-[#495057] placeholder:text-[#adb5bd] focus:border-[#80bdff] focus:outline-none focus:ring-2 focus:ring-[#007bff]/25"
                />
                <Lock
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#adb5bd]"
                />
              </div>

              {error && (
                <div className="rounded border border-danger-50 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded bg-[#007bff] px-5 py-2 text-sm font-normal text-white transition-colors hover:bg-[#0069d9] focus:outline-none focus:ring-2 focus:ring-[#007bff]/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <LogIn size={15} />
                )}
                Sign in
              </button>
            </div>
          </form>

          <div className="mt-5 flex items-center justify-between">
            <span className="cursor-default text-sm text-[#007bff]">Need help?</span>
            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              className="rounded bg-[#20c997] px-4 py-1.5 text-sm font-normal text-white transition-colors hover:bg-[#1baa80]"
            >
              Demo Access
            </button>
          </div>

          {showDemo && (
            <div className="mt-4 border-t border-[#dee2e6] pt-4">
              <p className="mb-2 text-xs text-[#6c757d]">
                Select a demo account (password: sms1234)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account}
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="rounded border border-[#ced4da] bg-[#f8f9fa] px-2.5 py-0.5 text-xs text-[#495057] transition-colors hover:border-[#007bff] hover:bg-[#e7f1ff] hover:text-[#007bff]"
                  >
                    {account}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#dee2e6] px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-[#6c757d]">
          <p>
            Copyright &copy; 2026{' '}
            <span className="text-[#007bff]">Stock Management System</span>. All rights reserved.
          </p>
          <p>Version 1.0</p>
        </div>
      </footer>
    </div>
  )
}
