import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { asyncHandler, httpError, throwDbError } from '../lib/errors.js'
import { hashPassword, verifyPassword } from '../lib/passwords.js'
import { optionalPhone, requireEmail, requirePassword, requireString } from '../lib/validate.js'
import { assertJwt, publicUser, requireAuth, signToken, USER_FIELDS } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = Router()
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 })

router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  assertJwt()
  const nombre = requireString(req.body.nombre, 'Nombre', { max: 120 })
  const email = requireEmail(req.body.email)
  const password = requirePassword(req.body.password)
  const telefono = optionalPhone(req.body.telefono)

  const { count, error: countError } = await supabase()
    .from('usuarios')
    .select('*', { count: 'exact', head: true })
  throwDbError(countError)

  const rol = count === 0 ? 'admin' : 'cliente'
  const password_hash = await hashPassword(password)

  const { data, error } = await supabase()
    .from('usuarios')
    .insert({ nombre, email, password_hash, telefono, rol })
    .select(USER_FIELDS)
    .single()
  throwDbError(error)

  res.status(201).json({
    ok: true,
    data: { token: signToken(data), user: publicUser(data) }
  })
}))

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  assertJwt()
  const email = requireEmail(req.body.email)
  const password = requirePassword(req.body.password)

  const { data, error } = await supabase()
    .from('usuarios')
    .select(`${USER_FIELDS}, password_hash`)
    .eq('email', email)
    .maybeSingle()
  throwDbError(error)

  const valid = data ? await verifyPassword(password, data.password_hash) : false
  if (!data || !valid) {
    throw httpError(401, 'Correo o contraseña incorrectos')
  }

  res.json({
    ok: true,
    data: { token: signToken(data), user: publicUser(data) }
  })
}))

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ ok: true, data: publicUser(req.user) })
}))

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const updates = {}

  if (req.body.nombre != null) {
    updates.nombre = requireString(req.body.nombre, 'Nombre', { max: 120 })
  }
  if (req.body.telefono !== undefined) {
    updates.telefono = optionalPhone(req.body.telefono)
  }
  if (req.body.password) {
    const actual = requirePassword(req.body.password_actual, 'Contraseña actual')
    const nueva = requirePassword(req.body.password, 'Nueva contraseña')
    const { data: current, error } = await supabase()
      .from('usuarios')
      .select('password_hash')
      .eq('id', req.user.id)
      .maybeSingle()
    throwDbError(error)
    if (!current || !(await verifyPassword(actual, current.password_hash))) {
      throw httpError(400, 'La contraseña actual no coincide')
    }
    updates.password_hash = await hashPassword(nueva)
  }

  if (!Object.keys(updates).length) {
    throw httpError(400, 'No hay cambios para guardar')
  }

  const { data, error } = await supabase()
    .from('usuarios')
    .update(updates)
    .eq('id', req.user.id)
    .select(USER_FIELDS)
    .single()
  throwDbError(error)

  res.json({ ok: true, data: publicUser(data) })
}))

export default router
