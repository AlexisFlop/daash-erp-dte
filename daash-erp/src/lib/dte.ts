import { FORMAS_PAGO, TIPOS_DTE } from './catalogos'
import type { Cliente, Config, Dte, Emisor, EventoContingencia, ItemVenta, MetodoPago, RespuestaMH, TipoDte } from './types'
import { b64url, fechaISO, fhMH, generarSello, horaISO, numeroALetras, pad, round2, validarNIT, validarNRC } from './utils'

export const IVA = 0.13

export interface LineaCalculada extends ItemVenta {
  precioUni: number
  montoDescu: number
  ventaGravada: number
  ivaItem: number
}

export interface Totales {
  lineas: LineaCalculada[]
  /** Suma bruta antes de descuento (sin IVA) */
  subtotal: number
  descuento: number
  gravada: number
  iva: number
  total: number
}

/**
 * Cálculo único de totales — se usa en POS y en el JSON para garantizar
 * que el backend (simulado) es la única fuente de verdad (CA-05).
 * Factura (01): precios con IVA incluido. CCF/NC (03/05): precios sin IVA + tributo 20.
 */
export function calcularTotales(items: ItemVenta[], descuentoPct: number, tipo: TipoDte): Totales {
  const pct = Math.min(Math.max(descuentoPct, 0), 100) / 100
  if (tipo === '01') {
    const lineas = items.map((it) => {
      const precioUni = round2(it.precio * (1 + IVA))
      const bruto = round2(precioUni * it.cantidad)
      const montoDescu = round2(bruto * pct)
      const ventaGravada = round2(bruto - montoDescu)
      const ivaItem = round2((ventaGravada / (1 + IVA)) * IVA)
      return { ...it, precioUni, montoDescu, ventaGravada, ivaItem }
    })
    const total = round2(lineas.reduce((a, l) => a + l.ventaGravada, 0))
    const iva = round2(lineas.reduce((a, l) => a + l.ivaItem, 0))
    const descuentoConIva = round2(lineas.reduce((a, l) => a + l.montoDescu, 0))
    const descuento = round2(descuentoConIva / (1 + IVA))
    const gravada = round2(total - iva)
    return { lineas, subtotal: round2(gravada + descuento), descuento, gravada, iva, total }
  }
  const lineas = items.map((it) => {
    const precioUni = round2(it.precio)
    const bruto = round2(precioUni * it.cantidad)
    const montoDescu = round2(bruto * pct)
    const ventaGravada = round2(bruto - montoDescu)
    return { ...it, precioUni, montoDescu, ventaGravada, ivaItem: round2(ventaGravada * IVA) }
  })
  const gravada = round2(lineas.reduce((a, l) => a + l.ventaGravada, 0))
  const descuento = round2(lineas.reduce((a, l) => a + l.montoDescu, 0))
  const iva = round2(gravada * IVA)
  return { lineas, subtotal: round2(gravada + descuento), descuento, gravada, iva, total: round2(gravada + iva) }
}

export const numeroControl = (tipo: TipoDte, emisor: Emisor, correlativo: number) =>
  `DTE-${tipo}-${emisor.codEstable}${emisor.codPuntoVenta}-${pad(correlativo, 15)}`

const emisorJson = (e: Emisor, tipo: TipoDte) => {
  const base: Record<string, unknown> = {
    nit: e.nit.replace(/-/g, ''),
    nrc: e.nrc.replace(/-/g, ''),
    nombre: e.nombre,
    codActividad: e.codActividad,
    descActividad: e.descActividad,
    nombreComercial: e.nombreComercial,
    tipoEstablecimiento: e.tipoEstablecimiento,
    direccion: e.direccion,
    telefono: e.telefono,
    correo: e.correo,
  }
  if (tipo !== '05') {
    Object.assign(base, { codEstableMH: null, codEstable: e.codEstable, codPuntoVentaMH: null, codPuntoVenta: e.codPuntoVenta })
  }
  return base
}

export interface DatosDte {
  tipo: TipoDte
  config: Config
  correlativo: number
  codigoGeneracion: string
  fecha: Date
  items: ItemVenta[]
  descuentoPct: number
  cliente?: Cliente
  metodoPago?: MetodoPago
  vendedor: string
  contingencia?: { tipo: number; motivo: string } | null
  relacionado?: Dte
}

