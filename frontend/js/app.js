import { api, setUnauthorizedHandler } from './api.js'

const CATEGORIAS = ['Motor', 'Frenos', 'Suspensión', 'Eléctrico', 'Carrocería', 'Filtros', 'Transmisión', 'Enfriamiento', 'Escape']
const ROLES = [
  ['admin', 'Administrador'],
  ['empleado', 'Empleado'],
  ['cliente', 'Cliente']
]
const TITLES = {
  inicio: ['Panel', 'Inicio'],
  piezas: ['Inventario', 'Piezas'],
  autos: ['Taller', 'Autos'],
  usuarios: ['Accesos', 'Usuarios']
}
const STOCK = {
  agotada: ['Agotada', 'badge-off'],
  bajo: ['Bajo', 'badge-low'],
  disponible: ['Disponible', 'badge-ok']
}

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const state = {
  user: null,
  view: 'inicio',
  authMode: 'login',
  piezas: [],
  autos: [],
  usuarios: [],
  resumen: null,
  catalogo: []
}

let modalHandler = null
let piezasReq = 0
let autosReq = 0
let usuariosReq = 0
const maxYear = new Date().getFullYear() + 1

const $ = (id) => document.getElementById(id)

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]))
}

function formatMoney(value) {
  return money.format(Number(value) || 0)
}

function roleLabel(rol) {
  return ROLES.find(([value]) => value === rol)?.[1] || rol
}

function isStaff() {
  return state.user && (state.user.rol === 'admin' || state.user.rol === 'empleado')
}

function isAdmin() {
  return state.user?.rol === 'admin'
}

function toast(message, type = 'ok') {
  const item = document.createElement('div')
  item.className = `toast toast-${type}`
  item.textContent = message
  $('toasts').appendChild(item)
  setTimeout(() => item.remove(), 3400)
}

function showFormError(message) {
  const box = $('modal-error')
  if ($('modal').open) {
    box.hidden = false
    box.textContent = message
    return
  }
  toast(message, 'error')
}

function queryString(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

function field(label, control) {
  return `<label class="field"><span>${label}</span>${control}</label>`
}

function emptyRow(columns, message) {
  return `<tr><td class="empty" colspan="${columns}">${esc(message)}</td></tr>`
}

function stockBadge(estado, stock) {
  const [label, className] = STOCK[estado] || STOCK.disponible
  return `<span class="badge ${className}">${label} · ${esc(stock)}</span>`
}

function applyRole() {
  $('nav-usuarios').hidden = !isStaff()
  $('new-pieza').hidden = !isStaff()
  $('new-usuario').hidden = !isAdmin()
  $('piezas-actions-head').hidden = !isStaff()
  $('usuarios-actions-head').hidden = !isAdmin()
}

function paintWho() {
  const name = state.user?.nombre || '—'
  $('who-name').textContent = name
  $('who-role').textContent = roleLabel(state.user?.rol)
  $('who-avatar').textContent = name.trim().charAt(0).toUpperCase() || 'R'
}

function showAuth() {
  $('boot').hidden = true
  $('app-shell').hidden = true
  $('auth-screen').hidden = false
}

function enterApp() {
  $('boot').hidden = true
  $('auth-screen').hidden = true
  $('app-shell').hidden = false
  applyRole()
  paintWho()
  if (state.view === 'usuarios' && !isStaff()) state.view = 'inicio'
  showView(state.view || 'inicio')
}

function showView(name) {
  if (name === 'usuarios' && !isStaff()) name = 'inicio'
  state.view = name
  const [kicker, title] = TITLES[name]
  $('view-kicker').textContent = kicker
  $('view-title').textContent = title
  document.querySelectorAll('.nav-btn').forEach((button) => {
    const active = button.dataset.view === name
    button.classList.toggle('active', active)
    button.setAttribute('aria-current', active ? 'page' : 'false')
  })
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== `view-${name}`
  })
  const loaders = {
    inicio: loadInicio,
    piezas: loadPiezas,
    autos: loadAutos,
    usuarios: loadUsuarios
  }
  loaders[name]()
}

