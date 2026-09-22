import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import AuthRecoveryLayout from './AuthRecoveryLayout'
import Button from '../../components/ui/Button'
import { authService } from '../../services'

export default function ResetPassword() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const token = searchParams.get('token') || ''
    const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (!token) setError('Invalid or missing password reset link.')
    }, [token])

    async function handleSubmit(event) {
        event.preventDefault()
        if (!token) return
        if (form.newPassword.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }
        if (form.newPassword !== form.confirmPassword) {
            setError('Passwords do not match.')
            return
        }
        setError('')
        setLoading(true)
        try {
            await authService.resetPassword(token, form.newPassword)
            setSuccess(true)
            setTimeout(() => navigate('/login', { replace: true }), 1400)
        } catch (err) {
            setError(err.message || 'Your password reset link is invalid or has expired. Please request a new one.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthRecoveryLayout title="Create New Password" subtitle="Choose a new password for your Stock Management System account.">
            {success ? (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-800">
                    Password reset successfully. Redirecting to sign in...
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input type="password" required autoComplete="new-password" placeholder="New Password" value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-3 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-soft)] focus:border-[var(--brand-600)] focus:outline-none focus:ring-2 focus:ring-brand-500/25" />
                        <Lock size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
                    </div>
                    <div className="relative">
                        <input type="password" required autoComplete="new-password" placeholder="Confirm New Password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-3 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-soft)] focus:border-[var(--brand-600)] focus:outline-none focus:ring-2 focus:ring-brand-500/25" />
                        <Lock size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
                    </div>
                    {error && <p className="rounded border border-danger-50 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
                    <Button type="submit" loading={loading} disabled={!token} className="w-full justify-center">Reset Password</Button>
                </form>
            )}
        </AuthRecoveryLayout>
    )
}
