import { httpError } from '../lib/errors.js'

const buckets = new Map()

export function rateLimit({ windowMs, max }) {
  return (req, _res, next) => {
    const now = Date.now()
    const key = req.ip || 'local'
    const recent = (buckets.get(key) || []).filter((stamp) => now - stamp < windowMs)
    if (recent.length >= max) {
      return next(httpError(429, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'))
    }
    recent.push(now)
    buckets.set(key, recent)
    if (buckets.size > 5000) buckets.clear()
    next()
  }
}