export function construirDteJson(d: DatosDte) {
  const { tipo, config, cliente } = d
  const t = calcularTotales(d.items, d.descuentoPct, tipo)
  const enContingencia = !!d.contingencia
  const identificacion = {
    version: TIPOS_DTE[tipo].version,
    ambiente: config.ambiente,
    tipoDte: tipo,
    numeroControl: numeroControl(tipo, config.emisor, d.correlativo),
    codigoGeneracion: d.codigoGeneracion,
    tipoModelo: enContingencia ? 2 : 1,
    tipoOperacion: enContingencia ? 2 : 1,
    tipoContingencia: enContingencia ? d.contingencia!.tipo : null,
    motivoContin: enContingencia && d.contingencia!.tipo === 5 ? d.contingencia!.motivo : null,
    fecEmi: fechaISO(d.fecha),
    horEmi: horaISO(d.fecha),
    tipoMoneda: 'USD',
  }

  const pago = d.metodoPago
    ? [{ codigo: FORMAS_PAGO[d.metodoPago].codigo, montoPago: t.total, referencia: null, plazo: null, periodo: null }]
    : null

  if (tipo === '01') {
    return {
      identificacion,
      documentoRelacionado: null,
      emisor: emisorJson(config.emisor, tipo),
      receptor: cliente
        ? {
            tipoDocumento: cliente.tipoDocumento,
            numDocumento: cliente.numDocumento,
            nrc: null,
            nombre: cliente.nombre,
            codActividad: null,
            descActividad: null,
            direccion: cliente.direccion,
            telefono: cliente.telefono || null,
            correo: cliente.correo || null,
          }
        : { tipoDocumento: null, numDocumento: null, nrc: null, nombre: 'Consumidor final', codActividad: null, descActividad: null, direccion: null, telefono: null, correo: null },
      otrosDocumentos: null,
      ventaTercero: null,
      cuerpoDocumento: t.lineas.map((l, i) => ({
        numItem: i + 1,
        tipoItem: 1,
        numeroDocumento: null,
        cantidad: l.cantidad,
        codigo: l.sku,
        codTributo: null,
        uniMedida: 59,
        descripcion: l.nombre,
        precioUni: l.precioUni,
        montoDescu: l.montoDescu,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada: l.ventaGravada,
        tributos: null,
        psv: 0,
        noGravado: 0,
        ivaItem: l.ivaItem,
      })),
      resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: t.total,
        subTotalVentas: t.total,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: 0,
        porcentajeDescuento: 0,
        totalDescu: round2(t.lineas.reduce((a, l) => a + l.montoDescu, 0)),
        tributos: null,
        subTotal: t.total,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: t.total,
        totalNoGravado: 0,
        totalPagar: t.total,
        totalLetras: numeroALetras(t.total),
        totalIva: t.iva,
        saldoFavor: 0,
        condicionOperacion: 1,
        pagos: pago,
        numPagoElectronico: null,
      },
      extension: { nombEntrega: d.vendedor, docuEntrega: null, nombRecibe: null, docuRecibe: null, observaciones: null, placaVehiculo: null },
      apendice: null,
    }
  }

  const receptor = {
    nit: cliente?.numDocumento.replace(/-/g, '') ?? '',
    nrc: cliente?.nrc?.replace(/-/g, '') ?? '',
    nombre: cliente?.nombre ?? '',
    codActividad: cliente?.codActividad ?? '',
    descActividad: cliente?.descActividad ?? '',
    nombreComercial: cliente?.nombreComercial || null,
    direccion: cliente?.direccion ?? null,
    telefono: cliente?.telefono || null,
    correo: cliente?.correo ?? '',
  }
  const tributos = [{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: t.iva }]
  const cuerpo = t.lineas.map((l, i) => ({
    numItem: i + 1,
    tipoItem: 1,
    numeroDocumento: tipo === '05' ? d.relacionado?.id ?? null : null,
    cantidad: l.cantidad,
    codigo: l.sku,
    codTributo: null,
    uniMedida: 59,
    descripcion: l.nombre,
    precioUni: l.precioUni,
    montoDescu: l.montoDescu,
    ventaNoSuj: 0,
    ventaExenta: 0,
    ventaGravada: l.ventaGravada,
    tributos: ['20'],
    ...(tipo === '03' ? { psv: 0, noGravado: 0 } : {}),
  }))

  if (tipo === '03') {
    return {
      identificacion,
      documentoRelacionado: null,
      emisor: emisorJson(config.emisor, tipo),
      receptor,
      otrosDocumentos: null,
      ventaTercero: null,
      cuerpoDocumento: cuerpo,
      resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: t.gravada,
        subTotalVentas: t.gravada,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: 0,
        porcentajeDescuento: 0,
        totalDescu: t.descuento,
        tributos,
        subTotal: t.gravada,
        ivaPerci1: 0,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: t.total,
        totalNoGravado: 0,
        totalPagar: t.total,
        totalLetras: numeroALetras(t.total),
        saldoFavor: 0,
        condicionOperacion: 1,
        pagos: pago,
        numPagoElectronico: null,
      },
      extension: { nombEntrega: d.vendedor, docuEntrega: null, nombRecibe: null, docuRecibe: null, observaciones: null, placaVehiculo: null },
      apendice: null,
    }
  }

  // 05 Nota de crédito
  return {
    identificacion,
    documentoRelacionado: [
      {
        tipoDocumento: d.relacionado!.tipoDte,
        tipoGeneracion: 2,
        numeroDocumento: d.relacionado!.id,
        fechaEmision: d.relacionado!.fechaEmi,
      },
    ],
    emisor: emisorJson(config.emisor, tipo),
    receptor,
    ventaTercero: null,
    cuerpoDocumento: cuerpo,
    resumen: {
      totalNoSuj: 0,
      totalExenta: 0,
      totalGravada: t.gravada,
      subTotalVentas: t.gravada,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: 0,
      totalDescu: t.descuento,
      tributos,
      subTotal: t.gravada,
      ivaPerci1: 0,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion: t.total,
      totalLetras: numeroALetras(t.total),
      condicionOperacion: 1,
    },
    extension: { nombEntrega: d.vendedor, docuEntrega: null, nombRecibe: null, docuRecibe: null, observaciones: 'Devolución de mercadería' },
    apendice: null,
  }
}

