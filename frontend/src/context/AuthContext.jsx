import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../services/apiClient'

const AuthContext = createContext(null)
const SESSION_KEY = 'sms_session_user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY)
    const token = localStorage.getItem('sms_token')

    if (saved && token) {
      // Add a timeout so a dead backend doesn't cause a permanent blank screen
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      api
        .me({ signal: controller.signal })
        .then((currentUser) => {
          setUser(currentUser)
        })
        .catch(() => {
          localStorage.removeItem(SESSION_KEY)
          localStorage.removeItem('sms_token')
          setUser(null)
        })
        .finally(() => {
          clearTimeout(timeout)
          setReady(true)
        })
      return () => {
        clearTimeout(timeout)
      }
    }

    setReady(true)
  }, [])

  async function login(username, password) {
    const inputName = String(username || '').trim()
    const result = await api.login({ username: inputName, password })
    localStorage.setItem('sms_token', result.token)
    localStorage.setItem(SESSION_KEY, JSON.stringify(result.user))
    setUser(result.user)
    return result.user
  }

  async function logout() {
    const currentUser = user
    await api.logout().catch(() => { })
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('sms_token')
    setUser(null)
  }

  function updateUser(updates) {
    setUser((current) => {
      const nextUser = { ...(current || {}), ...updates }
      if (nextUser) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser))
      }
      return nextUser
    })
  }

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      login,
      logout,
      updateUser,
      hasRole: (...roles) => Boolean(user) && roles.includes(user.role)
    }),
    [user, ready]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
