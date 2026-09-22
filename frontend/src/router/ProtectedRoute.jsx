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

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  // The forced-change page is available to every authenticated role.
  if (location.pathname === '/change-password') return <Outlet />

  // Check if user has access to this route
  if (!canAccessPage(user?.role, location.pathname)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
