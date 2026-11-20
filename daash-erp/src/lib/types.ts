export type Modulo =
  | 'dashboard'
  | 'pos'
  | 'caja'
  | 'dte'
  | 'contingencia'
  | 'inventario'
  | 'compras'
  | 'proveedores'
  | 'clientes'
  | 'reportes'
  | 'usuarios'
  | 'roles'
  | 'auditoria'
  | 'configuracion'

export type Accion = 'c' | 'r' | 'u' | 'd'
export type Permisos = Record<Modulo, Record<Accion, boolean>>

export interface Rol {
  id: string
  nombre: string
  descripcion: string
  permisos: Permisos
  sistema: boolean
  /** Puede autorizar descuentos sobre el límite base */
  autorizaDescuentos: boolean
}

export interface Usuario {
  id: string
  nombre: string
  correo: string
  passwordHash?: string
  rolId: string
  sucursal: string
  dui: string
  activo: boolean
  creado: string
  intentosFallidos: number
  bloqueadoHasta?: string
  ultimoAcceso?: string
}

export interface Producto {
  id: string
  sku: string
  codigoBarras: string
  nombre: string
  descripcion: string
  categoria: string
  /** Precio unitario SIN IVA */
  precio: number
  costo: number
  stock: number
  stockMinimo: number
  activo: boolean
}

export type TipoKardex = 'INICIAL' | 'ENTRADA' | 'SALIDA' | 'AJUSTE_POS' | 'AJUSTE_NEG' | 'DEVOLUCION'

export interface MovKardex {
  id: string
  fecha: string
  productoId: string
  tipo: TipoKardex
  cantidad: number
  saldo: number
  costoUnit: number
  referencia: string
  justificacion?: string
  usuarioId: string
}

export interface Direccion {
  departamento: string
  municipio: string
  complemento: string
}

export interface Cliente {
  id: string
  tipo: 'CONSUMIDOR' | 'CONTRIBUYENTE'
  nombre: string
  nombreComercial?: string
  tipoDocumento: '13' | '36' // 13 DUI, 36 NIT (CAT-022)
  numDocumento: string
  nrc?: string
  codActividad?: string
  descActividad?: string
  correo: string
  telefono: string
  direccion: Direccion
  activo: boolean
  creado: string
}

export interface Proveedor {
  id: string
  razonSocial: string
  nit: string
  nrc: string
  contacto: string
  telefono: string
  correo: string
  activo: boolean
}

export interface ItemCompra {
  productoId: string
  cantidad: number
  costoUnit: number
}

export interface Compra {
  id: string
  fecha: string
  proveedorId: string
  numeroComprobante: string
  items: ItemCompra[]
  subtotal: number
  iva: number
  total: number
  usuarioId: string
}

export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'

export interface Turno {
  id: string
  usuarioId: string
  caja: string
  apertura: string
  fondoInicial: number
  cierre?: string
  efectivoContado?: number
  estado: 'ABIERTO' | 'CERRADO'
  resumen?: ResumenTurno
}

export interface ResumenTurno {
  ventas: number
  transacciones: number
  porMetodo: Record<MetodoPago, number>
  esperadoEfectivo: number
  diferencia: number
}

export interface ItemVenta {
  productoId: string
  sku: string
  nombre: string
  cantidad: number
  /** Precio sin IVA */
  precio: number
}

export type TipoDte = '01' | '03' | '05'

export interface Venta {
  id: string
  fecha: string
  turnoId: string
  usuarioId: string
  clienteId?: string
  tipoDte: '01' | '03'
  items: ItemVenta[]
  descuentoPct: number
  autorizadoPor?: string
  metodoPago: MetodoPago
  subtotal: number
  descuento: number
  iva: number
  total: number
  recibido?: number
  cambio?: number
  dteId: string
}

export type EstadoDte = 'PROCESADO' | 'CONTINGENCIA' | 'RECHAZADO' | 'INVALIDADO'

export interface RespuestaMH {
  version: number
  ambiente: string
  versionApp: number
  estado: 'PROCESADO' | 'RECHAZADO'
  codigoGeneracion: string
  selloRecibido: string | null
  fhProcesamiento: string
  clasificaMsg: string
  codigoMsg: string
  descripcionMsg: string
  observaciones: string[]
}

export interface Dte {
  id: string // = codigoGeneracion (mayúsculas)
  tipoDte: TipoDte
  numeroControl: string
  fechaEmi: string
  horaEmi: string
  creado: string
  ventaId?: string
  clienteId?: string
  receptorNombre: string
  total: number
  iva: number
  estado: EstadoDte
  selloRecibido?: string
  fhProcesamiento?: string
  json: Record<string, unknown>
  firma: string
  respuesta?: RespuestaMH
  intentos: number
  ultimoIntento?: string
  eventoContingenciaId?: string
  /** Para notas de crédito: DTE original */
  relacionadoId?: string
  /** NC emitidas sobre este DTE */
  notasCredito?: string[]
  invalidacion?: Invalidacion
  correoEnviado?: string
  usuarioId: string
}

export interface Invalidacion {
  fecha: string
  tipoAnulacion: 1 | 2 | 3
  motivo: string
  responsable: string
  json: Record<string, unknown>
  selloRecibido: string
}

export interface EventoContingencia {
  id: string
  fInicio: string
  fFin?: string
  tipoContingencia: number
  motivo: string
  dtes: string[]
  estado: 'ACTIVO' | 'PENDIENTE_ENVIO' | 'TRANSMITIDO'
  selloRecibido?: string
  json?: Record<string, unknown>
  usuarioId: string
}

export interface Bitacora {
  id: string
  fecha: string
  usuarioId: string
  modulo: Modulo | 'auth'
  accion: string
  detalle: string
  nivel: 'info' | 'ok' | 'warn' | 'error'
}

export interface Emisor {
  nit: string
  nrc: string
  nombre: string
  nombreComercial: string
  codActividad: string
  descActividad: string
  tipoEstablecimiento: string
  direccion: Direccion
  telefono: string
  correo: string
  codEstable: string
  codPuntoVenta: string
}

export interface Config {
  emisor: Emisor
  ambiente: '00' | '01'
  mhEnLinea: boolean
  simularRechazo: boolean
  latenciaMs: number
  descuentoBase: number
  modoDemo: boolean
  correlativos: Record<TipoDte, number>
  proximoReintento?: string
}

export interface CorreoSimulado {
  id: string
  fecha: string
  para: string
  asunto: string
  cuerpo: string
  enlace?: string
  adjuntos?: string[]
  leido?: boolean
}
