// Pruebas de extremo a extremo (E2E) de DAASH ERP con Chrome headless.
// Requisitos: `npm run dev` corriendo en http://localhost:5173 y Google Chrome instalado.
// Uso: npm run test:e2e  → imprime PASA/FALLA por caso y escribe e2e/resultados.json
import fs from 'fs'
import puppeteer from 'puppeteer-core'

const URL_APP = process.env.APP_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: 1440, height: 900 } })
const p = await b.newPage()
const consola = []
p.on('pageerror', (e) => consola.push(e.message))
// Los 401/403/422 esperados se registran en consola como "Failed to load resource": se excluyen y se vigilan aparte las respuestas 5xx
p.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && consola.push(m.text()))
const errores5xx = []
p.on('response', (r) => r.status() >= 500 && errores5xx.push(`${r.status()} ${r.url()}`))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const go = async (r) => {
  await p.goto(URL_APP + r, { waitUntil: 'networkidle0' })
  await wait(600)
}
const click = async (t) => {
  const ok = await p.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].reverse().find((e) => e.textContent.trim().includes(t) && e.offsetParent && !e.disabled)
    el?.click()
    return !!el
  }, t)
  await wait(450)
  return ok
}
const texto = () => p.evaluate(() => document.body.innerText)
/** Ejecuta una función contra el estado de la aplicación (store) */
const estado = (fn) => p.evaluate(`(async () => { const s = window.__daash.getState(); return (${fn})(s) })()`)
const login = async (correo, pw) => {
  await p.evaluate(() => sessionStorage.clear())
  await go('/login')
  await p.type('input[type=email]', correo)
  await p.type('input[type=password]', pw)
  await click('Ingresar')
  await wait(1200)
}
const vender = async (indices, ccf) => {
  await go('/pos')
  if (await click('Abrir turno')) await wait(600)
  if (ccf) {
    await click('Crédito fiscal')
    await p.select('select', await estado("s => s.clientes.find(c => c.tipo === 'CONTRIBUYENTE').id"))
  }
  const cards = await p.$$('main button.card')
  for (const i of indices) {
    await cards[i].click()
    await wait(150)
  }
  await click('Cobrar')
  const t0 = Date.now()
  await click('Confirmar y emitir DTE')
  await p.waitForFunction(() => /Venta completada/.test(document.body.innerText), { timeout: 15000 })
  const ms = Date.now() - t0
  await click('Nueva venta')
  return ms
}

const casos = []
async function caso(id, nombre, fn) {
  const t = Date.now()
  let ok = false
  let detalle = ''
  try {
    const r = await fn()
    ok = r === true || (typeof r === 'object' && r?.ok === true)
    detalle = typeof r === 'object' && r?.detalle ? r.detalle : ''
  } catch (e) {
    detalle = String(e.message).slice(0, 120)
  }
  casos.push({ id, nombre, resultado: ok ? 'PASA' : 'FALLA', detalle, ms: Date.now() - t })
  console.log(`${ok ? 'PASA ' : 'FALLA'} ${id} ${nombre}${detalle ? ' · ' + detalle : ''}`)
}

// Reinicia la base de datos PostgreSQL con los datos demo para que cada corrida sea reproducible
const API = URL_APP + '/api'
const tokenGerente = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: 'gerente@adventureworks.com.sv', password: 'Gerente123*' }) })).json()).token
const reinicio = await fetch(API + '/configuracion/reiniciar-demo', { method: 'POST', headers: { Authorization: 'Bearer ' + tokenGerente } })
console.log('Base de datos reiniciada:', reinicio.status)
await go('/login')