function setAuthMode(mode) {
  state.authMode = mode
  const register = mode === 'register'
  $('field-nombre').hidden = !register
  $('field-telefono').hidden = !register
  $('auth-title').textContent = register ? 'Crear cuenta' : 'Iniciar sesión'
  $('auth-copy').textContent = register
    ? 'La primera cuenta del sistema queda como administrador.'
    : 'Entra con tu correo para continuar.'
  $('auth-submit').textContent = register ? 'Registrarme' : 'Entrar'
  $('auth-switch').textContent = register ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'
  $('auth-form').querySelector('[name="nombre"]').required = register
  $('auth-form').querySelector('[name="password"]').autocomplete = register ? 'new-password' : 'current-password'
}

async function loadInicio() {
  try {
    const [piezas, autos, resumen] = await Promise.all([
      api.get('/piezas'),
      api.get('/autos'),
      isStaff() ? api.get('/resumen') : Promise.resolve({ data: null })
    ])
    state.piezas = piezas.data
    state.autos = autos.data
    state.resumen = resumen.data
    renderInicio()
  } catch (error) {
    $('stats').innerHTML = ''
    $('recent-piezas').innerHTML = `<p class="empty">${esc(error.message)}</p>`
    $('recent-autos').innerHTML = ''
    toast(error.message, 'error')
  }
}

function renderInicio() {
  const resumen = state.resumen
  const cards = isStaff() && resumen
    ? [
        ['Usuarios', resumen.usuarios, 'goto-usuarios'],
        ['Piezas', resumen.piezas, 'goto-piezas'],
        ['Autos', resumen.autos, 'goto-autos'],
        ['Stock bajo', resumen.stockBajo, 'stock-bajo', true],
        ['Valor de inventario', formatMoney(resumen.valorInventario), 'goto-piezas']
      ]
    : [
        ['Piezas en catálogo', state.piezas.length, 'goto-piezas'],
        ['Mis autos', state.autos.length, 'goto-autos']
      ]

  $('stats').innerHTML = cards.map(([label, value, action, alert]) => `
    <button class="stat${alert ? ' alert' : ''}" type="button" data-action="${action}">
      <span>${esc(label)}</span>
      <b>${esc(value)}</b>
    </button>
  `).join('')

  $('recent-piezas').innerHTML = miniList(state.piezas.slice(0, 5), (pieza) => `
    <span><span class="code">${esc(pieza.codigo)}</span> ${esc(pieza.nombre)}</span>
    ${stockBadge(pieza.estado, pieza.stock)}
  `, 'No hay piezas registradas.')

  $('recent-autos').innerHTML = miniList(state.autos.slice(0, 5), (auto) => `
    <span>${esc(auto.marca)} ${esc(auto.modelo)}</span>
    <span class="muted">${esc(auto.placas || auto.anio)}</span>
  `, 'No hay autos registrados.')
}

function miniList(items, render, empty) {
  if (!items.length) return `<p class="empty">${esc(empty)}</p>`
  return `<ul class="recent">${items.map((item) => `<li>${render(item)}</li>`).join('')}</ul>`
}

async function loadPiezas() {
  const requestId = ++piezasReq
  const columns = isStaff() ? 7 : 6
  $('piezas-body').innerHTML = emptyRow(columns, 'Cargando…')
  try {
    const { data, total } = await api.get('/piezas' + queryString({
      q: $('search-piezas').value.trim(),
      categoria: $('filter-categoria').value,
      stock: $('filter-stock').value
    }))
    if (requestId !== piezasReq) return
    state.piezas = data
    renderPiezas(total)
  } catch (error) {
    if (requestId !== piezasReq) return
    $('piezas-body').innerHTML = emptyRow(columns, error.message)
    toast(error.message, 'error')
  }
}

