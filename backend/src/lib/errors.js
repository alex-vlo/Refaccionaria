export function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

const UNIQUE_MESSAGES = {
  usuarios_email_key: 'Ese correo ya está registrado',
  piezas_codigo_key: 'Ese código de pieza ya existe',
  autos_placas_unique: 'Esas placas ya están registradas',
  autos_vin_unique: 'Ese VIN ya está registrado',
  auto_piezas_pkey: 'Esa pieza ya está vinculada a este auto'
}

export function throwDbError(error) {
  if (!error) return

  const message = error.message || ''

  if (error.code === '23505') {
    const known = Object.entries(UNIQUE_MESSAGES).find(([key]) => message.includes(key))
    throw httpError(409, known ? known[1] : 'Ya existe un registro con esos datos')
  }

  if (error.code === '23503') {
    throw httpError(400, 'La referencia indicada no existe')
  }

  if (error.code === 'PGRST116') {
    throw httpError(404, 'No se encontró el registro')
  }

  if (
    error.code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    throw httpError(
      500,
      'La clave de Supabase no tiene permisos. En el servidor usa la service_role key.'
    )
  }

  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  ) {
    throw httpError(
      500,
      'La base de datos no está preparada. Ejecuta backend/supabase/schema.sql en el editor SQL de Supabase.'
    )
  }

  console.error(error)
  throw httpError(500, 'No se pudo completar la operación en la base de datos')
}
