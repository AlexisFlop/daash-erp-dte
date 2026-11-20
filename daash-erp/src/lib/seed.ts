import { MODULOS } from './catalogos'
import { calcularTotales, construirDteJson } from './dte'
import type {
  Accion, Cliente, Compra, Config, Dte, MetodoPago, Modulo, MovKardex, Permisos, Producto, Proveedor, Rol, Turno, Usuario, Venta,
} from './types'
import { completarDUI, fechaISO, fhMH, generarSello, horaISO } from './utils'

const todo = { c: true, r: true, u: true, d: true }
const lectura = { c: false, r: true, u: false, d: false }
const nada = { c: false, r: false, u: false, d: false }

export function permisos(map: Partial<Record<Modulo, Partial<Record<Accion, boolean>> | 'all' | 'read'>>): Permisos {
  const p = {} as Permisos
  MODULOS.forEach(({ id }) => {
    const v = map[id]
    p[id] = v === 'all' ? { ...todo } : v === 'read' ? { ...lectura } : { ...nada, ...(v ?? {}) }
  })
  return p
}

export const ROLES: Rol[] = [
  {
    id: 'gerente',
    nombre: 'Gerente',
    descripcion: 'Acceso total. Autoriza descuentos, anula documentos y administra usuarios.',
    sistema: true,
    autorizaDescuentos: true,
    permisos: permisos(Object.fromEntries(MODULOS.map((m) => [m.id, 'all'])) as never),
  },
  {
    id: 'cajero',
    nombre: 'Cajero / Vendedor',
    descripcion: 'Opera el punto de venta, abre y cierra caja, registra clientes.',
    sistema: true,
    autorizaDescuentos: false,
    permisos: permisos({ dashboard: 'read', pos: 'all', caja: 'all', dte: { r: true, c: true }, contingencia: 'read', clientes: { c: true, r: true, u: true } }),
  },
  {
    id: 'bodega',
    nombre: 'Administrador de bodega',
    descripcion: 'Gestiona productos, ajustes de inventario, compras y proveedores.',
    sistema: true,
    autorizaDescuentos: false,
    permisos: permisos({ dashboard: 'read', inventario: 'all', compras: 'all', proveedores: 'all', reportes: 'read' }),
  },
  {
    id: 'auditor',
    nombre: 'Auditor / Contador',
    descripcion: 'Consulta documentos, exporta libros de IVA y gestiona roles personalizados.',
    sistema: true,
    autorizaDescuentos: false,
    permisos: permisos({
      dashboard: 'read', dte: 'read', contingencia: 'read', reportes: 'all', auditoria: 'read', roles: 'all',
      inventario: 'read', compras: 'read', clientes: 'read', proveedores: 'read', usuarios: 'read', caja: 'read',
    }),
  },
]

const ahoraISO = () => new Date().toISOString()