/** Validación local previa a la transmisión (simula el validador de esquema JSON) */
export function validarDte(tipo: TipoDte, cliente?: Cliente, items: ItemVenta[] = []): string[] {
  const errores: string[] = []
  if (!items.length) errores.push('[cuerpoDocumento] El documento debe contener al menos un ítem')
  if (tipo === '03' || tipo === '05') {
    if (!cliente) errores.push('[receptor] El CCF requiere un receptor contribuyente')
    else {
      if (cliente.tipo !== 'CONTRIBUYENTE') errores.push('[receptor] El receptor debe ser contribuyente inscrito en IVA')
      if (!validarNIT(cliente.numDocumento)) errores.push('[receptor.nit] Formato de NIT inválido')
      if (!cliente.nrc || !validarNRC(cliente.nrc)) errores.push('[receptor.nrc] Formato de NRC inválido')
      if (!cliente.codActividad) errores.push('[receptor.codActividad] Actividad económica requerida')
    }
  }
  return errores
}

/**
 * Firma simulada del documento (JWS compacto, algoritmo RS512 como el firmador del MH).
 * La "firma" es un hash SHA-512 del contenido + llave privada de demostración.
 */
export async function firmarDocumento(json: object) {
  const header = b64url(JSON.stringify({ alg: 'RS512', typ: 'JWS' }))
  const payload = b64url(JSON.stringify(json))
  const sig = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(`${header}.${payload}.daash-llave-privada-demo`))
  return `${header}.${payload}.${b64url(sig)}`
}

