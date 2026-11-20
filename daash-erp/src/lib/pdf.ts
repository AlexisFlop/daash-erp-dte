import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import logoUrl from '../assets/logo.svg'
import { DEPARTAMENTOS, FORMAS_PAGO, TIPOS_CONTINGENCIA, TIPOS_DTE } from './catalogos'
import { urlConsultaPublica } from './dte'
import type { Config, Dte, Turno, Usuario } from './types'
import { fmtFecha, money } from './utils'

const INK: [number, number, number] = [51, 51, 51]
const MUTED: [number, number, number] = [120, 120, 120]
const LINE: [number, number, number] = [225, 225, 222]
const GREEN: [number, number, number] = [115, 241, 111]
const YELLOW: [number, number, number] = [245, 230, 97]
const RED: [number, number, number] = [245, 78, 78]

let logoCache: string | null = null
async function logoPng() {
  if (logoCache) return logoCache
  const img = new Image()
  img.src = logoUrl
  await img.decode()
  const c = document.createElement('canvas')
  c.width = 1290
  c.height = 390
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  logoCache = c.toDataURL('image/png')
  return logoCache
}

type J = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const dirTexto = (d?: { departamento: string; municipio: string; complemento: string } | null) => {
  if (!d) return '—'
  const dep = DEPARTAMENTOS[d.departamento]
  return `${d.complemento}, ${dep?.municipios[d.municipio] ?? d.municipio}, ${dep?.nombre ?? d.departamento}`
}

function dots(doc: jsPDF, x: number, y: number) {
  ;[RED, YELLOW, GREEN].forEach((c, i) => {
    doc.setFillColor(...c)
    doc.circle(x + i * 3.2, y, 1, 'F')
  })
}

