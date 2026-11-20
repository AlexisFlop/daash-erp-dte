export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const money = (n: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n || 0)

export const num = (n: number) => new Intl.NumberFormat('es-SV').format(n)

export const uid = () => crypto.randomUUID()

/** Código de generación MH: UUID v4 en mayúsculas */
export const codigoGeneracion = () => crypto.randomUUID().toUpperCase()

export const pad = (n: number | string, len: number) => String(n).padStart(len, '0')

export const fechaISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`

export const horaISO = (d = new Date()) =>
  `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`

/** Formato de respuesta MH dd/MM/yyyy HH:mm:ss */
export const fhMH = (d = new Date()) =>
  `${pad(d.getDate(), 2)}/${pad(d.getMonth() + 1, 2)}/${d.getFullYear()} ${horaISO(d)}`

export const fmtFecha = (iso: string, conHora = false) => {
  const d = new Date(iso)
  return d.toLocaleString('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export const tiempoRelativo = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

/** Sello de recepción simulado (40 caracteres, inicia con el año) */
export const generarSello = (d = new Date()) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = String(d.getFullYear())
  const rnd = crypto.getRandomValues(new Uint8Array(36))
  rnd.forEach((b) => (s += chars[b % chars.length]))
  return s
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const b64url = (input: string | ArrayBuffer) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function descargar(nombre: string, contenido: string | Blob, tipo = 'application/json') {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------- Número a letras (para totalLetras) ----------
const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function centenas(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const r = n % 100
  let s = C[c]
  if (r > 0) {
    s += s ? ' ' : ''
    if (r < 30) s += U[r]
    else s += D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : '')
  }
  return s
}

export function numeroALetras(monto: number) {
  const entero = Math.floor(monto)
  const cent = Math.round((monto - entero) * 100)
  const millones = Math.floor(entero / 1_000_000)
  const miles = Math.floor((entero % 1_000_000) / 1000)
  const resto = entero % 1000
  let s = ''
  if (millones) s += millones === 1 ? 'UN MILLÓN ' : centenas(millones) + ' MILLONES '
  if (miles) s += miles === 1 ? 'MIL ' : centenas(miles).replace(/UNO$/, 'UN') + ' MIL '
  if (resto) s += centenas(resto)
  if (!s.trim()) s = 'CERO'
  return `${s.trim().replace(/UNO$/, 'UN')} ${pad(cent, 2)}/100 USD`
}

// ---------- Validaciones fiscales El Salvador ----------
/** DUI: 00000000-0 con dígito verificador */
export function validarDUI(dui: string) {
  if (!/^\d{8}-\d$/.test(dui)) return false
  const d = dui.replace('-', '').split('').map(Number)
  const suma = d.slice(0, 8).reduce((acc, v, i) => acc + v * (9 - i), 0)
  return (10 - (suma % 10)) % 10 === d[8]
}

/** NIT: 0000-000000-000-0 (14 dígitos) o DUI homologado */
export const validarNIT = (nit: string) => /^\d{4}-\d{6}-\d{3}-\d$/.test(nit) || validarDUI(nit)

/** NRC: 1 a 6 dígitos, guion y dígito verificador */
export const validarNRC = (nrc: string) => /^\d{1,6}-\d$/.test(nrc)

export const validarCorreo = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)

/** Calcula el dígito verificador para generar DUIs válidos en datos demo */
export function completarDUI(ocho: string) {
  const d = ocho.split('').map(Number)
  const suma = d.reduce((acc, v, i) => acc + v * (9 - i), 0)
  return `${ocho}-${(10 - (suma % 10)) % 10}`
}

export const soloDigitos = (s: string) => s.replace(/\D/g, '')
