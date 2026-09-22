import { Link } from 'react-router-dom'

export default function AuthRecoveryLayout({ title, subtitle, children }) {
    return (
        <div className="flex min-h-screen flex-col bg-[var(--app-bg)] text-[var(--text-primary)] transition-colors duration-200">
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
                <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface)] shadow-md ring-4 ring-[var(--surface-strong)]">
                        <img src="/logo-img.png" alt="Stock Management System logo" className="h-16 w-16 rounded-full object-cover" />
                    </div>
                    <h1 className="text-2xl font-normal tracking-wide text-[var(--text-secondary)] sm:text-[26px]">
                        Stock Management System
                    </h1>
                </div>

                <div className="w-full max-w-[420px] rounded-sm bg-[var(--surface)] px-8 py-7 shadow-[0_2px_10px_var(--shadow-soft)]">
                    <h2 className="mb-2 text-center text-xl font-medium text-[var(--text-primary)]">{title}</h2>
                    <p className="mb-5 text-center text-sm text-[var(--text-muted)]">{subtitle}</p>
                    {children}
                    <Link
                        to="/login"
                        className="mt-5 block text-center text-sm text-[var(--brand-600)] hover:text-[var(--brand-700)] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    >
                        Back to Sign In
                    </Link>
                </div>
            </div>

            <footer className="border-t border-[var(--border-subtle)] px-6 py-3">
                <div className="mx-auto flex max-w-5xl items-center justify-between text-xs text-[var(--text-muted)]">
                    <p>Copyright &copy; 2026 <span className="text-[var(--brand-600)]">Stock Management System</span>. All rights reserved.</p>
                    <p>Version 1.0</p>
                </div>
            </footer>
        </div>
    )
}
