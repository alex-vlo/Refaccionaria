import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { asyncHandler, httpError, throwDbError } from '../lib/errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

router.get('/', requireRole('admin'), asyncHandler(async (_req, res) => {
  const { data, error } = await supabase()
    .from('ubicaciones')
    .select('id, usuario_id, latitud, longitud, precision_m, recorded_at, usuarios(id, nombre, email, rol)')
    .order('recorded_at', { ascending: false })
    .limit(300)
  throwDbError(error)

  const latest = new Map()
  for (const row of data || []) {
    if (!latest.has(row.usuario_id)) latest.set(row.usuario_id, present(row))
  }
  res.json({ ok: true, data: [...latest.values()] })
}))

router.post('/', asyncHandler(async (req, res) => {
  const latitud = requireCoord(req.body.latitud, 'Latitud', -90, 90)
  const longitud = requireCoord(req.body.longitud, 'Longitud', -180, 180)
  let precision_m = null
  if (req.body.precision_m != null && req.body.precision_m !== '') {
    precision_m = requireCoord(req.body.precision_m, 'Precisión', 0, 100000)
  }

  const { data, error } = await supabase()
    .from('ubicaciones')
    .insert({
      usuario_id: req.user.id,
      latitud,
      longitud,
      precision_m
    })
    .select('id, usuario_id, latitud, longitud, precision_m, recorded_at')
    .single()
  throwDbError(error)
  res.status(201).json({ ok: true, data })
}))

function present(row) {
  const { usuarios, ...ubicacion } = row
  return { ...ubicacion, usuario: usuarios || null }
}

function requireCoord(value, field, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    throw httpError(400, `${field} no es válida`)
  }
  return number
}

export default router