function renderPiezas(total) {
  const columns = isStaff() ? 7 : 6
  const filtered = Boolean($('search-piezas').value.trim() || $('filter-categoria').value || $('filter-stock').value)
  $('piezas-actions-head').hidden = !isStaff()
  if (!state.piezas.length) {
    $('piezas-body').innerHTML = emptyRow(columns, filtered ? 'Ningún resultado con esos filtros.' : 'Todavía no hay piezas registradas.')
  } else {
    $('piezas-body').innerHTML = state.piezas.map((pieza) => `
      <tr>
        <td><span class="code">${esc(pieza.codigo)}</span></td>
        <td>${esc(pieza.nombre)}</td>
        <td>${esc(pieza.categoria || '—')}</td>
        <td>${esc(pieza.marca || '—')}</td>
        <td>${esc(formatMoney(pieza.precio))}</td>
        <td>${stockBadge(pieza.estado, pieza.stock)}</td>
        ${isStaff() ? `<td><div class="row-actions">
          <button class="mini" type="button" data-action="edit-pieza" data-id="${esc(pieza.id)}">Editar</button>
          <button class="mini danger" type="button" data-action="delete-pieza" data-id="${esc(pieza.id)}">Eliminar</button>
        </div></td>` : ''}
      </tr>
    `).join('')
  }
  const shown = state.piezas.length
  $('piezas-meta').textContent = total > shown
    ? `Mostrando ${shown} de ${total}. Afina la búsqueda para ver el resto.`
    : `${shown} ${shown === 1 ? 'pieza' : 'piezas'}`
}

async function loadAutos() {
  const requestId = ++autosReq
  $('autos-body').innerHTML = emptyRow(6, 'Cargando…')
  try {
    const { data, total } = await api.get('/autos' + queryString({ q: $('search-autos').value.trim() }))
    if (requestId !== autosReq) return
    state.autos = data
    renderAutos(total)
  } catch (error) {
    if (requestId !== autosReq) return
    $('autos-body').innerHTML = emptyRow(6, error.message)
    toast(error.message, 'error')
  }
}

function renderAutos(total) {
  const filtered = Boolean($('search-autos').value.trim())
  if (!state.autos.length) {
    $('autos-body').innerHTML = emptyRow(6, filtered ? 'Ningún resultado con esa búsqueda.' : 'Todavía no hay autos registrados.')
  } else {
    $('autos-body').innerHTML = state.autos.map((auto) => `
      <tr>
        <td><strong>${esc(auto.marca)} ${esc(auto.modelo)}</strong></td>
        <td>${esc(auto.anio)}</td>
        <td>${auto.placas ? `<span class="code">${esc(auto.placas)}</span>` : '—'}</td>
        <td>${esc(auto.color || '—')}</td>
        <td>${esc(auto.propietario?.nombre || 'Sin propietario')}</td>
        <td><div class="row-actions">
          <button class="mini" type="button" data-action="edit-auto" data-id="${esc(auto.id)}">Editar</button>
          <button class="mini" type="button" data-action="compat-auto" data-id="${esc(auto.id)}">Piezas</button>
          <button class="mini danger" type="button" data-action="delete-auto" data-id="${esc(auto.id)}">Eliminar</button>
        </div></td>
      </tr>
    `).join('')
  }
  const shown = state.autos.length
  $('autos-meta').textContent = total > shown
    ? `Mostrando ${shown} de ${total}.`
    : `${shown} ${shown === 1 ? 'auto' : 'autos'}`
}

async function loadUsuarios() {
  if (!isStaff()) return
  const requestId = ++usuariosReq
  const columns = isAdmin() ? 5 : 4
  $('usuarios-body').innerHTML = emptyRow(columns, 'Cargando…')
  try {
    const { data, total } = await api.get('/usuarios' + queryString({ q: $('search-usuarios').value.trim() }))
    if (requestId !== usuariosReq) return
    state.usuarios = data
    renderUsuarios(total)
  } catch (error) {
    if (requestId !== usuariosReq) return
    $('usuarios-body').innerHTML = emptyRow(columns, error.message)
    toast(error.message, 'error')
  }
}

