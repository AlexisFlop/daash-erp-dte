import { FileSpreadsheet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, PageHeader, Segmented, Stat, toast } from '../components/ui'
import { useStore } from '../lib/store'
import { descargar, fechaISO, money, round2 } from '../lib/utils'

type Libro = 'consumidor' | 'contribuyente' | 'compras' | 'inventario'

function csv(nombre: string, cab: string[], filas: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = typeof v === 'number' ? v.toFixed(2) : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // Separador ";" y BOM UTF-8 para apertura directa en Excel (configuración regional es-SV)
  const txt = '﻿' + [cab, ...filas].map((f) => f.map(esc).join(';')).join('\r\n')
  descargar(nombre, new Blob([txt], { type: 'text/csv;charset=utf-8' }))
  toast.ok('Exportación lista', nombre)
}

export default function Reportes() {
  const dtes = useStore((s) => s.dtes)
  const compras = useStore((s) => s.compras)
  const proveedores = useStore((s) => s.proveedores)
  const productos = useStore((s) => s.productos)
  const clientes = useStore((s) => s.clientes)
  const config = useStore((s) => s.config)
  const hoy = fechaISO()
  const [desde, setDesde] = useState(hoy.slice(0, 8) + '01')
  const [hasta, setHasta] = useState(hoy)
  const [libro, setLibro] = useState<Libro>('consumidor')

  const enRango = (f: string) => f >= desde && f <= hasta
  const validos = dtes.filter((d) => d.estado !== 'INVALIDADO' && d.estado !== 'RECHAZADO' && enRango(d.fechaEmi))

  const consumidor = useMemo(() => {
    const porDia: Record<string, { del: string; al: string; n: number; gravadas: number; exentas: number; total: number }> = {}
    validos
      .filter((d) => d.tipoDte === '01')
      .slice()
      .sort((a, b) => a.numeroControl.localeCompare(b.numeroControl))
      .forEach((d) => {
        const r = (porDia[d.fechaEmi] ??= { del: d.numeroControl, al: d.numeroControl, n: 0, gravadas: 0, exentas: 0, total: 0 })
        r.al = d.numeroControl
        r.n++
        r.gravadas = round2(r.gravadas + d.total)
        r.total = round2(r.total + d.total)
      })
    return Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b))
  }, [validos])

  const contribuyente = useMemo(
    () =>
      validos
        .filter((d) => d.tipoDte === '03' || d.tipoDte === '05')
        .slice()
        .sort((a, b) => (a.fechaEmi + a.horaEmi).localeCompare(b.fechaEmi + b.horaEmi))
        .map((d) => {
          const c = clientes.find((x) => x.id === d.clienteId)
          const s = d.tipoDte === '05' ? -1 : 1
          return { d, c, gravadas: round2(s * (d.total - d.iva)), iva: round2(s * d.iva), total: round2(s * d.total) }
        }),
    [validos, clientes],
  )
  const comprasR = compras.filter((c) => enRango(fechaISO(new Date(c.fecha))))

  const totCons = consumidor.reduce((a, [, r]) => a + r.total, 0)
  const ivaCons = round2(totCons - totCons / 1.13)
  const totContrib = contribuyente.reduce((a, r) => a + r.total, 0)
  const ivaContrib = contribuyente.reduce((a, r) => a + r.iva, 0)
  const ivaCompras = comprasR.reduce((a, c) => a + c.iva, 0)
  const debito = round2(ivaCons + ivaContrib)

  const exportar = () => {
    const suf = `${desde}_${hasta}`
    if (libro === 'consumidor')
      csv(`Libro_Ventas_Consumidor_${suf}.csv`, ['Fecha', 'Del No.', 'Al No.', 'Documentos', 'Ventas exentas', 'Ventas no sujetas', 'Ventas gravadas locales', 'Exportaciones', 'Total ventas', 'IVA incluido'], consumidor.map(([f, r]) => [f, r.del, r.al, String(r.n), r.exentas, 0, r.gravadas, 0, r.total, round2(r.total - r.total / 1.13)]))
    if (libro === 'contribuyente')
      csv(`Libro_Ventas_Contribuyentes_${suf}.csv`, ['Fecha', 'Tipo', 'Número de control', 'Código de generación', 'Sello', 'NRC', 'Cliente', 'Ventas exentas', 'Ventas no sujetas', 'Ventas gravadas', 'Débito fiscal', 'IVA retenido', 'Total'], contribuyente.map(({ d, c, gravadas, iva, total }) => [d.fechaEmi, d.tipoDte, d.numeroControl, d.id, d.selloRecibido ?? 'CONTINGENCIA', c?.nrc ?? '', d.receptorNombre, 0, 0, gravadas, iva, 0, total]))
    if (libro === 'compras')
      csv(`Libro_Compras_${suf}.csv`, ['Fecha', 'Comprobante', 'NRC', 'NIT', 'Proveedor', 'Compras exentas', 'Compras gravadas', 'Crédito fiscal', 'Total'], comprasR.map((c) => { const p = proveedores.find((x) => x.id === c.proveedorId); return [fechaISO(new Date(c.fecha)), c.numeroComprobante, p?.nrc ?? '', p?.nit ?? '', p?.razonSocial ?? '', 0, c.subtotal, c.iva, c.total] }))
    if (libro === 'inventario')
      csv(`Inventario_Valorizado_${hoy}.csv`, ['SKU', 'Producto', 'Categoría', 'Existencia', 'Stock mínimo', 'Costo promedio', 'Valor costo', 'Precio venta', 'Estado'], productos.map((p) => [p.sku, p.nombre, p.categoria, String(p.stock), String(p.stockMinimo), p.costo, round2(p.costo * p.stock), p.precio, p.stock <= p.stockMinimo ? 'REORDEN' : 'OK']))
  }

  return (
    <>
      <PageHeader
        eyebrow="Análisis"
        title="Reportes y libros de IVA"
        description={`Libros de ventas y compras para la declaración mensual de IVA (F-07) de ${config.emisor.nombre}. Exportación en CSV compatible con Excel.`}
        actions={<Button icon={<FileSpreadsheet className="size-4" />} onClick={exportar}>Exportar a Excel (CSV)</Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Ventas a consumidor final" value={money(totCons)} hint={`IVA incluido ${money(ivaCons)}`} />
        <Stat label="Ventas a contribuyentes" value={money(totContrib)} hint={`Débito fiscal ${money(ivaContrib)}`} />
        <Stat tone="green" label="Crédito fiscal (compras)" value={money(ivaCompras)} />
        <Stat tone={debito - ivaCompras > 0 ? 'yellow' : 'green'} label="IVA a pagar estimado" value={money(Math.max(0, debito - ivaCompras))} hint={debito - ivaCompras < 0 ? `Remanente ${money(ivaCompras - debito)}` : 'Débito − crédito fiscal'} />
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <Segmented value={libro} onChange={setLibro} options={[{ value: 'consumidor', label: 'Ventas consumidor' }, { value: 'contribuyente', label: 'Ventas contribuyentes' }, { value: 'compras', label: 'Compras' }, { value: 'inventario', label: 'Inventario valorizado' }]} />
          {libro !== 'inventario' && (
            <div className="flex items-center gap-2">
              <input type="date" className="input w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
              <span className="text-muted">—</span>
              <input type="date" className="input w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          )}
        </div>
        <div className="max-h-[60vh] overflow-auto">
          {libro === 'consumidor' && (
            <table className="w-full">
              <thead className="sticky top-0 bg-paper"><tr><th className="th">Fecha</th><th className="th">Del No.</th><th className="th">Al No.</th><th className="th text-right">Docs.</th><th className="th text-right">Exentas</th><th className="th text-right">Gravadas</th><th className="th text-right">Total</th></tr></thead>
              <tbody>
                {consumidor.map(([f, r]) => (
                  <tr key={f}><td className="td">{f}</td><td className="td font-mono text-[11.5px]">{r.del.slice(-8)}</td><td className="td font-mono text-[11.5px]">{r.al.slice(-8)}</td><td className="td text-right tabular-nums">{r.n}</td><td className="td text-right text-muted tabular-nums">{money(0)}</td><td className="td text-right tabular-nums">{money(r.gravadas)}</td><td className="td text-right font-semibold tabular-nums">{money(r.total)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-paper font-semibold"><td className="td" colSpan={5}>Totales</td><td className="td text-right tabular-nums">{money(totCons)}</td><td className="td text-right tabular-nums">{money(totCons)}</td></tr></tfoot>
            </table>
          )}
          {libro === 'contribuyente' && (
            <table className="w-full">
              <thead className="sticky top-0 bg-paper"><tr><th className="th">Fecha</th><th className="th">Tipo</th><th className="th">Número de control</th><th className="th">NRC</th><th className="th">Cliente</th><th className="th text-right">Gravadas</th><th className="th text-right">Débito fiscal</th><th className="th text-right">Total</th></tr></thead>
              <tbody>
                {contribuyente.map(({ d, c, gravadas, iva, total }) => (
                  <tr key={d.id}><td className="td">{d.fechaEmi}</td><td className="td font-mono text-[12px]">{d.tipoDte}</td><td className="td font-mono text-[11.5px]">{d.numeroControl}</td><td className="td font-mono text-[12px]">{c?.nrc}</td><td className="td">{d.receptorNombre}</td><td className="td text-right tabular-nums">{money(gravadas)}</td><td className="td text-right tabular-nums">{money(iva)}</td><td className="td text-right font-semibold tabular-nums">{money(total)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-paper font-semibold"><td className="td" colSpan={5}>Totales</td><td className="td text-right tabular-nums">{money(totContrib - ivaContrib)}</td><td className="td text-right tabular-nums">{money(ivaContrib)}</td><td className="td text-right tabular-nums">{money(totContrib)}</td></tr></tfoot>
            </table>
          )}
          {libro === 'compras' && (
            <table className="w-full">
              <thead className="sticky top-0 bg-paper"><tr><th className="th">Fecha</th><th className="th">Comprobante</th><th className="th">NRC</th><th className="th">Proveedor</th><th className="th text-right">Gravadas</th><th className="th text-right">Crédito fiscal</th><th className="th text-right">Total</th></tr></thead>
              <tbody>
                {comprasR.map((c) => { const p = proveedores.find((x) => x.id === c.proveedorId); return <tr key={c.id}><td className="td">{fechaISO(new Date(c.fecha))}</td><td className="td font-mono text-[12px]">{c.numeroComprobante}</td><td className="td font-mono text-[12px]">{p?.nrc}</td><td className="td">{p?.razonSocial}</td><td className="td text-right tabular-nums">{money(c.subtotal)}</td><td className="td text-right tabular-nums">{money(c.iva)}</td><td className="td text-right font-semibold tabular-nums">{money(c.total)}</td></tr> })}
                {comprasR.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-muted">Sin compras en el período</td></tr>}
              </tbody>
            </table>
          )}
          {libro === 'inventario' && (
            <table className="w-full">
              <thead className="sticky top-0 bg-paper"><tr><th className="th">SKU</th><th className="th">Producto</th><th className="th">Categoría</th><th className="th text-right">Existencia</th><th className="th text-right">Costo</th><th className="th text-right">Valor</th></tr></thead>
              <tbody>
                {productos.map((p) => <tr key={p.id} className={p.stock <= p.stockMinimo ? 'bg-coral-50/50' : ''}><td className="td font-mono text-[12px]">{p.sku}</td><td className={`td ${p.stock <= p.stockMinimo ? 'text-coral-700' : ''}`}>{p.nombre}</td><td className="td text-muted">{p.categoria}</td><td className="td text-right tabular-nums">{p.stock}</td><td className="td text-right tabular-nums">{money(p.costo)}</td><td className="td text-right font-semibold tabular-nums">{money(p.costo * p.stock)}</td></tr>)}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
