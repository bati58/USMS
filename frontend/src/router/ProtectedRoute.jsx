import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccessPage } from '../utils/rolePermissions'
import Loader from '../components/ui/Loader'

export default function ProtectedRoute() {
  const { isAuthenticated, ready, user } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader label="Preparing your session..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check if user has access to this route
  if (!canAccessPage(user?.role, location.pathname)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink-900">Access Denied</h1>
          <p className="mt-2 text-ink-600">
            Your role ({user?.role}) does not have access to this page.
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