export async function generarPdfDte(dte: Dte, config: Config) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 14
  const j = dte.json as J
  const id = j.identificacion
  const tipo = TIPOS_DTE[dte.tipoDte]

  // --- Encabezado ---
  doc.setFillColor(...INK)
  doc.rect(0, 0, W, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...INK)
  doc.setFontSize(14)
  doc.text(config.emisor.nombre, M, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  const em = [
    `NIT: ${config.emisor.nit}   ·   NRC: ${config.emisor.nrc}`,
    `Actividad: ${config.emisor.descActividad}`,
    doc.splitTextToSize(`Dirección: ${dirTexto(config.emisor.direccion)}`, 105)[0],
    `Tel: ${config.emisor.telefono}   ·   ${config.emisor.correo}`,
  ]
  em.forEach((t, i) => doc.text(t, M, 21 + i * 4))

  // Caja de identificación
  const bx = W - M - 72
  doc.setDrawColor(...LINE)
  doc.setFillColor(250, 250, 248)
  doc.roundedRect(bx, 8, 72, 30, 2, 2, 'FD')
  dots(doc, bx + 4, 12)
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text('DOCUMENTO TRIBUTARIO ELECTRÓNICO', bx + 13, 12.8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(doc.splitTextToSize(tipo.nombre.toUpperCase(), 64), bx + 4, 19)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(`Versión del esquema: ${tipo.esquema} (v${id.version})`, bx + 4, 30)
  doc.text(`Ambiente: ${id.ambiente === '00' ? '00 · Pruebas' : '01 · Producción'}`, bx + 4, 34)

  // --- Bloque de identificación DTE + QR ---
  let y = 46
  doc.setDrawColor(...LINE)
  doc.roundedRect(M, y, W - 2 * M, 38, 2, 2, 'S')
  const qr = await QRCode.toDataURL(urlConsultaPublica(dte, config.ambiente), { margin: 0, width: 300, color: { dark: '#333333', light: '#ffffff' } })
  doc.addImage(qr, 'PNG', W - M - 34, y + 4, 30, 30)
  const campos: [string, string][] = [
    ['Código de generación', dte.id],
    ['Número de control', dte.numeroControl],
    ['Sello de recepción', dte.selloRecibido ?? 'PENDIENTE — emitido en contingencia'],
    ['Modelo de facturación', id.tipoModelo === 1 ? 'Previo' : 'Diferido'],
    ['Tipo de transmisión', id.tipoOperacion === 1 ? 'Normal' : `Por contingencia · ${TIPOS_CONTINGENCIA[id.tipoContingencia] ?? ''}`],
    ['Fecha y hora de emisión', `${id.fecEmi}  ${id.horEmi}`],
  ]
  campos.forEach(([k, v], i) => {
    const cy = y + 7 + i * 5.2
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(k, M + 4, cy)
    doc.setFont(i < 3 ? 'courier' : 'helvetica', i < 3 ? 'bold' : 'normal')
    doc.setFontSize(i < 3 ? 8 : 8)
    doc.setTextColor(...(i === 2 && !dte.selloRecibido ? RED : INK))
    doc.text(v, M + 42, cy)
    doc.setFont('helvetica', 'normal')
  })

  // --- Receptor ---
  y += 44
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  doc.text('RECEPTOR', M, y)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.6)
  doc.line(M, y + 1.5, M + 14, y + 1.5)
  doc.setLineWidth(0.2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const r = j.receptor ?? {}
  const rec: [string, string][] =
    dte.tipoDte === '01'
      ? [
          ['Nombre', r.nombre ?? 'Consumidor final'],
          ['Documento', r.numDocumento ? `${r.tipoDocumento === '13' ? 'DUI' : 'NIT'} ${r.numDocumento}` : '—'],
          ['Correo', r.correo ?? '—'],
          ['Dirección', r.direccion ? dirTexto(r.direccion) : '—'],
        ]
      : [
          ['Nombre / razón social', r.nombre],
          ['NIT  ·  NRC', `${r.nit}  ·  ${r.nrc}`],
          ['Actividad económica', `${r.codActividad} · ${r.descActividad}`],
          ['Dirección', dirTexto(r.direccion)],
          ['Correo', r.correo ?? '—'],
        ]
  rec.forEach(([k, v], i) => {
    doc.setTextColor(...MUTED)
    doc.text(k, M, y + 7 + i * 4.6)
    doc.setTextColor(...INK)
    doc.text(doc.splitTextToSize(String(v ?? '—'), W - 2 * M - 42)[0], M + 38, y + 7 + i * 4.6)
  })
  y += 9 + rec.length * 4.6

  if (j.documentoRelacionado) {
    const rel = j.documentoRelacionado[0]
    doc.setFillColor(250, 250, 248)
    doc.roundedRect(M, y, W - 2 * M, 8, 1.5, 1.5, 'F')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK)
    doc.text(`Documento relacionado: ${TIPOS_DTE[rel.tipoDocumento as '03'].nombre} · ${rel.numeroDocumento} · emitido ${rel.fechaEmision}`, M + 3, y + 5.2)
    y += 12
  }

  // --- Detalle ---
  const cols = [
    { t: '#', w: 8, a: 'left' },
    { t: 'Cant.', w: 12, a: 'right' },
    { t: 'Código', w: 26, a: 'left' },
    { t: 'Descripción', w: 70, a: 'left' },
    { t: 'P. unitario', w: 22, a: 'right' },
    { t: 'Descuento', w: 20, a: 'right' },
    { t: 'Ventas gravadas', w: W - 2 * M - 158, a: 'right' },
  ] as const
  doc.setFillColor(...INK)
  doc.rect(M, y, W - 2 * M, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  let x = M
  cols.forEach((c) => {
    doc.text(c.t, c.a === 'right' ? x + c.w - 2 : x + 2, y + 4.6, { align: c.a })
    x += c.w
  })
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...INK)
  ;(j.cuerpoDocumento as J[]).forEach((it, i) => {
    if (y > H - 80) {
      doc.addPage()
      y = 20
    }
    if (i % 2) {
      doc.setFillColor(250, 250, 248)
      doc.rect(M, y, W - 2 * M, 6.5, 'F')
    }
    const vals = [String(it.numItem), String(it.cantidad), it.codigo, doc.splitTextToSize(it.descripcion, 66)[0], money(it.precioUni), money(it.montoDescu), money(it.ventaGravada)]
    x = M
    cols.forEach((c, k) => {
      doc.text(vals[k], c.a === 'right' ? x + c.w - 2 : x + 2, y + 4.3, { align: c.a })
      x += c.w
    })
    y += 6.5
  })
  doc.setDrawColor(...LINE)
  doc.line(M, y, W - M, y)

  // --- Resumen ---
  y += 6
  const rs = j.resumen
  const filas: [string, number][] = [
    ['Suma de ventas gravadas', rs.totalGravada],
    ['Total descuentos', rs.totalDescu],
  ]
  if (dte.tipoDte !== '01') {
    filas.push(['IVA 13% (tributo 20)', rs.tributos?.[0]?.valor ?? 0])
    filas.push(['Sub-total', rs.subTotal])
  } else {
    filas.push(['IVA incluido (13%)', rs.totalIva])
  }
  filas.push(['IVA retenido', rs.ivaRete1 ?? 0])
  const rx = W - M - 78
  filas.forEach(([k, v], i) => {
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(k, rx, y + i * 5)
    doc.setTextColor(...INK)
    doc.text(money(v), W - M, y + i * 5, { align: 'right' })
  })
  const ty = y + filas.length * 5 + 2
  doc.setFillColor(...INK)
  doc.roundedRect(rx - 3, ty - 4.5, 81, 9, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(dte.tipoDte === '05' ? 'MONTO TOTAL NOTA' : 'TOTAL A PAGAR', rx, ty + 1.5)
  doc.text(money(rs.totalPagar ?? rs.montoTotalOperacion), W - M - 2, ty + 1.5, { align: 'right' })

  // Valor en letras y condición
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.setFontSize(7)
  doc.text('Valor en letras', M, y)
  doc.setTextColor(...INK)
  doc.setFontSize(8)
  doc.text(doc.splitTextToSize(rs.totalLetras, 95), M, y + 4.5)
  doc.setTextColor(...MUTED)
  doc.setFontSize(7)
  doc.text('Condición de la operación', M, y + 14)
  doc.setTextColor(...INK)
  doc.setFontSize(8)
  doc.text('Contado', M, y + 18.5)
  if (rs.pagos?.[0]) {
    const fp = Object.values(FORMAS_PAGO).find((f) => f.codigo === rs.pagos[0].codigo)
    doc.setTextColor(...MUTED)
    doc.setFontSize(7)
    doc.text('Forma de pago', M + 40, y + 14)
    doc.setTextColor(...INK)
    doc.setFontSize(8)
    doc.text(`${rs.pagos[0].codigo} · ${fp?.nombre ?? ''}`, M + 40, y + 18.5)
  }
  if (j.extension?.nombEntrega) {
    doc.setTextColor(...MUTED)
    doc.setFontSize(7)
    doc.text('Atendido por', M, y + 26)
    doc.setTextColor(...INK)
    doc.setFontSize(8)
    doc.text(j.extension.nombEntrega, M, y + 30.5)
  }

  // Marca de agua de estado
  if (dte.estado === 'INVALIDADO' || dte.estado === 'CONTINGENCIA' || dte.estado === 'RECHAZADO') {
    const txt = dte.estado === 'INVALIDADO' ? 'INVALIDADO' : dte.estado === 'RECHAZADO' ? 'RECHAZADO' : 'CONTINGENCIA'
    const col = dte.estado === 'CONTINGENCIA' ? [200, 170, 0] : RED
    doc.saveGraphicsState()
    doc.setGState(doc.GState({ opacity: 0.12 }))
    doc.setTextColor(col[0], col[1], col[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(64)
    doc.text(txt, W / 2, H / 2 + 10, { align: 'center', angle: 30 })
    doc.restoreGraphicsState()
  }

  // --- Pie ---
  doc.setDrawColor(...LINE)
  doc.line(M, H - 22, W - M, H - 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text(
    doc.splitTextToSize(
      'Representación gráfica del Documento Tributario Electrónico. Verifique su validez escaneando el código QR o en el portal de consulta pública del Ministerio de Hacienda de El Salvador. Documento generado en ambiente de pruebas con fines académicos.',
      W - 2 * M - 50,
    ),
    M,
    H - 17,
  )
  doc.addImage(await logoPng(), 'PNG', W - M - 26, H - 18.5, 26, 7.9)
  doc.setFontSize(6)
  doc.text('Generado con DAASH ERP & DTE', W - M, H - 8.5, { align: 'right' })
  return doc
}

export async function descargarPdfDte(dte: Dte, config: Config) {
  const doc = await generarPdfDte(dte, config)
  doc.save(`${TIPOS_DTE[dte.tipoDte].corto}-${dte.numeroControl}.pdf`)
}

export async function abrirPdfDte(dte: Dte, config: Config) {
  const doc = await generarPdfDte(dte, config)
  return URL.createObjectURL(doc.output('blob'))
}

export async function pdfCorteZ(t: Turno, cajero: Usuario | undefined, config: Config) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 160] })
  const W = 80
  let y = 10
  doc.addImage(await logoPng(), 'PNG', W / 2 - 15, 4, 30, 9)
  y = 20
  const c = (t2: string, size = 8, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.text(t2, W / 2, y, { align: 'center' })
    y += size * 0.5
  }
  doc.setTextColor(...INK)
  c(config.emisor.nombreComercial, 10, true)
  c(`NIT ${config.emisor.nit} · NRC ${config.emisor.nrc}`, 7)
  y += 2
  c('CORTE DE CAJA  Z', 11, true)
  y += 2
  const row = (k: string, v: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(8)
    doc.text(k, 6, y)
    doc.text(v, W - 6, y, { align: 'right' })
    y += 5
  }
  const r = t.resumen!
  row('Caja', t.caja)
  row('Cajero', cajero?.nombre ?? '')
  row('Apertura', fmtFecha(t.apertura, true))
  row('Cierre', fmtFecha(t.cierre!, true))
  doc.line(6, y - 2, W - 6, y - 2)
  y += 2
  row('Transacciones', String(r.transacciones))
  row('Efectivo', money(r.porMetodo.EFECTIVO))
  row('Tarjeta', money(r.porMetodo.TARJETA))
  row('Transferencia', money(r.porMetodo.TRANSFERENCIA))
  row('TOTAL VENTAS', money(r.ventas), true)
  doc.line(6, y - 2, W - 6, y - 2)
  y += 2
  row('Fondo inicial', money(t.fondoInicial))
  row('Efectivo esperado', money(r.esperadoEfectivo))
  row('Efectivo contado', money(t.efectivoContado ?? 0))
  row('DIFERENCIA', money(r.diferencia), true)
  y += 6
  doc.line(15, y, W - 15, y)
  y += 4
  c('Firma del cajero', 7)
  doc.save(`CorteZ-${t.caja}-${t.cierre?.slice(0, 10)}.pdf`)
}
