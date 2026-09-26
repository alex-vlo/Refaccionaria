const API = '/api'

let onUnauthorized = () => {}

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/health']

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export async function request(path, { method = 'GET', body } = {}) {
  const headers = {}
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(API + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor')
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const isPublic = PUBLIC_PATHS.some((item) => path.startsWith(item))
  if (response.status === 401 && !isPublic) {
    localStorage.removeItem('token')
    onUnauthorized()
  }

  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(payload?.error || 'No se pudo completar la solicitud')
  }

  return { data: payload.data, total: payload.total ?? null }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' })
}
