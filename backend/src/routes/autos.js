import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { PAGE_LIMIT } from '../lib/constants.js'
import { asyncHandler, httpError, throwDbError } from '../lib/errors.js'
import {
  ilikeOr,
  optionalString,
  optionalUuid,
  requireString,
  requireUuid,
  requireYear
} from '../lib/validate.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const LIST_FIELDS = 'id, marca, modelo, anio, placas, vin, color, usuario_id, created_at, usuarios(id, nombre, email)'

const DETAIL_FIELDS = 'id, marca, modelo, anio, placas, vin, color, usuario_id, created_at, usuarios(id, nombre, email), auto_piezas(piezas(id, codigo, nombre, marca, categoria, precio, stock))'

router.use(requireAuth)

router.get('/', asyncHandler(async (req, res) => {
  let query = supabase()
    .from('autos')
    .select(LIST_FIELDS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(PAGE_LIMIT)

  if (req.user.rol === 'cliente') query = query.eq('usuario_id', req.user.id)

  const filter = ilikeOr(['marca', 'modelo', 'placas', 'vin', 'color'], req.query.q)
  if (filter) query = query.or(filter)

  const { data, error, count } = await query
  throwDbError(error)
  const rows = data || []
  res.json({ ok: true, data: rows.map(presentAuto), total: count ?? rows.length })
}))

router.post('/', asyncHandler(async (req, res) => {
  const payload = await readAuto(req, req.body, false)
  const { data, error } = await supabase().from('autos').insert(payload).select(LIST_FIELDS).single()
  throwDbError(error)
  res.status(201).json({ ok: true, data: presentAuto(data) })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const auto = await findAuto(req.params.id, true)
  assertCanView(req, auto)
  res.json({ ok: true, data: auto })
}))

router.patch('/:id', asyncHandler(async (req, res) => {
  const current = await findAuto(req.params.id, false)
  assertCanEdit(req, current)
  const payload = await readAuto(req, req.body, true)
  if (!Object.keys(payload).length) throw httpError(400, 'No hay cambios para guardar')

  const { data, error } = await supabase()
    .from('autos')
    .update(payload)
    .eq('id', current.id)
    .select(LIST_FIELDS)
    .single()
  throwDbError(error)
  res.json({ ok: true, data: presentAuto(data) })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const current = await findAuto(req.params.id, false)
  assertCanEdit(req, current)
  const { error } = await supabase().from('autos').delete().eq('id', current.id)
  throwDbError(error)
  res.json({ ok: true, data: { id: current.id } })
}))

router.post('/:id/piezas', asyncHandler(async (req, res) => {
  const current = await findAuto(req.params.id, false)
  assertCanEdit(req, current)
  const piezaId = requireUuid(req.body.pieza_id, 'Pieza')

  const { data: pieza, error: piezaError } = await supabase()
    .from('piezas')
    .select('id')
    .eq('id', piezaId)
    .maybeSingle()
  throwDbError(piezaError)
  if (!pieza) throw httpError(404, 'Pieza no encontrada')

  const { error } = await supabase()
    .from('auto_piezas')
    .insert({ auto_id: current.id, pieza_id: piezaId })
  throwDbError(error)

  const auto = await findAuto(current.id, true)
  res.status(201).json({ ok: true, data: auto })
}))

router.delete('/:id/piezas/:piezaId', asyncHandler(async (req, res) => {
  const current = await findAuto(req.params.id, false)
  assertCanEdit(req, current)
  const piezaId = requireUuid(req.params.piezaId, 'Pieza')
  const { error } = await supabase()
    .from('auto_piezas')
    .delete()
    .eq('auto_id', current.id)
    .eq('pieza_id', piezaId)
  throwDbError(error)
  res.json({ ok: true, data: { auto_id: current.id, pieza_id: piezaId } })
}))

async function readAuto(req, body, partial) {
  const payload = {}
  const has = (key) => body[key] != null && body[key] !== ''

  if (!partial || has('marca')) payload.marca = requireString(body.marca, 'Marca', { max: 80 })
  if (!partial || has('modelo')) payload.modelo = requireString(body.modelo, 'Modelo', { max: 80 })
  if (!partial || has('anio')) payload.anio = requireYear(body.anio)
  if (!partial || body.placas !== undefined) {
    const placas = optionalString(body.placas, 'Placas', 15)
    payload.placas = placas ? placas.toUpperCase() : null
  }
  if (!partial || body.vin !== undefined) {
    const vin = optionalString(body.vin, 'VIN', 17)
    payload.vin = vin ? vin.toUpperCase() : null
  }
  if (!partial || body.color !== undefined) payload.color = optionalString(body.color, 'Color', 40)

  if (req.user.rol === 'cliente') {
    payload.usuario_id = req.user.id
    if (partial) delete payload.usuario_id
  } else if (!partial || body.usuario_id !== undefined) {
    const usuarioId = optionalUuid(body.usuario_id, 'Propietario')
    if (usuarioId) {
      const { data, error } = await supabase()
        .from('usuarios')
        .select('id')
        .eq('id', usuarioId)
        .maybeSingle()
      throwDbError(error)
      if (!data) throw httpError(400, 'El propietario no existe')
    }
    payload.usuario_id = usuarioId
  }

  return payload
}

function presentAuto(row) {
  const { usuarios, auto_piezas: links, ...auto } = row
  const piezas = (links || [])
    .map((link) => link.piezas)
    .filter(Boolean)
    .map((pieza) => ({ ...pieza, precio: Number(pieza.precio), stock: Number(pieza.stock) }))
  return { ...auto, propietario: usuarios || null, piezas }
}

async function findAuto(id, detailed) {
  const autoId = requireUuid(id, 'Auto')
  const { data, error } = await supabase()
    .from('autos')
    .select(detailed ? DETAIL_FIELDS : LIST_FIELDS)
    .eq('id', autoId)
    .maybeSingle()
  throwDbError(error)
  if (!data) throw httpError(404, 'Auto no encontrado')
  return presentAuto(data)
}

function assertCanView(req, auto) {
  if (req.user.rol === 'cliente' && auto.usuario_id !== req.user.id) {
    throw httpError(403, 'No puedes consultar este auto')
  }
}

function assertCanEdit(req, auto) {
  if (req.user.rol === 'cliente' && auto.usuario_id !== req.user.id) {
    throw httpError(403, 'No puedes modificar este auto')
  }
}

export default router