export const USUARIOS: Usuario[] = [
  { id: 'u-gerente', nombre: 'María Fernanda Alvarado', correo: 'gerente@adventureworks.com.sv', passwordHash: '0ab5aed52f6847bf4eda91cf8b112ca5ae53e38601e903e1772085a7c4ae71e9', rolId: 'gerente', sucursal: 'Casa Matriz · Antiguo Cuscatlán', dui: completarDUI('04512378'), activo: true, creado: ahoraISO(), intentosFallidos: 0 },
  { id: 'u-cajero', nombre: 'José Ricardo Menjívar', correo: 'cajero@adventureworks.com.sv', passwordHash: 'b6827dffc699722af361becf071d2d590cefcc37ebe5987e5936da3c645d31e8', rolId: 'cajero', sucursal: 'Casa Matriz · Antiguo Cuscatlán', dui: completarDUI('05827741'), activo: true, creado: ahoraISO(), intentosFallidos: 0 },
  { id: 'u-bodega', nombre: 'Karla Beatriz Hernández', correo: 'bodega@adventureworks.com.sv', passwordHash: '69950f73df5ac68c1b20cb55ab9bc5550282739368a63ee73b3df739d66bb643', rolId: 'bodega', sucursal: 'Casa Matriz · Antiguo Cuscatlán', dui: completarDUI('03391254'), activo: true, creado: ahoraISO(), intentosFallidos: 0 },
  { id: 'u-auditor', nombre: 'Roberto Carlos Pineda', correo: 'auditor@adventureworks.com.sv', passwordHash: '16e4a1c037823dbd3eaf3e31ff731518a36b6c5ef0616b107f039620694f5d0e', rolId: 'auditor', sucursal: 'Casa Matriz · Antiguo Cuscatlán', dui: completarDUI('02944167'), activo: true, creado: ahoraISO(), intentosFallidos: 0 },
  { id: 'u-cajero2', nombre: 'Ana Gabriela Romero', correo: 'cajero2@adventureworks.com.sv', passwordHash: '54c5cb0b9aecca0d73191eab26f79955e469934686303ee598e88fb05be1412d', rolId: 'cajero', sucursal: 'Sucursal Santa Tecla', dui: completarDUI('06112398'), activo: true, creado: ahoraISO(), intentosFallidos: 0 },
]

export const CREDENCIALES_DEMO = [
  { rol: 'Gerente', correo: 'gerente@adventureworks.com.sv', password: 'Gerente123*' },
  { rol: 'Cajero', correo: 'cajero@adventureworks.com.sv', password: 'Cajero123*' },
  { rol: 'Bodega', correo: 'bodega@adventureworks.com.sv', password: 'Bodega123*' },
  { rol: 'Auditor', correo: 'auditor@adventureworks.com.sv', password: 'Auditor123*' },
]

let secuenciaBarras = 0
/** Código de barras EAN-13 interno único: 7410 + correlativo de 9 dígitos */
const P = (sku: string, nombre: string, categoria: string, precio: number, costo: number, stock: number, stockMinimo: number, descripcion = ''): Producto => ({
  id: `p-${sku}`, sku, codigoBarras: `7410${String(++secuenciaBarras * 7 + 100000).padStart(9, '0')}`, nombre, categoria, precio, costo, stock, stockMinimo, activo: true, descripcion,
})

