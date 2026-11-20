import type { MetodoPago, Modulo, TipoDte } from './types'

/** CAT-002 Tipo de documento (extracto) */
export const TIPOS_DTE: Record<TipoDte, { nombre: string; corto: string; version: number; esquema: string }> = {
  '01': { nombre: 'Factura', corto: 'FAC', version: 1, esquema: 'fe-fc-v1' },
  '03': { nombre: 'Comprobante de Crédito Fiscal', corto: 'CCF', version: 3, esquema: 'fe-ccf-v3' },
  '05': { nombre: 'Nota de Crédito', corto: 'NC', version: 3, esquema: 'fe-nc-v3' },
}

/** CAT-005 Tipo de contingencia */
export const TIPOS_CONTINGENCIA: Record<number, string> = {
  1: 'No disponibilidad de sistema del MH',
  2: 'No disponibilidad de sistema del emisor',
  3: 'Falla en el suministro de servicio de Internet del Emisor',
  4: 'Falla en el suministro de servicio de energía eléctrica del emisor',
  5: 'Otro (especificar motivo)',
}

/** CAT-024 Tipo de invalidación */
export const TIPOS_INVALIDACION: Record<1 | 2 | 3, string> = {
  1: 'Error en la información del DTE a invalidar',
  2: 'Rescindir de la operación realizada',
  3: 'Otro',
}

/** CAT-017 Forma de pago */
export const FORMAS_PAGO: Record<MetodoPago, { codigo: string; nombre: string }> = {
  EFECTIVO: { codigo: '01', nombre: 'Billetes y monedas' },
  TARJETA: { codigo: '02', nombre: 'Tarjeta débito / crédito' },
  TRANSFERENCIA: { codigo: '05', nombre: 'Transferencia - depósito bancario' },
}

/** CAT-012 Departamentos y CAT-013 municipios (extracto) */
export const DEPARTAMENTOS: Record<string, { nombre: string; municipios: Record<string, string> }> = {
  '01': { nombre: 'Ahuachapán', municipios: { '13': 'Ahuachapán Centro', '14': 'Ahuachapán Sur' } },
  '02': { nombre: 'Santa Ana', municipios: { '14': 'Santa Ana Centro', '15': 'Santa Ana Este' } },
  '03': { nombre: 'Sonsonate', municipios: { '17': 'Sonsonate Centro', '18': 'Sonsonate Este' } },
  '04': { nombre: 'Chalatenango', municipios: { '34': 'Chalatenango Centro' } },
  '05': { nombre: 'La Libertad', municipios: { '23': 'La Libertad Centro', '24': 'La Libertad Este', '25': 'La Libertad Sur' } },
  '06': { nombre: 'San Salvador', municipios: { '20': 'San Salvador Centro', '21': 'San Salvador Norte', '22': 'San Salvador Sur', '23': 'San Salvador Este' } },
  '07': { nombre: 'Cuscatlán', municipios: { '17': 'Cuscatlán Norte', '18': 'Cuscatlán Sur' } },
  '08': { nombre: 'La Paz', municipios: { '23': 'La Paz Centro', '24': 'La Paz Oeste' } },
  '09': { nombre: 'Cabañas', municipios: { '10': 'Cabañas Este' } },
  '10': { nombre: 'San Vicente', municipios: { '14': 'San Vicente Norte' } },
  '11': { nombre: 'Usulután', municipios: { '24': 'Usulután Norte', '25': 'Usulután Este' } },
  '12': { nombre: 'San Miguel', municipios: { '21': 'San Miguel Centro', '22': 'San Miguel Norte' } },
  '13': { nombre: 'Morazán', municipios: { '27': 'Morazán Norte' } },
  '14': { nombre: 'La Unión', municipios: { '19': 'La Unión Sur' } },
}

/** CAT-019 Actividad económica (extracto) */
export const ACTIVIDADES: Record<string, string> = {
  '47630': 'Venta al por menor de equipo de deporte y bicicletas',
  '46499': 'Venta al por mayor de otros enseres domésticos',
  '62010': 'Programación informática',
  '70200': 'Actividades de consultoría de gestión',
  '93120': 'Actividades de clubes deportivos',
  '85499': 'Otros tipos de enseñanza n.c.p.',
  '49231': 'Transporte de carga',
  '56101': 'Restaurantes',
}

export const CATEGORIAS = ['Bicicletas', 'Componentes', 'Accesorios', 'Ropa', 'Repuestos']

export const MODULOS: { id: Modulo; nombre: string; grupo: string }[] = [
  { id: 'dashboard', nombre: 'Dashboard', grupo: 'General' },
  { id: 'pos', nombre: 'Punto de venta', grupo: 'Operación' },
  { id: 'caja', nombre: 'Caja y turnos', grupo: 'Operación' },
  { id: 'dte', nombre: 'Documentos DTE', grupo: 'Facturación' },
  { id: 'contingencia', nombre: 'Contingencia MH', grupo: 'Facturación' },
  { id: 'inventario', nombre: 'Inventario y Kardex', grupo: 'Bodega' },
  { id: 'compras', nombre: 'Compras', grupo: 'Bodega' },
  { id: 'proveedores', nombre: 'Proveedores', grupo: 'Bodega' },
  { id: 'clientes', nombre: 'Clientes', grupo: 'Comercial' },
  { id: 'reportes', nombre: 'Reportes e IVA', grupo: 'Análisis' },
  { id: 'usuarios', nombre: 'Usuarios', grupo: 'Administración' },
  { id: 'roles', nombre: 'Roles y permisos', grupo: 'Administración' },
  { id: 'auditoria', nombre: 'Bitácora de auditoría', grupo: 'Administración' },
  { id: 'configuracion', nombre: 'Configuración', grupo: 'Administración' },
]

export const SUCURSALES = ['Casa Matriz · Antiguo Cuscatlán', 'Sucursal Santa Tecla', 'Sucursal San Miguel']
