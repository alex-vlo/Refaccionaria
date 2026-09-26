import jwt from 'jsonwebtoken'
import { supabase } from '../config/supabase.js'
import { httpError, throwDbError } from '../lib/errors.js'

const USER_FIELDS = 'id, nombre, email, telefono, rol, created_at'

export function assertJwt() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    throw httpError(500, 'Configura JWT_SECRET en el archivo .env con al menos 16 caracteres')
  }
}

export function signToken(user) {
  assertJwt()
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '12h' })
}

export function publicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    telefono: user.telefono,
    rol: user.rol,
    created_at: user.created_at
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next(httpError(401, 'Debes iniciar sesión'))

  let payload
  try {
    if (!process.env.JWT_SECRET) {
      return next(httpError(500, 'Configura JWT_SECRET en el archivo .env'))
    }
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return next(httpError(401, 'Sesión inválida o expirada'))
  }

  supabase()
    .from('usuarios')
    .select(USER_FIELDS)
    .eq('id', payload.id)
    .maybeSingle()
    .then(({ data, error }) => {
      throwDbError(error)
      if (!data) throw httpError(401, 'Sesión inválida o expirada')
      req.user = data
      next()
    })
    .catch(next)
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return next(httpError(403, 'No tienes permiso para esta acción'))
    }
    next()
  }
}

export { USER_FIELDS }