export const PRODUCTOS: Producto[] = [
  P('BK-M68B-38', 'Mountain-200 Black, 38', 'Bicicletas', 1150.0, 712.5, 9, 4, 'Cuadro de aluminio, suspensión delantera, 27 velocidades'),
  P('BK-M68S-42', 'Mountain-200 Silver, 42', 'Bicicletas', 1180.0, 731.0, 6, 4),
  P('BK-R50R-52', 'Road-150 Red, 52', 'Bicicletas', 1890.0, 1212.0, 3, 3, 'Bicicleta de ruta en carbono, grupo de 22 velocidades'),
  P('BK-R89B-58', 'Road-550-W Yellow, 40', 'Bicicletas', 980.0, 598.0, 7, 3),
  P('BK-T79U-50', 'Touring-1000 Blue, 50', 'Bicicletas', 1320.0, 845.0, 5, 2),
  P('BK-M18B-40', 'Mountain-500 Black, 40', 'Bicicletas', 540.0, 318.0, 12, 5),
  P('FR-M94B-42', 'HL Mountain Frame - Black, 42', 'Componentes', 620.0, 388.0, 4, 3),
  P('FR-R72R-44', 'ML Road Frame - Red, 44', 'Componentes', 455.0, 270.0, 2, 3),
  P('WH-R282', 'ML Road Front Wheel', 'Componentes', 148.0, 84.0, 14, 6),
  P('WH-M563', 'HL Mountain Rear Wheel', 'Componentes', 198.0, 118.0, 10, 5),
  P('PD-M562', 'HL Mountain Pedal', 'Componentes', 52.0, 26.0, 22, 8),
  P('CH-0234', 'Chain', 'Repuestos', 18.5, 8.9, 40, 15),
  P('TI-R092', 'LL Road Tire', 'Repuestos', 21.5, 10.2, 35, 12),
  P('TI-M823', 'HL Mountain Tire', 'Repuestos', 35.0, 17.4, 4, 10),
  P('PK-7098', 'Patch Kit / 8 Patches', 'Repuestos', 2.75, 1.1, 120, 30),
  P('TT-M928', 'Mountain Tire Tube', 'Repuestos', 5.0, 2.2, 64, 25),
  P('HL-U509', 'Sport-100 Helmet, Black', 'Accesorios', 34.99, 14.5, 26, 10),
  P('HL-U509-R', 'Sport-100 Helmet, Red', 'Accesorios', 34.99, 14.5, 18, 10),
  P('WB-H098', 'Water Bottle - 30 oz.', 'Accesorios', 4.99, 1.9, 85, 30),
  P('BC-M005', 'Mountain Bottle Cage', 'Accesorios', 9.99, 3.8, 44, 15),
  P('HY-1023-70', 'Hydration Pack - 70 oz.', 'Accesorios', 54.99, 22.0, 15, 6),
  P('LO-C100', 'Cable Lock', 'Accesorios', 25.0, 10.3, 3, 8),
  P('FE-6654', 'Fender Set - Mountain', 'Accesorios', 21.98, 8.3, 20, 8),
  P('LJ-0192-L', 'Long-Sleeve Logo Jersey, L', 'Ropa', 49.99, 19.0, 30, 10),
  P('GL-H102-M', 'Half-Finger Gloves, M', 'Ropa', 24.49, 9.2, 28, 10),
  P('SH-W890-M', "Women's Mountain Shorts, M", 'Ropa', 69.99, 26.2, 11, 6),
  P('VE-C304-M', 'Classic Vest, M', 'Ropa', 63.5, 24.0, 9, 5),
  P('CA-1098', 'AWC Logo Cap', 'Ropa', 8.99, 3.4, 60, 20),
]

const dir = (departamento: string, municipio: string, complemento: string) => ({ departamento, municipio, complemento })

export const CLIENTES: Cliente[] = [
  { id: 'c-1', tipo: 'CONSUMIDOR', nombre: 'Daniela Sofía Martínez', tipoDocumento: '13', numDocumento: completarDUI('04987512'), correo: 'daniela.martinez@correo.sv', telefono: '7012-4455', direccion: dir('06', '20', 'Colonia Escalón, Calle La Mascota #12'), activo: true, creado: ahoraISO() },
  { id: 'c-2', tipo: 'CONSUMIDOR', nombre: 'Luis Ernesto Rivas', tipoDocumento: '13', numDocumento: completarDUI('03321789'), correo: 'lrivas@correo.sv', telefono: '7788-1203', direccion: dir('05', '23', 'Santa Tecla, Residencial Las Palmas'), activo: true, creado: ahoraISO() },
  { id: 'c-3', tipo: 'CONTRIBUYENTE', nombre: 'Ciclismo Extremo, S.A. de C.V.', nombreComercial: 'Ciclismo Extremo', tipoDocumento: '36', numDocumento: '0614-150318-102-7', nrc: '254871-3', codActividad: '93120', descActividad: 'Actividades de clubes deportivos', correo: 'compras@ciclismoextremo.com.sv', telefono: '2243-8900', direccion: dir('06', '20', 'Boulevard de Los Héroes, Edificio Torre Azul, local 4'), activo: true, creado: ahoraISO() },
  { id: 'c-4', tipo: 'CONTRIBUYENTE', nombre: 'Distribuidora Montaña Verde, S.A. de C.V.', nombreComercial: 'Montaña Verde', tipoDocumento: '36', numDocumento: '0511-020615-101-2', nrc: '198234-6', codActividad: '46499', descActividad: 'Venta al por mayor de otros enseres domésticos', correo: 'facturacion@montanaverde.sv', telefono: '2228-1144', direccion: dir('05', '24', 'Antiguo Cuscatlán, Calle El Pedregal #45'), activo: true, creado: ahoraISO() },
  { id: 'c-5', tipo: 'CONTRIBUYENTE', nombre: 'Rutas Turísticas Pipil, S.A. de C.V.', nombreComercial: 'Rutas Pipil', tipoDocumento: '36', numDocumento: '1217-110920-103-5', nrc: '301122-9', codActividad: '49231', descActividad: 'Transporte de carga', correo: 'admin@rutaspipil.com.sv', telefono: '2661-0098', direccion: dir('12', '21', 'San Miguel, Avenida Roosevelt Sur'), activo: true, creado: ahoraISO() },
  { id: 'c-6', tipo: 'CONSUMIDOR', nombre: 'Carlos Alberto Quintanilla', tipoDocumento: '13', numDocumento: completarDUI('05550123'), correo: 'cquintanilla@correo.sv', telefono: '7455-0011', direccion: dir('02', '14', 'Santa Ana, Barrio El Calvario'), activo: true, creado: ahoraISO() },
]

