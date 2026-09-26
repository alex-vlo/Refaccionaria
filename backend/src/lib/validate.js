import { httpError } from './errors.js'
import { ROLES } from './constants.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PHONE = /^[0-9+\-()\s]{7,30}$/

export function requireString(value, field, { min = 1, max = 120 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw httpError(400, `${field} es obligatorio`)
  }
  const clean = value.trim()
  if (clean.length > max) {
    throw httpError(400, `${field} es demasiado largo`)
  }
  return clean
}

export function optionalString(value, field, max = 200) {
  if (value == null || value === '') return null
  return requireString(value, field, { min: 1, max })
}

export function requireEmail(value) {
  const email = requireString(value, 'Correo', { max: 160 }).toLowerCase()
  if (!EMAIL.test(email)) throw httpError(400, 'El correo no es válido')
  return email
}

export function requirePassword(value, field = 'Contraseña') {
  if (typeof value !== 'string' || value.length < 8) {
    throw httpError(400, `${field} debe tener al menos 8 caracteres`)
  }
  if (value.length > 72) throw httpError(400, `${field} es demasiado larga`)
  return value
}

export function optionalPhone(value) {
  if (value == null || String(value).trim() === '') return null
  const phone = String(value).trim()
  if (!PHONE.test(phone)) {
    throw httpError(400, 'El teléfono solo puede incluir dígitos, espacios, +, - y paréntesis')
  }
  return phone
}

export function requireUuid(value, field = 'Identificador') {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw httpError(400, `${field} no es válido`)
  }
  return value
}

export function optionalUuid(value, field) {
  if (value == null || value === '') return null
  return requireUuid(value, field)
}

export function requireInt(value, field, { min, max }) {
  if (value == null || value === '') throw httpError(400, `${field} es obligatorio`)
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw httpError(400, `${field} no es válido`)
  }
  return number
}

export function requireMoney(value, field) {
  if (value == null || value === '') throw httpError(400, `${field} es obligatorio`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 99999999) {
    throw httpError(400, `${field} no es válido`)
  }
  return Math.round(number * 100) / 100
}

export function requireRole(value) {
  if (!ROLES.includes(value)) throw httpError(400, 'El rol no es válido')
  return value
}

export function requireYear(value) {
  const max = new Date().getFullYear() + 1
  return requireInt(value, 'Año', { min: 1900, max })
}

export function searchTerm(value) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') throw httpError(400, 'La búsqueda no es válida')
  return value.replace(/[%_,.()"'\\*]/g, '').trim().slice(0, 80)
}

export function ilikeOr(columns, term) {
  const safe = searchTerm(term)
  if (!safe) return null
  return columns.map((column) => `${column}.ilike."%${safe}%"`).join(',')
}
