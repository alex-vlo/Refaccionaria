import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { LOW_STOCK, PAGE_LIMIT, stockEstado } from '../lib/constants.js'
import { asyncHandler, httpError, throwDbError } from '../lib/errors.js'
import {
  ilikeOr,
  optionalString,
  requireInt,
  requireMoney,
  requireString,
  requireUuid
} from '../lib/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const staff = requireRole('admin', 'empleado')
const FIELDS = 'id, codigo, nombre, marca, categoria, descripcion, precio, stock, created_at'

router.use(requireAuth)

router.get('/', asyncHandler(async (req, res) => {
  let query = supabase()
    .from('piezas')
    .select(FIELDS, { count: 'exact' })
    .order('nombre', { ascending: true })
    .limit(PAGE_LIMIT)

  const filter = ilikeOr(['nombre', 'codigo', 'marca', 'categoria'], req.query.q)
  if (filter) query = query.or(filter)
  if (req.query.categoria) {
    query = query.eq('categoria', requireString(req.query.categoria, 'Categoría', { max: 40 }))
  }
  if (req.query.stock === 'bajo') query = query.lt('stock', LOW_STOCK)

  const { data, error, count } = await query
  throwDbError(error)
  const rows = data || []
  res.json({ ok: true, data: rows.map(presentPieza), total: count ?? rows.length })
}))

router.post('/', staff, asyncHandler(async (req, res) => {
  const payload = readPieza(req.body)
  const { data, error } = await supabase().from('piezas').insert(payload).select(FIELDS).single()
  throwDbError(error)
  res.status(201).json({ ok: true, data: presentPieza(data) })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const pieza = await findPieza(req.params.id)
  const { data: links, error } = await supabase()
    .from('auto_piezas')
    .select('autos(id, marca, modelo, anio, placas)')
    .eq('pieza_id', pieza.id)
  throwDbError(error)
  res.json({
    ok: true,
    data: {
      ...pieza,
      autos: (links || []).map((link) => link.autos).filter(Boolean)
    }
  })
}))

router.patch('/:id', staff, asyncHandler(async (req, res) => {
  const id = requireUuid(req.params.id, 'Pieza')
  await findPieza(id)
  const payload = readPieza(req.body, true)
  if (!Object.keys(payload).length) throw httpError(400, 'No hay cambios para guardar')

  const { data, error } = await supabase()
    .from('piezas')
    .update(payload)
    .eq('id', id)
    .select(FIELDS)
    .single()
  throwDbError(error)
  res.json({ ok: true, data: presentPieza(data) })
}))

router.delete('/:id', staff, asyncHandler(async (req, res) => {
  const id = requireUuid(req.params.id, 'Pieza')
  await findPieza(id)
  const { error } = await supabase().from('piezas').delete().eq('id', id)
  throwDbError(error)
  res.json({ ok: true, data: { id } })
}))

function readPieza(body, partial = false) {
  const payload = {}
  const include = (key) => !partial || body[key] !== undefined

  if (include('codigo')) payload.codigo = requireString(body.codigo, 'Código', { max: 40 }).toUpperCase()
  if (include('nombre')) payload.nombre = requireString(body.nombre, 'Nombre', { max: 160 })
  if (include('marca')) payload.marca = optionalString(body.marca, 'Marca', 80)
  if (include('categoria')) payload.categoria = optionalString(body.categoria, 'Categoría', 40)
  if (include('descripcion')) payload.descripcion = optionalString(body.descripcion, 'Descripción', 500)
  if (include('precio')) payload.precio = requireMoney(body.precio, 'Precio')
  if (include('stock')) payload.stock = requireInt(body.stock, 'Stock', { min: 0, max: 1000000 })
  return payload
}

function presentPieza(row) {
  const stock = Number(row.stock)
  return {
    ...row,
    precio: Number(row.precio),
    stock,
    estado: stockEstado(stock)
  }
}

async function findPieza(id) {
  const piezaId = requireUuid(id, 'Pieza')
  const { data, error } = await supabase().from('piezas').select(FIELDS).eq('id', piezaId).maybeSingle()
  throwDbError(error)
  if (!data) throw httpError(404, 'Pieza no encontrada')
  return presentPieza(data)
}

export default router