export const PROVEEDORES: Proveedor[] = [
  { id: 'pr-1', razonSocial: 'Bike Supply Centroamérica, S.A. de C.V.', nit: '0614-220511-104-0', nrc: '210987-1', contacto: 'Ing. Mauricio Castro', telefono: '2250-7788', correo: 'ventas@bikesupply.com.sv', activo: true },
  { id: 'pr-2', razonSocial: 'Importadora Deportiva del Pacífico, S.A. de C.V.', nit: '0614-090814-102-3', nrc: '233415-8', contacto: 'Lic. Sandra Orellana', telefono: '2245-3300', correo: 'sorellana@idpacifico.sv', activo: true },
  { id: 'pr-3', razonSocial: 'Textiles Activos, S.A. de C.V.', nit: '0511-300417-101-9', nrc: '276540-2', contacto: 'Fernando Ayala', telefono: '2289-1201', correo: 'fayala@textilesactivos.sv', activo: true },
  { id: 'pr-4', razonSocial: 'Componentes y Repuestos Ciclo, S.A. de C.V.', nit: '0210-151019-103-4', nrc: '298871-5', contacto: 'Patricia Linares', telefono: '2440-5566', correo: 'plinares@ciclorepuestos.sv', activo: true },
]

export const CONFIG: Config = {
  emisor: {
    nit: '0614-010195-101-8',
    nrc: '12345-6',
    nombre: 'Adventure Works El Salvador, S.A. de C.V.',
    nombreComercial: 'Adventure Works',
    codActividad: '47630',
    descActividad: 'Venta al por menor de equipo de deporte y bicicletas',
    tipoEstablecimiento: '01',
    direccion: { departamento: '05', municipio: '24', complemento: 'Antiguo Cuscatlán, Calle La Reforma #2401, Centro Comercial Plaza Merliot' },
    telefono: '2209-4500',
    correo: 'facturacion@adventureworks.com.sv',
    codEstable: 'M001',
    codPuntoVenta: 'P001',
  },
  ambiente: '00',
  mhEnLinea: true,
  simularRechazo: false,
  latenciaMs: 700,
  descuentoBase: 10,
  modoDemo: true,
  correlativos: { '01': 0, '03': 0, '05': 0 },
}

// ---------- Historial generado (ventas de los últimos 45 días) ----------
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

