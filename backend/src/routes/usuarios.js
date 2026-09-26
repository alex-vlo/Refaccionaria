import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { PAGE_LIMIT } from '../lib/constants.js'
import { asyncHandler, httpError, throwDbError } from '../lib/errors.js'
import { hashPassword } from '../lib/passwords.js'
import {
  ilikeOr,
  optionalPhone,
  requireEmail,
  requirePassword,
  requireRole,
  requireString,
  requireUuid
} from '../lib/validate.js'
import { publicUser, requireAuth, requireRole as allow, USER_FIELDS } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', allow('admin', 'empleado'), asyncHandler(async (req, res) => {
  let query = supabase()
    .from('usuarios')
    .select(USER_FIELDS, { count: 'exact' })
    .order('nombre', { ascending: true })
    .limit(PAGE_LIMIT)

  const filter = ilikeOr(['nombre', 'email'], req.query.q)
  if (filter) query = query.or(filter)
  if (req.query.rol) {
    const rol = requireRole(req.query.rol)
    query = query.eq('rol', rol)
  }

  const { data, error, count } = await query
  throwDbError(error)
  const rows = data || []
  res.json({ ok: true, data: rows.map(publicUser), total: count ?? rows.length })
}))

router.post('/', allow('admin'), asyncHandler(async (req, res) => {
  const nombre = requireString(req.body.nombre, 'Nombre', { max: 120 })
  const email = requireEmail(req.body.email)
  const password = requirePassword(req.body.password)
  const telefono = optionalPhone(req.body.telefono)
  const rol = requireRole(req.body.rol || 'cliente')
  const password_hash = await hashPassword(password)

  const { data, error } = await supabase()
    .from('usuarios')
    .insert({ nombre, email, password_hash, telefono, rol })
    .select(USER_FIELDS)
    .single()
  throwDbError(error)

  res.status(201).json({ ok: true, data: publicUser(data) })
}))

router.get('/:id', allow('admin', 'empleado'), asyncHandler(async (req, res) => {
  const id = requireUuid(req.params.id, 'Usuario')
  const { data, error } = await supabase()
    .from('usuarios')
    .select(USER_FIELDS)
    .eq('id', id)
    .maybeSingle()
  throwDbError(error)
  if (!data) throw httpError(404, 'Usuario no encontrado')
  res.json({ ok: true, data: publicUser(data) })
}))

router.patch('/:id', allow('admin'), asyncHandler(async (req, res) => {
  const id = requireUuid(req.params.id, 'Usuario')
  const { data: existing, error: findError } = await supabase()
    .from('usuarios')
    .select(USER_FIELDS)
    .eq('id', id)
    .maybeSingle()
  throwDbError(findError)
  if (!existing) throw httpError(404, 'Usuario no encontrado')

  const updates = {}
  if (req.body.nombre != null) updates.nombre = requireString(req.body.nombre, 'Nombre', { max: 120 })
  if (req.body.email != null) updates.email = requireEmail(req.body.email)
  if (req.body.telefono !== undefined) updates.telefono = optionalPhone(req.body.telefono)
  if (req.body.rol != null) updates.rol = requireRole(req.body.rol)
  if (req.body.password) updates.password_hash = await hashPassword(requirePassword(req.body.password))

  if (updates.rol && existing.rol === 'admin' && updates.rol !== 'admin') {
    await assertNotLastAdmin(id)
  }

  if (!Object.keys(updates).length) throw httpError(400, 'No hay cambios para guardar')

  const { data, error } = await supabase()
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select(USER_FIELDS)
    .single()
  throwDbError(error)
  res.json({ ok: true, data: publicUser(data) })
}))

router.delete('/:id', allow('admin'), asyncHandler(async (req, res) => {
  const id = requireUuid(req.params.id, 'Usuario')
  if (id === req.user.id) throw httpError(400, 'No puedes eliminar tu propia cuenta')

  const { data: existing, error: findError } = await supabase()
    .from('usuarios')
    .select('id, rol')
    .eq('id', id)
    .maybeSingle()
  throwDbError(findError)
  if (!existing) throw httpError(404, 'Usuario no encontrado')
  if (existing.rol === 'admin') await assertNotLastAdmin(id)

  const { error } = await supabase().from('usuarios').delete().eq('id', id)
  throwDbError(error)
  res.json({ ok: true, data: { id } })
}))

async function assertNotLastAdmin(id) {
  const { count, error } = await supabase()
    .from('usuarios')
    .select('*', { count: 'exact', head: true })
    .eq('rol', 'admin')
    .neq('id', id)
  throwDbError(error)
  if (!count) throw httpError(400, 'Debe existir al menos un administrador')
}

export default router