function renderUsuarios(total) {
  const columns = isAdmin() ? 5 : 4
  const filtered = Boolean($('search-usuarios').value.trim())
  $('usuarios-actions-head').hidden = !isAdmin()
  if (!state.usuarios.length) {
    $('usuarios-body').innerHTML = emptyRow(columns, filtered ? 'Ningún resultado con esa búsqueda.' : 'No hay usuarios.')
  } else {
    $('usuarios-body').innerHTML = state.usuarios.map((user) => `
      <tr>
        <td>${esc(user.nombre)}</td>
        <td>${esc(user.email)}</td>
        <td>${esc(user.telefono || '—')}</td>
        <td><span class="badge badge-role">${esc(roleLabel(user.rol))}</span></td>
        ${isAdmin() ? `<td><div class="row-actions">
          <button class="mini" type="button" data-action="edit-usuario" data-id="${esc(user.id)}">Editar</button>
          <button class="mini danger" type="button" data-action="delete-usuario" data-id="${esc(user.id)}">Eliminar</button>
        </div></td>` : ''}
      </tr>
    `).join('')
  }
  $('usuarios-meta').textContent = `${total ?? state.usuarios.length} ${state.usuarios.length === 1 ? 'usuario' : 'usuarios'}`
}

function categoriaOptions(selected) {
  const categories = [...CATEGORIAS]
  if (selected && !categories.includes(selected)) categories.push(selected)
  return `<option value="">Sin categoría</option>` + categories.map((category) => (
    `<option value="${esc(category)}"${category === selected ? ' selected' : ''}>${esc(category)}</option>`
  )).join('')
}

function piezaForm(pieza = {}) {
  return `
    <div class="grid-2">
      ${field('Código', `<input name="codigo" required maxlength="40" value="${esc(pieza.codigo || '')}" />`)}
      ${field('Nombre', `<input name="nombre" required maxlength="160" value="${esc(pieza.nombre || '')}" />`)}
      ${field('Marca', `<input name="marca" maxlength="80" value="${esc(pieza.marca || '')}" />`)}
      ${field('Categoría', `<select name="categoria">${categoriaOptions(pieza.categoria || '')}</select>`)}
      ${field('Precio', `<input name="precio" type="number" min="0" step="0.01" required value="${pieza.precio ?? ''}" />`)}
      ${field('Stock', `<input name="stock" type="number" min="0" step="1" required value="${pieza.stock ?? ''}" />`)}
    </div>
    ${field('Descripción', `<textarea name="descripcion" maxlength="500" rows="3">${esc(pieza.descripcion || '')}</textarea>`)}
  `
}

function autoForm(auto = {}, users = []) {
  const owner = isStaff()
    ? field('Propietario', `<select name="usuario_id">
        <option value="">Sin propietario</option>
        ${users.map((user) => `<option value="${esc(user.id)}"${user.id === auto.usuario_id ? ' selected' : ''}>${esc(user.nombre)}</option>`).join('')}
      </select>`)
    : ''
  return `
    <div class="grid-2">
      ${field('Marca', `<input name="marca" required maxlength="80" value="${esc(auto.marca || '')}" />`)}
      ${field('Modelo', `<input name="modelo" required maxlength="80" value="${esc(auto.modelo || '')}" />`)}
      ${field('Año', `<input name="anio" type="number" required min="1900" max="${maxYear}" value="${auto.anio ?? ''}" />`)}
      ${field('Placas', `<input name="placas" maxlength="15" value="${esc(auto.placas || '')}" />`)}
      ${field('VIN', `<input name="vin" maxlength="17" value="${esc(auto.vin || '')}" />`)}
      ${field('Color', `<input name="color" maxlength="40" value="${esc(auto.color || '')}" />`)}
      ${owner}
    </div>
  `
}

function usuarioForm(user = {}) {
  const creating = !user.id
  const rol = user.rol || 'cliente'
  return `
    <div class="grid-2">
      ${field('Nombre', `<input name="nombre" required maxlength="120" value="${esc(user.nombre || '')}" />`)}
      ${field('Correo', `<input name="email" type="email" required maxlength="160" value="${esc(user.email || '')}" />`)}
      ${field('Teléfono', `<input name="telefono" maxlength="30" value="${esc(user.telefono || '')}" />`)}
      ${field('Rol', `<select name="rol">${ROLES.map(([value, label]) => `<option value="${value}"${rol === value ? ' selected' : ''}>${label}</option>`).join('')}</select>`)}
    </div>
    ${field(creating ? 'Contraseña' : 'Nueva contraseña', `<input name="password" type="password" ${creating ? 'required' : ''} minlength="8" maxlength="72" autocomplete="new-password" placeholder="${creating ? '' : 'Déjala en blanco para no cambiarla'}" />`)}
  `
}

