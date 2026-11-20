// Estado del cliente: caché de la API REST de DAASH ERP (Spring Boot + PostgreSQL).
// Las reglas de negocio, el cálculo fiscal, la firma de DTE y la contingencia se ejecutan en el servidor.
import { create } from 'zustand'
import { toast } from '../components/ui'
import { ApiError, del, get, onSesionExpirada, patch, post, put, token } from './api'
import type {
  Accion, Bitacora, Cliente, Compra, Config, CorreoSimulado, Dte, EventoContingencia, ItemCompra, ItemVenta, MetodoPago, Modulo, MovKardex,
  Producto, Proveedor, Rol, Turno, Usuario, Venta,
} from './types'

export type PasoEmision = 'validando' | 'generando' | 'firmando' | 'transmitiendo' | 'procesado' | 'contingencia' | 'rechazado'

export interface ResultadoEmision {
  ok: boolean
  errores?: string[]
  dte?: Dte
  venta?: Venta
}

interface Sesion {
  usuario: Usuario
  rol: Rol
}

interface Datos {
  usuarios: Usuario[]
  roles: Rol[]
  productos: Producto[]
  kardex: MovKardex[]
  clientes: Cliente[]
  proveedores: Proveedor[]
  compras: Compra[]
  turnos: Turno[]
  turnoActual: Turno | null
  ventas: Venta[]
  dtes: Dte[]
  eventos: EventoContingencia[]
  bitacora: Bitacora[]
  correos: CorreoSimulado[]
  config: Config
}

type Coleccion = 'usuarios' | 'roles' | 'productos' | 'kardex' | 'clientes' | 'proveedores' | 'compras' | 'turnos' | 'turnoActual' | 'ventas' | 'dtes' | 'contingencia' | 'bitacora' | 'correos'

interface Estado extends Datos {
  sesion: Sesion | null
  sesionVerificada: boolean
  cargando: boolean

  // Sesión
  restaurarSesion: () => Promise<void>
  login: (correo: string, password: string) => Promise<{ ok: boolean; mensaje?: string }>
  logout: () => void
  solicitarReset: (correo: string) => Promise<void>
  validarResetToken: (token: string) => Promise<{ expira: string } | null>
  restablecerPassword: (token: string, password: string) => Promise<boolean>
  cambiarPassword: (actual: string, nueva: string) => Promise<boolean>
  verificarCredencialAutorizador: (correo: string, password: string) => Promise<{ id: string; nombre: string } | null>
  refrescar: (...c: Coleccion[]) => Promise<void>

  // Utilidades
  usuarioActual: () => Usuario | undefined
  rolActual: () => Rol | undefined
  puede: (m: Modulo, a?: Accion) => boolean

  // Usuarios / roles
  guardarUsuario: (u: Partial<Usuario> & { password?: string }) => Promise<boolean>
  toggleUsuario: (id: string) => Promise<boolean>
  guardarRol: (r: Rol) => Promise<boolean>
  eliminarRol: (id: string) => Promise<boolean>

  // Inventario
  guardarProducto: (p: Producto) => Promise<boolean>
  toggleProducto: (id: string) => Promise<boolean>
  ajustarInventario: (productoId: string, cantidad: number, tipo: 'AJUSTE_POS' | 'AJUSTE_NEG', justificacion: string) => Promise<boolean>

  // Terceros y compras
  guardarCliente: (c: Cliente) => Promise<Cliente | null>
  toggleCliente: (id: string) => Promise<boolean>
  guardarProveedor: (p: Proveedor) => Promise<boolean>
  toggleProveedor: (id: string) => Promise<boolean>
  registrarCompra: (c: { proveedorId: string; numeroComprobante: string; fecha: string; items: ItemCompra[] }) => Promise<boolean>

  // Caja
  turnoAbierto: () => Turno | undefined
  abrirTurno: (fondo: number, caja: string) => Promise<boolean>
  cerrarTurno: (efectivoContado: number) => Promise<Turno | undefined>