export function generarHistorial() {
  const r = rng(20261120)
  const config: Config = structuredClone(CONFIG)
  const productos = structuredClone(PRODUCTOS)
  const ventas: Venta[] = []
  const dtes: Dte[] = []
  const turnos: Turno[] = []
  const kardex: MovKardex[] = []
  const compras: Compra[] = []

  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 45)
  inicio.setHours(8, 0, 0, 0)

  productos.forEach((p) => (p.stock = 100000))

  const metodos: MetodoPago[] = ['EFECTIVO', 'EFECTIVO', 'TARJETA', 'TARJETA', 'TRANSFERENCIA']
  for (let dia = 0; dia < 45; dia++) {
    const fechaDia = new Date(inicio)
    fechaDia.setDate(inicio.getDate() + dia)
    if (fechaDia > new Date()) break
    const esHoy = fechaISO(fechaDia) === fechaISO(new Date())
    const turnoId = `t-${dia}`
    const cajero = dia % 3 === 0 ? 'u-cajero2' : 'u-cajero'
    const apertura = new Date(fechaDia)
    apertura.setHours(8, 30)
    const turno: Turno = { id: turnoId, usuarioId: cajero, caja: 'Caja 01', apertura: apertura.toISOString(), fondoInicial: 100, estado: 'CERRADO' }
    const porMetodo: Record<MetodoPago, number> = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 }
    const finDeSemana = [0, 6].includes(fechaDia.getDay())
    const n = esHoy ? 0 : Math.floor(r() * 4) + (finDeSemana ? 5 : 2)
    let totalTurno = 0
    for (let v = 0; v < n; v++) {
      const fecha = new Date(fechaDia)
      fecha.setHours(9 + Math.floor(r() * 9), Math.floor(r() * 60), Math.floor(r() * 60))
      const esCcf = r() < 0.22
      const cliente = esCcf ? CLIENTES.filter((c) => c.tipo === 'CONTRIBUYENTE')[Math.floor(r() * 3)] : r() < 0.3 ? CLIENTES.filter((c) => c.tipo === 'CONSUMIDOR')[Math.floor(r() * 3)] : undefined
      const nItems = 1 + Math.floor(r() * 3)
      const items: { productoId: string; sku: string; nombre: string; cantidad: number; precio: number }[] = []
      for (let i = 0; i < nItems; i++) {
        const bici = r() < 0.18
        const pool = productos.filter((p) => (bici ? p.categoria === 'Bicicletas' : p.categoria !== 'Bicicletas'))
        const p = pool[Math.floor(r() * pool.length)]
        if (items.some((it) => it.productoId === p.id)) continue
        const cantidad = bici ? 1 : 1 + Math.floor(r() * (esCcf ? 6 : 3))
        items.push({ productoId: p.id, sku: p.sku, nombre: p.nombre, cantidad, precio: p.precio })
      }
      if (!items.length) continue
      const tipo = esCcf ? '03' : '01'
      const descuentoPct = r() < 0.12 ? 5 : 0
      const metodoPago = metodos[Math.floor(r() * metodos.length)]
      config.correlativos[tipo]++
      const codigo = crypto.randomUUID().toUpperCase()
      const json = construirDteJson({ tipo, config, correlativo: config.correlativos[tipo], codigoGeneracion: codigo, fecha, items, descuentoPct, cliente, metodoPago, vendedor: cajero === 'u-cajero' ? 'José Ricardo Menjívar' : 'Ana Gabriela Romero' })
      const t = calcularTotales(items, descuentoPct, tipo)
      const ventaId = `v-${dia}-${v}`
      const proc = new Date(fecha.getTime() + 1500)
      dtes.push({
        id: codigo, tipoDte: tipo, numeroControl: (json.identificacion as { numeroControl: string }).numeroControl, fechaEmi: fechaISO(fecha), horaEmi: horaISO(fecha), creado: fecha.toISOString(), ventaId, clienteId: cliente?.id,
        receptorNombre: cliente?.nombre ?? 'Consumidor final', total: t.total, iva: t.iva, estado: 'PROCESADO', selloRecibido: generarSello(proc), fhProcesamiento: fhMH(proc), json, firma: 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXUyJ9.[historial].firma-demo', intentos: 1, ultimoIntento: proc.toISOString(), usuarioId: cajero,
      })
      ventas.push({ id: ventaId, fecha: fecha.toISOString(), turnoId, usuarioId: cajero, clienteId: cliente?.id, tipoDte: tipo, items, descuentoPct, metodoPago, subtotal: t.subtotal, descuento: t.descuento, iva: t.iva, total: t.total, dteId: codigo })
      porMetodo[metodoPago] += t.total
      totalTurno += t.total
      items.forEach((it) => {
        const p = productos.find((x) => x.id === it.productoId)!
        p.stock -= it.cantidad
        kardex.push({ id: `k-${ventaId}-${p.id}`, fecha: fecha.toISOString(), productoId: p.id, tipo: 'SALIDA', cantidad: it.cantidad, saldo: p.stock, costoUnit: p.costo, referencia: `Venta ${codigo.slice(0, 8)}`, usuarioId: cajero })
      })
    }
    if (!esHoy) {
      const cierre = new Date(fechaDia)
      cierre.setHours(18, 15)
      turno.cierre = cierre.toISOString()
      turno.efectivoContado = Math.round((100 + porMetodo.EFECTIVO) * 100) / 100
      turno.resumen = { ventas: Math.round(totalTurno * 100) / 100, transacciones: n, porMetodo, esperadoEfectivo: turno.efectivoContado, diferencia: 0 }
      turnos.push(turno)
    }
  }

  const fc = new Date()
  fc.setDate(fc.getDate() - 3)
  fc.setHours(10, 0, 0, 0)
  const compra: Compra = { id: 'cp-1', fecha: fc.toISOString(), proveedorId: 'pr-1', numeroComprobante: 'CCF-PR-0142', items: productos.slice(0, 3).map((p) => ({ productoId: p.id, cantidad: 2, costoUnit: p.costo })), subtotal: 0, iva: 0, total: 0, usuarioId: 'u-bodega' }
  compra.subtotal = Math.round(compra.items.reduce((a, i) => a + i.cantidad * i.costoUnit, 0) * 100) / 100
  compra.iva = Math.round(compra.subtotal * 0.13 * 100) / 100
  compra.total = Math.round((compra.subtotal + compra.iva) * 100) / 100
  compras.push(compra)
  compra.items.forEach((it) => kardex.push({ id: `k-cp1-${it.productoId}`, fecha: compra.fecha, productoId: it.productoId, tipo: 'ENTRADA', cantidad: it.cantidad, saldo: 0, costoUnit: it.costoUnit, referencia: `Compra ${compra.numeroComprobante}`, usuarioId: 'u-bodega' }))

  // Inventario inicial = stock objetivo + vendido − comprado; luego se recalculan saldos
  const inicial = new Date(inicio.getTime() - 86400000).toISOString()
  productos.forEach((p, i) => {
    const movs = kardex.filter((k) => k.productoId === p.id)
    const neto = movs.reduce((a, k) => a + (k.tipo === 'SALIDA' ? -k.cantidad : k.cantidad), 0)
    const ini = PRODUCTOS[i].stock - neto
    kardex.push({ id: `k-ini-${p.id}`, fecha: inicial, productoId: p.id, tipo: 'INICIAL', cantidad: ini, saldo: ini, costoUnit: p.costo, referencia: 'Inventario inicial', usuarioId: 'u-bodega' })
    p.stock = PRODUCTOS[i].stock
  })
  kardex.sort((a, b) => a.fecha.localeCompare(b.fecha))
  const saldos: Record<string, number> = {}
  kardex.forEach((k) => {
    saldos[k.productoId] = (saldos[k.productoId] ?? 0) + (k.tipo === 'SALIDA' ? -k.cantidad : k.cantidad)
    k.saldo = saldos[k.productoId]
  })

  ventas.reverse()
  dtes.reverse()
  turnos.reverse()
  return { config, productos, ventas, dtes, turnos, kardex, compras }
}
