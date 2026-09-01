// ---------------------------------------------------------------------------
// HTTP client for the Express API.
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

const RESOURCE_PATHS = {
  goodsReceipts: 'goods-receipts',
  stockTransactions: 'stock-transactions',
  binCards: 'bin-cards',
  binTransfers: 'bin-transfers',
  issueVouchers: 'issue-vouchers',
  materialReturns: 'material-returns',
  materialTransfers: 'material-transfers',
  fixedAssets: 'fixed-assets',
  userCards: 'user-cards',
  locations: 'locations',
  suppliers: 'suppliers',
  departments: 'departments',
  auditLogs: 'audit-logs'
}

function resourcePath(resource) {
  return RESOURCE_PATHS[resource] || resource
}

async function request(path, options = {}) {
  const token = localStorage.getItem('sms_token')
  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh' && token) {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    if (refreshRes.ok) {
      const { token: newToken } = await refreshRes.json();
      localStorage.setItem('sms_token', newToken);
      // Retry request with new token
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...(options.headers || {})
        }
      });
    } else {
      localStorage.removeItem('sms_token');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Request failed with status ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  list: (resource) => request(`/${resourcePath(resource)}`),
  raw: (path, options) => request(path, options),
  get: (resource, id) => request(`/${resourcePath(resource)}/${id}`),
  nestedList: (resource, id, child) => request(`/${resourcePath(resource)}/${id}/${child}`),
  create: (resource, data) => request(`/${resourcePath(resource)}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (resource, id, data) => request(`/${resourcePath(resource)}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  action: (resource, id, action, data) => request(`/${resourcePath(resource)}/${id}/${action}`, { method: 'POST', body: JSON.stringify(data) }),
  verifyGate: (resource, id) => request(`/gate-pass/${resourcePath(resource)}/${id}/verify`, { method: 'POST', body: JSON.stringify({}) }),
  remove: (resource, id) => request(`/${resourcePath(resource)}/${id}`, { method: 'DELETE' }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: (options) => request('/auth/me', options)
}
