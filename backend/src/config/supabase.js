import { createClient } from '@supabase/supabase-js'
import { httpError } from '../lib/errors.js'

let client

export function supabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw httpError(
      500,
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env'
    )
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return client
}
