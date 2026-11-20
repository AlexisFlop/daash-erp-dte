// Cliente HTTP de la API REST de DAASH ERP (Spring Boot). El token JWT vive en sessionStorage.
const BASE = import.meta.env.VITE_API_URL ?? '/api'
const CLAVE = 'daash-token'

export class ApiError extends Error {
  status: number
  errores: string[]
  constructor(status: number, mensaje: string, errores: string[] = []) {
    super(mensaje)
    this.status = status
    this.errores = errores
  }
}

export const token = {
  leer: () => sessionStorage.getItem(CLAVE),
  guardar: (t: string) => sessionStorage.setItem(CLAVE, t),
  borrar: () => sessionStorage.removeItem(CLAVE),
}

let alExpirar: (() => void) | null = null
export const onSesionExpirada = (fn: () => void) => (alExpirar = fn)

export async function api<T = unknown>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  const t = token.leer()
  let r: Response
  try {
    r = await fetch(BASE + ruta, {
      method: opciones.metodo ?? (opciones.cuerpo !== undefined ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
    })
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor', ['Verifique que el backend esté en ejecución'])
  }
  const texto = await r.text()
  const datos = texto ? JSON.parse(texto) : null
  if (!r.ok) {
    if (r.status === 401 && t && !ruta.startsWith('/auth/login')) alExpirar?.()
    throw new ApiError(r.status, datos?.mensaje ?? (r.status === 401 ? 'Sesión no válida' : r.status === 403 ? 'Acceso denegado' : 'Error del servidor'), datos?.errores ?? [])
  }
  return datos as T
}

export const get = <T,>(ruta: string) => api<T>(ruta)
export const post = <T,>(ruta: string, cuerpo: unknown = {}) => api<T>(ruta, { metodo: 'POST', cuerpo })
export const put = <T,>(ruta: string, cuerpo: unknown) => api<T>(ruta, { metodo: 'PUT', cuerpo })
export const patch = <T,>(ruta: string, cuerpo: unknown = {}) => api<T>(ruta, { metodo: 'PATCH', cuerpo })
export const del = <T,>(ruta: string) => api<T>(ruta, { metodo: 'DELETE' })