export class MHNoDisponible extends Error {
  constructor() {
    super('Tiempo de espera agotado: el servicio de recepción del Ministerio de Hacienda no responde')
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Simulador del servicio de recepción de DTE del MH */
export async function transmitirMH(config: Config, codigo: string, opciones?: { forzarRechazo?: boolean }): Promise<RespuestaMH> {
  await espera(config.latenciaMs + Math.random() * 400)
  if (!config.mhEnLinea) throw new MHNoDisponible()
  const ahora = new Date()
  if (opciones?.forzarRechazo ?? config.simularRechazo) {
    return {
      version: 2,
      ambiente: config.ambiente,
      versionApp: 2,
      estado: 'RECHAZADO',
      codigoGeneracion: codigo,
      selloRecibido: null,
      fhProcesamiento: fhMH(ahora),
      clasificaMsg: '20',
      codigoMsg: '004',
      descripcionMsg: '[receptor.correo] NO CUMPLE EL FORMATO REQUERIDO',
      observaciones: ['Verifique los datos del receptor y retransmita el documento'],
    }
  }
  return {
    version: 2,
    ambiente: config.ambiente,
    versionApp: 2,
    estado: 'PROCESADO',
    codigoGeneracion: codigo,
    selloRecibido: generarSello(ahora),
    fhProcesamiento: fhMH(ahora),
    clasificaMsg: '10',
    codigoMsg: '001',
    descripcionMsg: 'RECIBIDO',
    observaciones: [],
  }
}

export function construirEventoContingencia(ev: EventoContingencia, config: Config, dtes: Dte[], responsable: { nombre: string; dui: string }) {
  const ini = new Date(ev.fInicio)
  const fin = ev.fFin ? new Date(ev.fFin) : new Date()
  const ahora = new Date()
  return {
    identificacion: {
      version: 3,
      ambiente: config.ambiente,
      codigoGeneracion: ev.id,
      fTransmision: fechaISO(ahora),
      hTransmision: horaISO(ahora),
    },
    emisor: {
      nit: config.emisor.nit.replace(/-/g, ''),
      nombre: config.emisor.nombre,
      nombreResponsable: responsable.nombre,
      tipoDocResponsable: '13',
      numeroDocResponsable: responsable.dui,
      tipoEstablecimiento: config.emisor.tipoEstablecimiento,
      codEstableMH: null,
      codPuntoVenta: config.emisor.codPuntoVenta,
      telefono: config.emisor.telefono,
      correo: config.emisor.correo,
    },
    detalleDTE: dtes.map((d, i) => ({ noItem: i + 1, codigoGeneracion: d.id, tipoDoc: d.tipoDte })),
    motivo: {
      fInicio: fechaISO(ini),
      fFin: fechaISO(fin),
      hInicio: horaISO(ini),
      hFin: horaISO(fin),
      tipoContingencia: ev.tipoContingencia,
      motivoContingencia: ev.tipoContingencia === 5 ? ev.motivo : null,
    },
  }
}

export function construirInvalidacion(
  dte: Dte,
  config: Config,
  cliente: Cliente | undefined,
  tipoAnulacion: 1 | 2 | 3,
  motivo: string,
  responsable: { nombre: string; dui: string },
  codigo: string,
) {
  const ahora = new Date()
  return {
    identificacion: {
      version: 2,
      ambiente: config.ambiente,
      codigoGeneracion: codigo,
      fecAnula: fechaISO(ahora),
      horAnula: horaISO(ahora),
    },
    emisor: {
      nit: config.emisor.nit.replace(/-/g, ''),
      nombre: config.emisor.nombre,
      tipoEstablecimiento: config.emisor.tipoEstablecimiento,
      nomEstablecimiento: config.emisor.nombreComercial,
      codEstableMH: null,
      codEstable: config.emisor.codEstable,
      codPuntoVentaMH: null,
      codPuntoVenta: config.emisor.codPuntoVenta,
      telefono: config.emisor.telefono,
      correo: config.emisor.correo,
    },
    documento: {
      tipoDte: dte.tipoDte,
      codigoGeneracion: dte.id,
      selloRecibido: dte.selloRecibido,
      numeroControl: dte.numeroControl,
      fecEmi: dte.fechaEmi,
      montoIva: dte.iva,
      codigoGeneracionR: null,
      tipoDocumento: cliente?.tipoDocumento ?? null,
      numDocumento: cliente?.numDocumento ?? null,
      nombre: dte.receptorNombre,
      telefono: cliente?.telefono ?? null,
      correo: cliente?.correo ?? null,
    },
    motivo: {
      tipoAnulacion,
      motivoAnulacion: tipoAnulacion === 3 ? motivo : null,
      nombreResponsable: responsable.nombre,
      tipDocResponsable: '13',
      numDocResponsable: responsable.dui,
      nombreSolicita: responsable.nombre,
      tipDocSolicita: '13',
      numDocSolicita: responsable.dui,
    },
  }
}

export const urlConsultaPublica = (dte: Pick<Dte, 'id' | 'fechaEmi'>, ambiente: string) =>
  `https://admin.factura.gob.sv/consultaPublica?ambiente=${ambiente}&codGen=${dte.id}&fechaEmi=${dte.fechaEmi}`
