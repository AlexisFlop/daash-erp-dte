import { b64url, fromB64url } from './utils'

/** Llave HS256 de demostración. En producción vive en el backend (Spring Security) y nunca en el cliente. */
const SECRET = 'daash-devs-hs256-demo-secret-2026'
const SESSION_KEY = 'daash-session'
const HORAS_SESION = 8

export interface JwtPayload {
  sub: string
  nombre: string
  rol: string
  iat: number
  exp: number
  iss: string
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))
}

export async function emitirJwt(sub: string, nombre: string, rol: string) {
  const iat = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ sub, nombre, rol, iat, exp: iat + HORAS_SESION * 3600, iss: 'daash-erp' } satisfies JwtPayload))
  return `${header}.${payload}.${await hmac(`${header}.${payload}`)}`
}

/** Verificación estricta de la firma (CA-02: escalamiento de privilegios alterando el token) */
export async function verificarJwt(token: string): Promise<JwtPayload | null> {
  const [h, p, s] = token.split('.')
  if (!h || !p || !s) return null
  if ((await hmac(`${h}.${p}`)) !== s) return null
  try {
    const payload = JSON.parse(fromB64url(p)) as JwtPayload
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const guardarSesion = (t: string) => sessionStorage.setItem(SESSION_KEY, t)
export const leerSesion = () => sessionStorage.getItem(SESSION_KEY)
export const borrarSesion = () => sessionStorage.removeItem(SESSION_KEY)

export const MAX_INTENTOS = 5
export const MINUTOS_BLOQUEO = 15
export const MINUTOS_TOKEN_RESET = 15

export function politicaPassword(pw: string) {
  return [
    { ok: pw.length >= 8, texto: 'Mínimo 8 caracteres' },
    { ok: /[A-Z]/.test(pw), texto: 'Una letra mayúscula' },
    { ok: /\d/.test(pw), texto: 'Un número' },
    { ok: /[^A-Za-z0-9]/.test(pw), texto: 'Un carácter especial' },
  ]
}
