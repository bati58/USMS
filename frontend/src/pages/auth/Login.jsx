import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogIn, Mail, Lock, CircleHelp, X } from 'lucide-react'
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
  const [showHelp, setShowHelp] = useState(false)

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
    <div className="flex min-h-screen flex-col bg-[var(--app-bg)] text-[var(--text-primary)] transition-colors duration-200">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        {/* Logo & title */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface)] shadow-md ring-4 ring-[var(--surface-strong)]">
            <img src="/logo-img.png" alt="Stock Management System logo" className="h-16 w-16 rounded-full object-cover" />
          </div>
          <h1 className="text-2xl font-normal tracking-wide text-[var(--text-secondary)] sm:text-[26px]">
            Stock Management System
          </h1>
        </div>

        {/* Login card */}
        <div className="w-full max-w-[420px] rounded-sm bg-[var(--surface)] px-8 py-7 shadow-[0_2px_10px_var(--shadow-soft)]">
          <p className="mb-5 text-center text-[15px] text-[var(--text-muted)]">Authorized staff access</p>

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
                  className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-3 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-soft)] focus:border-[var(--brand-600)] focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                />
                <Mail
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
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
                  className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-3 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-soft)] focus:border-[var(--brand-600)] focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                />
                <Lock
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
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
                className="inline-flex items-center gap-2 rounded bg-brand-600 px-5 py-2 text-sm font-normal text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-60"
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
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--brand-600)] hover:text-[var(--brand-700)] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              <CircleHelp size={15} />
              Need help signing in?
            </button>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => setShowDemo((v) => !v)}
                className="rounded bg-emerald-500 px-4 py-1.5 text-sm font-normal text-white transition-colors hover:bg-emerald-600"
              >
                Demo Access
              </button>
            )}
          </div>

          {showHelp && (
            <div className="mt-4 rounded border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4 text-sm text-[var(--text-secondary)]">
              <div className="mb-2 flex items-start justify-between gap-4">
                <h2 className="font-medium text-[var(--text-primary)]">Need help signing in?</h2>
                <button
                  type="button"
                  aria-label="Close sign-in help"
                  onClick={() => setShowHelp(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  <X size={17} />
                </button>
              </div>
              <p>
                Contact your system administrator or IT office to reset your account. You may need to provide your
                username and staff identity for verification.
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Never share your password with anyone.</p>
            </div>
          )}

          {import.meta.env.DEV && showDemo && (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
              <p className="mb-2 text-xs text-[var(--text-muted)]">
                Select a demo account (password: sms1234)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account}
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="rounded border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--brand-600)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-700)]"
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
      <footer className="border-t border-[var(--border-subtle)] px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-[var(--text-muted)]">
          <p>
            Copyright &copy; 2026{' '}
            <span className="text-[var(--brand-600)]">Stock Management System</span>. All rights reserved.
          </p>
          <p>Version 1.0</p>
        </div>
      </footer>
    </div>
  )
}
