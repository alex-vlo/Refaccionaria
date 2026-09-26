import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import usuariosRoutes from './routes/usuarios.js'
import piezasRoutes from './routes/piezas.js'
import autosRoutes from './routes/autos.js'
import resumenRoutes from './routes/resumen.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const port = Number(process.env.PORT) || 3000

app.disable('x-powered-by')
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    data: {
      service: 'refaccionaria',
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      jwt: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16)
    }
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/piezas', piezasRoutes)
app.use('/api/autos', autosRoutes)
app.use('/api/resumen', resumenRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
})

app.use(express.static(path.join(__dirname, '../../frontend')))

app.use((error, _req, res, _next) => {
  const status = error.status || 500
  if (!error.status) console.error(error)
  res.status(status).json({
    ok: false,
    error: error.status ? error.message : 'Error interno del servidor'
  })
})

app.listen(port, () => {
  console.log(`Refaccionaria en http://localhost:${port}`)
})