  // Ventas y DTE
  emitirVenta: (
    v: { items: ItemVenta[]; descuentoPct: number; autorizacion?: { correo: string; password: string }; clienteId?: string; tipoDte: '01' | '03'; metodoPago: MetodoPago; recibido?: number },
    onPaso: (p: PasoEmision) => void,
  ) => Promise<ResultadoEmision>
  retransmitirDte: (id: string) => Promise<Dte | undefined>
  invalidarDte: (id: string, tipo: 1 | 2 | 3, motivo: string) => Promise<{ ok: boolean; mensaje?: string }>
  emitirNotaCredito: (dteId: string, items: ItemVenta[], onPaso: (p: PasoEmision) => void) => Promise<ResultadoEmision>
  enviarCorreoDte: (id: string, para: string) => Promise<boolean>

  // Contingencia
  setMhEnLinea: (enLinea: boolean, tipo?: number, motivo?: string) => Promise<boolean>
  ejecutarReintento: (manual?: boolean) => Promise<{ transmitidos: number; fallo: boolean }>
  eventoActivo: () => EventoContingencia | undefined

  // Configuración
  actualizarConfig: (c: Partial<Config>) => Promise<boolean>
  restablecerDemo: () => Promise<boolean>
  marcarCorreoLeido: (id: string) => Promise<void>
}

const CONFIG_VACIA = {
  emisor: { nit: '', nrc: '', nombre: '', nombreComercial: '', codActividad: '', descActividad: '', tipoEstablecimiento: '01', direccion: { departamento: '06', municipio: '20', complemento: '' }, telefono: '', correo: '', codEstable: 'M001', codPuntoVenta: 'P001' },
  ambiente: '00', mhEnLinea: true, simularRechazo: false, latenciaMs: 700, descuentoBase: 10, modoDemo: true, correlativos: { '01': 0, '03': 0, '05': 0 },
} as Config

const VACIO: Datos = {
  usuarios: [], roles: [], productos: [], kardex: [], clientes: [], proveedores: [], compras: [], turnos: [], turnoActual: null, ventas: [], dtes: [], eventos: [],
  bitacora: [], correos: [], config: CONFIG_VACIA,
}

