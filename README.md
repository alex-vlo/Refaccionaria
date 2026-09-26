# Refaccionaria

Sistema para registrar usuarios, piezas y autos. El navegador habla por REST con un servidor Node.js. El servidor guarda los datos en Supabase y las contraseñas con hash bcrypt (no se pueden recuperar en texto plano).

## Preparar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Abre el SQL Editor y ejecuta `backend/supabase/schema.sql`.
3. En Project Settings → API copia la URL del proyecto y la clave `service_role`.

Usa la `service_role` solo en el servidor. Esa clave no va en el frontend.

## Arrancar

Desde la carpeta `backend`:

```bash
cp .env.example .env
npm install
npm start
```

En Windows PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm start
```

Completa `backend/.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (mínimo 16 caracteres)

Abre http://localhost:3000.

La primera cuenta registrada queda como administrador. Desde ahí puedes crear empleados y clientes. Las cuentas nuevas del formulario público entran como clientes.

## API

Todas las respuestas usan `{ "ok": true, "data": ... }` o `{ "ok": false, "error": "..." }`.
Las rutas protegidas piden `Authorization: Bearer <token>`.

| Método | Ruta | Quién |
| --- | --- | --- |
| POST | `/api/auth/register` | Público |
| POST | `/api/auth/login` | Público |
| GET, PATCH | `/api/auth/me` | Sesión |
| GET, POST | `/api/usuarios` | Lectura: admin y empleado. Alta: admin |
| GET, PATCH, DELETE | `/api/usuarios/:id` | Admin (la lectura también empleado) |
| GET, POST | `/api/piezas` | Lectura: sesión. Alta: admin y empleado |
| GET, PATCH, DELETE | `/api/piezas/:id` | Lectura: sesión. Cambios: admin y empleado |
| GET, POST | `/api/autos` | Sesión. Un cliente solo ve y crea los suyos |
| GET, PATCH, DELETE | `/api/autos/:id` | Sesión, con la misma regla |
| POST | `/api/autos/:id/piezas` | Vincula una pieza compatible |
| DELETE | `/api/autos/:id/piezas/:piezaId` | Quita ese vínculo |
| GET | `/api/resumen` | Admin y empleado |
| GET | `/api/health` | Público |

Filtros útiles: `/api/piezas?q=balata&categoria=Frenos&stock=bajo`, `/api/autos?q=nissan`, `/api/usuarios?q=ana`.
