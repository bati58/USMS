import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import AuthRecoveryLayout from './AuthRecoveryLayout'
import Button from '../../components/ui/Button'
import { authService } from '../../services'

export default function ForgotPassword() {
    const [identifier, setIdentifier] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        const value = identifier.trim()
        if (!value) {
            setError('Enter your username or registered email address.')
            return
        }
        setError('')
        setLoading(true)
        try {
            setResult(await authService.forgotPassword(value))
        } catch (err) {
            setError(err.message || 'Could not process the request.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthRecoveryLayout title="Forgot Password?" subtitle="Enter your username or registered email address and we will help you reset your password.">
            {result ? (
                <div className="space-y-4">
                    <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                        {result.message}
                    </div>
                    {result.devResetUrl && (
                        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                            <p className="font-medium">Development/demo reset link</p>
                            <a className="mt-1 block break-all underline" href={result.devResetUrl}>{result.devResetUrl}</a>
                        </div>
                    )}
                    <Link to="/login" className="block rounded bg-brand-600 px-5 py-2 text-center text-sm text-white hover:bg-brand-700">Return to Sign In</Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            required
                            autoComplete="username"
                            placeholder="Username or Email"
                            value={identifier}
                            onChange={(event) => setIdentifier(event.target.value)}
                            className="w-full rounded border border-[var(--input-border)] bg-[var(--input-bg)] py-2.5 pl-3 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-soft)] focus:border-[var(--brand-600)] focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                        />
                        <Mail size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
                    </div>
                    {error && <p className="rounded border border-danger-50 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
                    <Button type="submit" loading={loading} className="w-full justify-center">Send Reset Code</Button>
                </form>
            )}
        </AuthRecoveryLayout>
    )
}