/** Muestra el error de la API y devuelve el valor por defecto */
function fallo<T>(e: unknown, def: T, titulo = 'No se pudo completar la operación'): T {
  if (e instanceof ApiError) toast.error(e.status === 403 ? 'Acceso denegado' : e.message, e.errores.length ? e.errores.join(' · ') : e.status === 403 ? 'Tu rol no tiene permiso para esta acción' : undefined)
  else toast.error(titulo)
  return def
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const useStore = create<Estado>()((set, get_) => {
  const puede = (m: Modulo, a: Accion = 'r') => !!get_().sesion?.rol.permisos[m]?.[a]
  const alguno = (...p: [Modulo, Accion][]) => p.some(([m, a]) => puede(m, a))

  /** Carga una colección si el rol tiene permiso; si no, la deja vacía */
  const cargadores: Record<Coleccion, () => Promise<Partial<Datos>>> = {
    usuarios: async () => ({ usuarios: puede('usuarios') ? await get<Usuario[]>('/usuarios') : await get<Usuario[]>('/usuarios/directorio') }),
    roles: async () => ({ roles: await get<Rol[]>('/roles') }),
    productos: async () => ({ productos: alguno(['inventario', 'r'], ['pos', 'r'], ['dashboard', 'r'], ['reportes', 'r'], ['compras', 'r']) ? await get<Producto[]>('/productos') : [] }),
    kardex: async () => ({ kardex: puede('inventario') ? await get<MovKardex[]>('/kardex') : [] }),
    clientes: async () => ({ clientes: alguno(['clientes', 'r'], ['pos', 'r'], ['dte', 'r'], ['reportes', 'r']) ? await get<Cliente[]>('/clientes') : [] }),
    proveedores: async () => ({ proveedores: alguno(['proveedores', 'r'], ['compras', 'r'], ['reportes', 'r']) ? await get<Proveedor[]>('/proveedores') : [] }),
    compras: async () => ({ compras: alguno(['compras', 'r'], ['reportes', 'r']) ? await get<Compra[]>('/compras') : [] }),
    turnos: async () => ({ turnos: alguno(['caja', 'r'], ['dashboard', 'r']) ? await get<Turno[]>('/turnos') : [] }),
    turnoActual: async () => ({ turnoActual: alguno(['caja', 'r'], ['pos', 'r']) ? (await get<{ turno: Turno | null }>('/turnos/actual')).turno : null }),
    ventas: async () => ({ ventas: alguno(['dashboard', 'r'], ['pos', 'r'], ['caja', 'r'], ['dte', 'r'], ['reportes', 'r']) ? await get<Venta[]>('/ventas') : [] }),
    dtes: async () => ({ dtes: alguno(['dte', 'r'], ['dashboard', 'r'], ['reportes', 'r'], ['contingencia', 'r']) ? await get<Dte[]>('/dtes') : [] }),
    contingencia: async () => {
      const r = await get<{ config: Config; eventos: EventoContingencia[] }>('/contingencia')
      return { config: r.config, eventos: r.eventos }
    },
    bitacora: async () => ({ bitacora: puede('auditoria') ? await get<Bitacora[]>('/bitacora') : [] }),
    correos: async () => ({ correos: await get<CorreoSimulado[]>('/correos') }),
  }

  const refrescar = async (...c: Coleccion[]) => {
    const lista = c.length ? c : (Object.keys(cargadores) as Coleccion[])
    const partes = await Promise.all(lista.map((k) => cargadores[k]().catch(() => ({}))))
    set(Object.assign({}, ...partes))
  }

  const iniciarSesion = async (sesion: Sesion) => {
    set({ sesion, cargando: true })
    await refrescar()
    set({ cargando: false })
  }

  onSesionExpirada(() => {
    token.borrar()
    set({ sesion: null, ...VACIO })
  })

  return {
    ...VACIO,
    sesion: null,
    sesionVerificada: false,
    cargando: false,
    refrescar,

    // ---------------- SESIÓN ----------------
    restaurarSesion: async () => {
      if (!token.leer()) return set({ sesionVerificada: true })
      try {
        const s = await get<Sesion>('/auth/me')
        await iniciarSesion(s)
      } catch {
        token.borrar()
      }
      set({ sesionVerificada: true })
    },

    login: async (correo, password) => {
      try {
        const r = await post<Sesion & { token: string }>('/auth/login', { correo, password })
        token.guardar(r.token)
        await iniciarSesion({ usuario: r.usuario, rol: r.rol })
        return { ok: true }
      } catch (e) {
        return { ok: false, mensaje: e instanceof ApiError ? e.message : 'No hay conexión con el servidor' }
      }
    },

    logout: () => {
      token.borrar()
      set({ sesion: null, ...VACIO })
    },

    solicitarReset: async (correo) => {
      await post('/auth/recuperar', { correo }).catch(() => undefined)
      // La bandeja simulada es visible sin sesión solo en desarrollo: se consulta con el enlace del correo
    },

    validarResetToken: async (t) => {
      try {
        return await get<{ expira: string }>(`/auth/restablecer/${t}`)
      } catch {
        return null
      }
    },

    restablecerPassword: async (t, password) => {
      try {
        await post(`/auth/restablecer/${t}`, { password })
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },

    cambiarPassword: async (actual, nueva) => {
      try {
        await post('/auth/cambiar-password', { actual, nueva })
        return true
      } catch {
        return false
      }
    },

    verificarCredencialAutorizador: async (correo, password) => {
      try {
        return await post<{ id: string; nombre: string }>('/auth/autorizar-descuento', { correo, password })
      } catch {
        return null
      }
    },

    usuarioActual: () => get_().sesion?.usuario,
    rolActual: () => get_().sesion?.rol,
    puede,

    // ---------------- USUARIOS / ROLES ----------------
    guardarUsuario: async ({ id, nombre, correo, dui, rolId, sucursal, password }) => {
      try {
        const cuerpo = { nombre, correo, dui, rolId, sucursal, password }
        if (id) await put(`/usuarios/${id}`, cuerpo)
        else await post('/usuarios', cuerpo)
        await refrescar('usuarios')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    toggleUsuario: async (id) => {
      try {
        await patch(`/usuarios/${id}/estado`)
        await refrescar('usuarios')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    guardarRol: async (r) => {
      try {
        const existe = get_().roles.some((x) => x.id === r.id)
        if (existe) await put(`/roles/${r.id}`, r)
        else await post('/roles', r)
        await refrescar('roles')
        // Si se editó el rol propio, se actualizan los permisos de la sesión
        const s = get_().sesion
        if (s && s.rol.id === r.id) set({ sesion: { ...s, rol: get_().roles.find((x) => x.id === r.id) ?? s.rol } })
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    eliminarRol: async (id) => {
      try {
        await del(`/roles/${id}`)
        await refrescar('roles')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },

    // ---------------- INVENTARIO ----------------
    guardarProducto: async (p) => {
      try {
        if (p.id) await put(`/productos/${p.id}`, p)
        else await post('/productos', p)
        await refrescar('productos', 'kardex')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    toggleProducto: async (id) => {
      try {
        await patch(`/productos/${id}/estado`)
        await refrescar('productos')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    ajustarInventario: async (productoId, cantidad, tipo, justificacion) => {
      try {
        await post(`/productos/${productoId}/ajuste`, { cantidad, tipo, justificacion })
        await refrescar('productos', 'kardex')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },

    // ---------------- TERCEROS / COMPRAS ----------------
    guardarCliente: async (c) => {
      try {
        const r = c.id ? await put<Cliente>(`/clientes/${c.id}`, c) : await post<Cliente>('/clientes', { ...c, id: undefined })
        await refrescar('clientes')
        return r
      } catch (e) {
        return fallo(e, null)
      }
    },
    toggleCliente: async (id) => {
      try {
        await patch(`/clientes/${id}/estado`)
        await refrescar('clientes')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    guardarProveedor: async (p) => {
      try {
        if (p.id) await put(`/proveedores/${p.id}`, p)
        else await post('/proveedores', { ...p, id: undefined })
        await refrescar('proveedores')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    toggleProveedor: async (id) => {
      try {
        await patch(`/proveedores/${id}/estado`)
        await refrescar('proveedores')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    registrarCompra: async (c) => {
      try {
        await post('/compras', c)
        await refrescar('compras', 'productos', 'kardex')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },

    // ---------------- CAJA ----------------
    turnoAbierto: () => get_().turnoActual ?? undefined,
    abrirTurno: async (fondoInicial, caja) => {
      try {
        await post('/turnos/abrir', { fondoInicial, caja })
        await refrescar('turnoActual', 'turnos')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    cerrarTurno: async (efectivoContado) => {
      try {
        const t = await post<Turno>('/turnos/cerrar', { efectivoContado })
        await refrescar('turnoActual', 'turnos')
        return t
      } catch (e) {
        return fallo(e, undefined)
      }
    },

    // ---------------- VENTAS / DTE ----------------
    emitirVenta: async (v, onPaso) => {
      // Los pasos se muestran mientras el servidor valida, genera, firma y transmite el DTE
      const pasos: PasoEmision[] = ['validando', 'generando', 'firmando', 'transmitiendo']
      let i = 0
      onPaso(pasos[0])
      const timer = setInterval(() => i < pasos.length - 1 && onPaso(pasos[++i]), 380)
      try {
        const r = await post<{ dte: Dte; venta: Venta }>('/ventas', {
          items: v.items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad })),
          descuentoPct: v.descuentoPct, clienteId: v.clienteId, tipoDte: v.tipoDte, metodoPago: v.metodoPago, recibido: v.recibido, autorizacion: v.autorizacion,
        })
        clearInterval(timer)
        await espera(250)
        await refrescar('ventas', 'dtes', 'productos', 'kardex', 'contingencia', 'turnoActual')
        onPaso(r.dte.estado === 'PROCESADO' ? 'procesado' : r.dte.estado === 'RECHAZADO' ? 'rechazado' : 'contingencia')
        return { ok: true, dte: r.dte, venta: r.venta }
      } catch (e) {
        clearInterval(timer)
        return { ok: false, errores: e instanceof ApiError ? (e.errores.length ? e.errores : [e.message]) : ['No hay conexión con el servidor'] }
      }
    },

    retransmitirDte: async (id) => {
      try {
        const d = await post<Dte>(`/dtes/${id}/retransmitir`)
        await refrescar('dtes')
        return d
      } catch (e) {
        return fallo(e, undefined)
      }
    },

    invalidarDte: async (id, tipo, motivo) => {
      try {
        await post(`/dtes/${id}/invalidar`, { tipo, motivo })
        await refrescar('dtes', 'productos', 'kardex')
        return { ok: true }
      } catch (e) {
        return { ok: false, mensaje: e instanceof ApiError ? e.message : 'Error de conexión' }
      }
    },

    emitirNotaCredito: async (dteId, items, onPaso) => {
      onPaso('validando')
      const timer = setTimeout(() => onPaso('firmando'), 400)
      try {
        const r = await post<{ dte: Dte }>(`/dtes/${dteId}/nota-credito`, { items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })) })
        clearTimeout(timer)
        await refrescar('dtes', 'productos', 'kardex', 'contingencia')
        onPaso(r.dte.estado === 'PROCESADO' ? 'procesado' : 'contingencia')
        return { ok: true, dte: r.dte }
      } catch (e) {
        clearTimeout(timer)
        return { ok: false, errores: e instanceof ApiError ? (e.errores.length ? e.errores : [e.message]) : ['Error de conexión'] }
      }
    },

    enviarCorreoDte: async (id, para) => {
      try {
        await post(`/dtes/${id}/correo`, { para })
        await refrescar('dtes', 'correos')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },

    // ---------------- CONTINGENCIA ----------------
    eventoActivo: () => get_().eventos.find((e) => e.estado === 'ACTIVO'),

    setMhEnLinea: async (enLinea, tipo = 1, motivo = '') => {
      try {
        await post('/contingencia/mh', { enLinea, tipo, motivo })
        await refrescar('contingencia', 'dtes')
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },

    ejecutarReintento: async () => {
      try {
        const r = await post<{ transmitidos: number; fallo: boolean }>('/contingencia/reintentar')
        await refrescar('contingencia', 'dtes')
        return r
      } catch (e) {
        return fallo(e, { transmitidos: 0, fallo: true })
      }
    },

    // ---------------- CONFIGURACIÓN ----------------
    actualizarConfig: async (c) => {
      try {
        const cfg = await put<Config>('/configuracion', c)
        set({ config: cfg })
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    restablecerDemo: async () => {
      try {
        await post('/configuracion/reiniciar-demo')
        token.borrar()
        set({ sesion: null, ...VACIO })
        return true
      } catch (e) {
        return fallo(e, false)
      }
    },
    marcarCorreoLeido: async (id) => {
      set((s) => ({ correos: s.correos.map((c) => (c.id === id ? { ...c, leido: true } : c)) }))
      await patch(`/correos/${id}/leido`).catch(() => undefined)
    },
  }
})

// Gancho de pruebas: expone la instancia viva del store a las pruebas E2E (solo en desarrollo)
if (import.meta.env.DEV) (window as unknown as { __daash: typeof useStore }).__daash = useStore
