import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <Compass size={40} className="mb-3 text-ink-300" />
      <h1 className="text-2xl font-semibold text-ink-900">Page not found</h1>
      <p className="mt-1 text-sm text-ink-500">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-4">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  )
}
