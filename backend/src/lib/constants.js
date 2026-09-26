export const ROUNDS = 10
export const LOW_STOCK = 5
export const PAGE_LIMIT = 200
export const ROLES = ['admin', 'empleado', 'cliente']

export function stockEstado(stock) {
  if (stock <= 0) return 'agotada'
  if (stock < LOW_STOCK) return 'bajo'
  return 'disponible'
}