function profileForm(user) {
  return `
    <div class="grid-2">
      ${field('Nombre', `<input name="nombre" required maxlength="120" value="${esc(user.nombre)}" />`)}
      ${field('Teléfono', `<input name="telefono" maxlength="30" value="${esc(user.telefono || '')}" />`)}
      ${field('Contraseña actual', `<input name="password_actual" type="password" minlength="8" maxlength="72" autocomplete="current-password" />`)}
      ${field('Nueva contraseña', `<input name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" />`)}
    </div>
    <p class="hint">La contraseña solo cambia si llenas los dos últimos campos. El correo de esta cuenta es ${esc(user.email)}.</p>
  `
}

function openModal({ title, body, submitLabel = 'Guardar', danger = false, footer = true, onSubmit }) {
  modalHandler = onSubmit || null
  $('modal-title').textContent = title
  $('modal-body').innerHTML = body
  $('modal-error').hidden = true
  $('modal-footer').hidden = !footer
  const submit = $('modal-submit')
  submit.textContent = submitLabel
  submit.classList.toggle('btn-danger', danger)
  submit.classList.toggle('btn-primary', !danger)
  if (!$('modal').open) $('modal').showModal()
  const first = $('modal-body').querySelector('input, select, textarea')
  if (first) first.focus()
}

function closeModal() {
  modalHandler = null
  if ($('modal').open) $('modal').close()
}

async function savePieza(id, formData) {
  const body = Object.fromEntries(formData.entries())
  if (id) await api.patch(`/piezas/${id}`, body)
  else await api.post('/piezas', body)
  toast(id ? 'Pieza actualizada' : 'Pieza registrada')
  await loadPiezas()
}

async function saveAuto(id, formData) {
  const body = Object.fromEntries(formData.entries())
  if (!isStaff()) delete body.usuario_id
  if (id) await api.patch(`/autos/${id}`, body)
  else await api.post('/autos', body)
  toast(id ? 'Auto actualizado' : 'Auto registrado')
  await loadAutos()
}

async function saveUsuario(id, formData) {
  const body = Object.fromEntries(formData.entries())
  if (!body.password) delete body.password
  const { data } = id ? await api.patch(`/usuarios/${id}`, body) : await api.post('/usuarios', body)
  if (data.id === state.user.id) {
    state.user = data
    applyRole()
    paintWho()
  }
  toast(id ? 'Usuario actualizado' : 'Usuario registrado')
  if (!isStaff()) showView('inicio')
  else await loadUsuarios()
}

function confirmDelete({ title, message, onConfirm }) {
  openModal({
    title,
    body: `<p>${message}</p>`,
    submitLabel: 'Eliminar',
    danger: true,
    onSubmit: onConfirm
  })
}

async function openCompat(autoId) {
  const [{ data: auto }, catalogo] = await Promise.all([
    api.get(`/autos/${autoId}`),
    api.get('/piezas')
  ])
  state.catalogo = catalogo.data
  renderCompat(auto)
}

function renderCompat(auto) {
  const linkedIds = new Set((auto.piezas || []).map((pieza) => pieza.id))
  const available = state.catalogo.filter((pieza) => !linkedIds.has(pieza.id))
  const linked = (auto.piezas || []).map((pieza) => `
    <li>
      <span><span class="code">${esc(pieza.codigo)}</span> ${esc(pieza.nombre)}</span>
      <button class="mini danger" type="button" data-action="unlink-pieza" data-auto="${esc(auto.id)}" data-id="${esc(pieza.id)}">Quitar</button>
    </li>
  `).join('')

  openModal({
    title: `Piezas de ${auto.marca} ${auto.modelo}`,
    footer: false,
    body: `
      ${linked ? `<ul class="compat-list">${linked}</ul>` : '<p class="muted">Este auto todavía no tiene piezas vinculadas.</p>'}
      <div class="link-row">
        <select id="link-pieza" ${available.length ? '' : 'disabled'}>
          ${available.length ? available.map((pieza) => `<option value="${esc(pieza.id)}">${esc(pieza.codigo)} · ${esc(pieza.nombre)}</option>`).join('') : '<option>No hay piezas disponibles</option>'}
        </select>
        <button class="btn btn-primary" type="button" data-action="link-pieza" data-auto="${esc(auto.id)}" ${available.length ? '' : 'disabled'}>Vincular</button>
      </div>
    `
  })
}

async function runAction(action, id, source) {
  try {
    await handleAction(action, id, source)
  } catch (error) {
    showFormError(error.message)
  }
}

async function handleAction(action, id, source) {
  if (action === 'goto-piezas') return showView('piezas')
  if (action === 'goto-autos') return showView('autos')
  if (action === 'goto-usuarios') return showView('usuarios')
  if (action === 'stock-bajo') {
    $('search-piezas').value = ''
    $('filter-categoria').value = ''
    $('filter-stock').value = 'bajo'
    return showView('piezas')
  }
  if (action === 'edit-pieza' || action === 'new-pieza') {
    const pieza = action === 'edit-pieza' ? state.piezas.find((item) => item.id === id) : null
    if (action === 'edit-pieza' && !pieza) return toast('No se encontró la pieza', 'error')
    return openModal({
      title: pieza ? 'Editar pieza' : 'Nueva pieza',
      body: piezaForm(pieza || {}),
      onSubmit: (formData) => savePieza(pieza?.id, formData)
    })
  }
  if (action === 'delete-pieza') {
    const pieza = state.piezas.find((item) => item.id === id)
    return confirmDelete({
      title: 'Eliminar pieza',
      message: `Se eliminará <strong>${esc(pieza?.nombre || 'esta pieza')}</strong> y sus vínculos con autos.`,
      onConfirm: async () => {
        await api.del(`/piezas/${id}`)
        toast('Pieza eliminada')
        await loadPiezas()
      }
    })
  }
  if (action === 'edit-auto' || action === 'new-auto') {
    const auto = action === 'edit-auto' ? state.autos.find((item) => item.id === id) : null
    if (action === 'edit-auto' && !auto) return toast('No se encontró el auto', 'error')
    const users = isStaff() ? (await api.get('/usuarios')).data : []
    state.usuarios = users
    return openModal({
      title: auto ? 'Editar auto' : 'Nuevo auto',
      body: autoForm(auto || {}, users),
      onSubmit: (formData) => saveAuto(auto?.id, formData)
    })
  }
  if (action === 'delete-auto') {
    const auto = state.autos.find((item) => item.id === id)
    return confirmDelete({
      title: 'Eliminar auto',
      message: `Se eliminará <strong>${esc(auto ? `${auto.marca} ${auto.modelo}` : 'este auto')}</strong>.`,
      onConfirm: async () => {
        await api.del(`/autos/${id}`)
        toast('Auto eliminado')
        await loadAutos()
      }
    })
  }
  if (action === 'compat-auto') return openCompat(id)
  if (action === 'link-pieza') {
    const piezaId = $('link-pieza')?.value
    if (!piezaId) return
    const { data } = await api.post(`/autos/${source.dataset.auto}/piezas`, { pieza_id: piezaId })
    toast('Pieza vinculada')
    renderCompat(data)
    return
  }
  if (action === 'unlink-pieza') {
    await api.del(`/autos/${source.dataset.auto}/piezas/${id}`)
    toast('Vínculo eliminado')
    const { data } = await api.get(`/autos/${source.dataset.auto}`)
    renderCompat(data)
    return
  }
  if (action === 'edit-usuario' || action === 'new-usuario') {
    const user = action === 'edit-usuario' ? state.usuarios.find((item) => item.id === id) : null
    if (action === 'edit-usuario' && !user) return toast('No se encontró el usuario', 'error')
    return openModal({
      title: user ? 'Editar usuario' : 'Nuevo usuario',
      body: usuarioForm(user || {}),
      onSubmit: (formData) => saveUsuario(user?.id, formData)
    })
  }
  if (action === 'delete-usuario') {
    const user = state.usuarios.find((item) => item.id === id)
    return confirmDelete({
      title: 'Eliminar usuario',
      message: `Se eliminará la cuenta de <strong>${esc(user?.nombre || 'este usuario')}</strong>. Sus autos quedarán sin propietario.`,
      onConfirm: async () => {
        await api.del(`/usuarios/${id}`)
        toast('Usuario eliminado')
        await loadUsuarios()
      }
    })
  }
}

function bind() {
  setUnauthorizedHandler(() => {
    state.user = null
    showAuth()
  })

  $('auth-switch').addEventListener('click', () => {
    setAuthMode(state.authMode === 'login' ? 'register' : 'login')
  })

  $('auth-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form).entries())
    if (state.authMode === 'login') {
      delete body.nombre
      delete body.telefono
    }
    const button = $('auth-submit')
    button.disabled = true
    try {
      const { data } = await api.post(state.authMode === 'register' ? '/auth/register' : '/auth/login', body)
      localStorage.setItem('token', data.token)
      state.user = data.user
      state.view = 'inicio'
      form.reset()
      enterApp()
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      button.disabled = false
    }
  })

  $('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token')
    state.user = null
    showAuth()
  })

  $('profile-btn').addEventListener('click', () => {
    openModal({
      title: 'Mi cuenta',
      body: profileForm(state.user),
      onSubmit: async (formData) => {
        const body = Object.fromEntries(formData.entries())
        if (!body.password) {
          delete body.password
          delete body.password_actual
        }
        const { data } = await api.patch('/auth/me', body)
        state.user = data
        paintWho()
        toast('Cuenta actualizada')
      }
    })
  })

  $('new-pieza').addEventListener('click', () => runAction('new-pieza'))
  $('new-auto').addEventListener('click', () => runAction('new-auto'))
  $('new-usuario').addEventListener('click', () => runAction('new-usuario'))

  document.body.addEventListener('click', async (event) => {
    const viewButton = event.target.closest('[data-view]')
    if (viewButton?.dataset.view && !event.target.closest('[data-action]')) {
      showView(viewButton.dataset.view)
      return
    }
    const button = event.target.closest('[data-action]')
    if (!button) return
    await runAction(button.dataset.action, button.dataset.id, button)
  })

  const searches = [
    ['search-piezas', loadPiezas],
    ['search-autos', loadAutos],
    ['search-usuarios', loadUsuarios]
  ]
  for (const [id, loader] of searches) {
    let timer
    $(id).addEventListener('input', () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (state.view === id.replace('search-', '')) loader()
      }, 280)
    })
  }
  $('filter-categoria').addEventListener('change', loadPiezas)
  $('filter-stock').addEventListener('change', loadPiezas)

  $('modal-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    if ($('modal-footer').hidden || !modalHandler) return
    $('modal-error').hidden = true
    const button = $('modal-submit')
    button.disabled = true
    try {
      await modalHandler(new FormData(event.currentTarget))
      closeModal()
    } catch (error) {
      showFormError(error.message)
    } finally {
      button.disabled = false
    }
  })
  $('modal-close').addEventListener('click', closeModal)
  $('modal-cancel').addEventListener('click', closeModal)
  $('modal').addEventListener('click', (event) => {
    if (event.target === $('modal')) closeModal()
  })
  $('modal').addEventListener('cancel', (event) => {
    event.preventDefault()
    closeModal()
  })
}

async function boot() {
  bind()
  try {
    const { data } = await api.get('/health')
    const missing = []
    if (!data.supabase) missing.push('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
    if (!data.jwt) missing.push('JWT_SECRET')
    if (missing.length) {
      $('config-banner').hidden = false
      $('config-banner').textContent = `Configura ${missing.join(' y ')} en el archivo .env antes de registrar datos.`
    }
  } catch (error) {
    $('config-banner').hidden = false
    $('config-banner').textContent = error.message
  }

  const token = localStorage.getItem('token')
  if (token) {
    try {
      const { data } = await api.get('/auth/me')
      state.user = data
      enterApp()
      return
    } catch {
      localStorage.removeItem('token')
    }
  }
  showAuth()
}

boot()
