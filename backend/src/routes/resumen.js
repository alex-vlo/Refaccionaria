import { Router } from 'express'
import { supabase } from '../config/supabase.js'
import { LOW_STOCK } from '../lib/constants.js'
import { asyncHandler, throwDbError } from '../lib/errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, requireRole('admin', 'empleado'), asyncHandler(async (req, res) => {
  const [usuarios, piezas, autos, inventario] = await Promise.all([
    supabase().from('usuarios').select('*', { count: 'exact', head: true }),
    supabase().from('piezas').select('*', { count: 'exact', head: true }),
    supabase().from('autos').select('*', { count: 'exact', head: true }),
    supabase().from('piezas').select('precio, stock')
  ])

  throwDbError(usuarios.error)
  throwDbError(piezas.error)
  throwDbError(autos.error)
  throwDbError(inventario.error)

  const rows = inventario.data || []
  const stockBajo = rows.filter((row) => Number(row.stock) < LOW_STOCK).length
  const valorInventario = rows.reduce(
    (sum, row) => sum + Number(row.precio) * Number(row.stock),
    0
  )

  res.json({
    ok: true,
    data: {
      usuarios: usuarios.count ?? 0,
      piezas: piezas.count ?? 0,
      autos: autos.count ?? 0,
      stockBajo,
      valorInventario: Math.round(valorInventario * 100) / 100
    }
  })
}))

export default router