await caso('E2E-01', 'Credenciales incorrectas muestran error y no inician sesión', async () => {
  await login('cajero@adventureworks.com.sv', 'incorrecta')
  return (await texto()).includes('Credenciales incorrectas') && p.url().endsWith('/login')
})
await caso('E2E-02', 'Bloqueo de cuenta tras 5 intentos fallidos (CA-04)', async () => {
  for (let i = 0; i < 5; i++) await login('bodega@adventureworks.com.sv', 'x')
  await login('bodega@adventureworks.com.sv', 'Bodega123*')
  return (await texto()).includes('bloqueada')
})
await caso('E2E-03', 'Recuperación de contraseña envía enlace temporal (RF-02)', async () => {
  await go('/recuperar')
  await p.type('input[type=email]', 'auditor@adventureworks.com.sv')
  await click('Enviar enlace')
  await wait(900)
  return (await texto()).includes('Abrir enlace')
})
await caso('E2E-04', 'Inicio de sesión de gerente con JWT (RF-01)', async () => {
  await login('gerente@adventureworks.com.sv', 'Gerente123*')
  return (await texto()).includes('Total facturado del mes')
})
await caso('E2E-05', 'POS bloqueado sin turno de caja abierto (RF-09)', async () => {
  await go('/pos')
  return (await texto()).includes('Caja cerrada')
})
const latencias = []
await caso('E2E-06', 'Venta con factura obtiene sello de recepción (RF-10, RF-13)', async () => {
  latencias.push(await vender([0, 16]))
  const d = await estado('s => s.dtes[0]')
  return { ok: d.estado === 'PROCESADO' && d.selloRecibido?.length === 40 && d.tipoDte === '01', detalle: d.numeroControl }
})
await caso('E2E-07', 'Descuento automático de stock y registro en Kardex (RF-07)', async () =>
  estado("s => { const v = s.ventas[0]; const k = s.kardex.filter(k => k.referencia.includes(s.dtes[0].numeroControl.slice(-6))); return k.length === v.items.length }"),
)
await caso('E2E-08', 'Venta con CCF a contribuyente (RF-16)', async () => {
  latencias.push(await vender([2], true))
  const d = await estado('s => s.dtes[0]')
  return { ok: d.tipoDte === '03' && d.estado === 'PROCESADO', detalle: d.numeroControl }
})
await caso('E2E-09', 'Venta en contingencia cuando el MH no responde (RF-14)', async () => {
  await estado("s => s.setMhEnLinea(false, 1, '')")
  await vender([5])
  const d = await estado('s => s.dtes[0]')
  return { ok: d.estado === 'CONTINGENCIA' && d.json.identificacion.tipoModelo === 2, detalle: 'tipoModelo=' + d.json.identificacion.tipoModelo }
})
await caso('E2E-10', 'Retransmisión automática al restablecer el servicio', async () => {
  await go('/contingencia')
  await click('Restablecer servicio')
  await wait(8000)
  await estado("s => s.refrescar('contingencia', 'dtes')")
  const r = await estado("s => ({ pendientes: s.dtes.filter(d => d.estado === 'CONTINGENCIA').length, evento: s.eventos[0]?.estado })")
  return { ok: r.pendientes === 0 && r.evento === 'TRANSMITIDO', detalle: JSON.stringify(r) }
})
await caso('E2E-11', 'Nota de crédito sobre CCF devuelve stock (RF-15)', async () => {
  const antes = await estado("s => { const d = s.dtes.find(d => d.tipoDte === '03' && d.estado === 'PROCESADO' && d.ventaId); const v = s.ventas.find(v => v.id === d.ventaId); return { id: d.id, pid: v.items[0].productoId, stock: s.productos.find(p => p.id === v.items[0].productoId).stock } }")
  const ok = await estado(`async s => { const v = s.ventas.find(v => v.dteId === '${antes.id}'); return (await s.emitirNotaCredito('${antes.id}', [{ ...v.items[0], cantidad: 1 }], () => {})).ok }`)
  const despues = await estado(`s => s.productos.find(p => p.id === '${antes.pid}').stock`)
  return { ok: ok && despues === antes.stock + 1, detalle: `stock ${antes.stock} → ${despues}` }
})
await caso('E2E-12', 'Invalidación bloqueada si el CCF tiene notas de crédito vigentes', async () =>
  estado("async s => { const d = s.dtes.find(d => d.notasCredito?.length); return !(await s.invalidarDte(d.id, 2, 'prueba')).ok }"),
)
await caso('E2E-13', 'Invalidación de factura con evento transmitido al MH', async () => {
  await estado("async s => { const d = s.dtes.find(d => d.tipoDte === '01' && d.estado === 'PROCESADO'); return (await s.invalidarDte(d.id, 2, 'prueba')).ok }")
  return estado("s => s.dtes.some(d => d.estado === 'INVALIDADO' && d.invalidacion?.selloRecibido)")
})
await caso('E2E-14', 'Generación del PDF del DTE con código QR', async () => {
  const n = await p.evaluate(async () => {
    const pdf = await import('/src/lib/pdf.ts')
    const s = window.__daash.getState()
    const doc = await pdf.generarPdfDte(s.dtes[0], s.config)
    return doc.output('arraybuffer').byteLength
  })
  return { ok: n > 20000, detalle: `${Math.round(n / 1024)} KB` }
})
await caso('E2E-15', 'Corte de caja Z cierra el turno (RF-12)', async () => {
  // Esperado: ventas del turno excluyendo documentos invalidados
  const esperado = await estado("s => { const t = s.turnoAbierto(); return s.ventas.filter(v => v.turnoId === t.id && s.dtes.find(d => d.id === v.dteId)?.estado !== 'INVALIDADO').length }")
  const t = await estado('s => s.cerrarTurno(1000)')
  return { ok: t?.estado === 'CERRADO' && t.resumen.transacciones === esperado && esperado > 0, detalle: `${t?.resumen?.transacciones} transacciones (esperadas ${esperado}, excluye invalidados)` }
})
await caso('E2E-16', 'Cajero no ve módulos de administración (RF-04)', async () => {
  await login('cajero@adventureworks.com.sv', 'Cajero123*')
  const t = await texto()
  return !t.includes('Roles y permisos') && !t.includes('Bitácora de auditoría')
})
await caso('E2E-17', 'Acceso directo por URL a un módulo sin permiso es denegado', async () => {
  await go('/usuarios')
  return (await texto()).includes('Acceso restringido')
})
await caso('E2E-18', 'Descuento sobre el límite exige autorización de gerente (RF-11)', async () => {
  await go('/pos')
  await click('Abrir turno')
  const c = await p.$$('main button.card')
  await c[0].click()
  await wait(200)
  const inp = await p.$('input[max="50"]')
  await inp.click({ clickCount: 3 })
  await inp.type('15')
  await wait(300)
  return (await texto()).includes('Solicitar autorización')
})
await caso('E2E-19', 'Token JWT alterado (rol cajero → gerente) es rechazado (CA-02)', async () => {
  await p.evaluate(() => {
    const t = sessionStorage.getItem('daash-token').split('.')
    const pl = JSON.parse(atob(t[1].replace(/-/g, '+').replace(/_/g, '/')))
    pl.rol = 'gerente'
    t[1] = btoa(JSON.stringify(pl)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    sessionStorage.setItem('daash-token', t.join('.'))
  })
  await go('/')
  return p.url().endsWith('/login')
})
await caso('E2E-21', 'Las operaciones quedan persistidas en PostgreSQL (visibles para otro usuario tras recargar)', async () => {
  await login('gerente@adventureworks.com.sv', 'Gerente123*')
  const r = await estado("s => ({ total: s.dtes.length, nc: s.dtes.filter(d => d.tipoDte === '05').length, inv: s.dtes.filter(d => d.estado === 'INVALIDADO').length })")
  return { ok: r.total >= 195 && r.nc >= 1 && r.inv >= 1, detalle: JSON.stringify(r) }
})
await caso('E2E-20', 'Sin errores de JavaScript ni respuestas 5xx del servidor durante la ejecución', async () => ({ ok: consola.length === 0 && errores5xx.length === 0, detalle: [...consola, ...errores5xx].slice(0, 2).join(' | ') }))

const pasan = casos.filter((c) => c.resultado === 'PASA').length
const resumen = { fecha: new Date().toISOString(), total: casos.length, pasan, fallan: casos.length - pasan, latencia_emision_ms: latencias, casos }
fs.writeFileSync(new URL('./resultados.json', import.meta.url), JSON.stringify(resumen, null, 2))
console.log(`\n${pasan}/${casos.length} casos aprobados · latencia de emisión DTE: ${latencias.join(', ')} ms`)
await b.close()
