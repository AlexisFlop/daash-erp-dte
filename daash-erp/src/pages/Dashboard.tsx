import { AlertTriangle, ArrowUpRight, Crown, FileText, RadioTower, ShoppingBag, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EstadoBadge, TipoBadge } from '../components/dte'
import { Badge, PageHeader, Segmented, Stagger, StaggerItem, Stat } from '../components/ui'
import { useStore } from '../lib/store'
import { fechaISO, money, num, round2, tiempoRelativo } from '../lib/utils'

const COLORES_CAT = ['#333333', '#73F16F', '#F5E661', '#F54E4E', '#a3a39b']

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-ink px-3 py-2 text-[12px] text-white shadow-lift">
      <p className="text-white/60">{label}</p>
      <p className="font-semibold tabular-nums">{money(payload[0].value)}</p>
    </div>
  )
}

export default function Dashboard() {
  const ventas = useStore((s) => s.ventas)
  const dtes = useStore((s) => s.dtes)
  const productos = useStore((s) => s.productos)
  const usuario = useStore((s) => s.usuarioActual())
  const [rango, setRango] = useState<'7' | '30' | '45'>('30')

  const data = useMemo(() => {
    const invalidos = new Set(dtes.filter((d) => d.estado === 'INVALIDADO').map((d) => d.id))
    const validas = ventas.filter((v) => !invalidos.has(v.dteId))
    const hoy = fechaISO()
    const hace = (d: number) => fechaISO(new Date(Date.now() - d * 86400000))
    const sum = (desde: string) => round2(validas.filter((v) => fechaISO(new Date(v.fecha)) >= desde).reduce((a, v) => a + v.total, 0))
    const inicioMes = hoy.slice(0, 8) + '01'
    const ventasDia: { dia: string; total: number }[] = []
    for (let i = Number(rango) - 1; i >= 0; i--) {
      const f = hace(i)
      ventasDia.push({ dia: new Date(f + 'T12:00').toLocaleDateString('es-SV', { day: '2-digit', month: 'short' }), total: round2(validas.filter((v) => fechaISO(new Date(v.fecha)) === f).reduce((a, v) => a + v.total, 0)) })
    }
    const porProducto: Record<string, number> = {}
    const porCategoria: Record<string, number> = {}
    validas.filter((v) => fechaISO(new Date(v.fecha)) >= inicioMes).forEach((v) =>
      v.items.forEach((it) => {
        porProducto[it.productoId] = (porProducto[it.productoId] ?? 0) + it.cantidad
        const cat = productos.find((p) => p.id === it.productoId)?.categoria ?? 'Otros'
        porCategoria[cat] = round2((porCategoria[cat] ?? 0) + it.cantidad * it.precio)
      }),
    )
    const top = Object.entries(porProducto).sort((a, b) => b[1] - a[1])
    return {
      hoy: sum(hoy),
      semana: sum(hace(6)),
      mes: sum(inicioMes),
      transHoy: validas.filter((v) => fechaISO(new Date(v.fecha)) === hoy).length,
      ventasDia,
      top: top.slice(0, 5).map(([id, q]) => ({ p: productos.find((x) => x.id === id)!, q })),
      categorias: Object.entries(porCategoria).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      ticket: validas.length ? round2(validas.reduce((a, v) => a + v.total, 0) / validas.length) : 0,
    }
  }, [ventas, dtes, productos, rango])

  const bajoStock = productos.filter((p) => p.activo && p.stock <= p.stockMinimo)
  const contingencia = dtes.filter((d) => d.estado === 'CONTINGENCIA').length
  const recientes = dtes.slice(0, 6)
  const hora = new Date().getHours()

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches'}, ${usuario?.nombre.split(' ')[0]}`}
        description="Resumen del rendimiento comercial y del estado de la facturación electrónica."
      />
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem><Stat tone="green" label="Ventas de hoy" value={money(data.hoy)} hint={`${data.transHoy} transacciones`} icon={<ShoppingBag className="size-4" />} /></StaggerItem>
        <StaggerItem><Stat label="Últimos 7 días" value={money(data.semana)} hint={`Ticket promedio ${money(data.ticket)}`} icon={<TrendingUp className="size-4" />} /></StaggerItem>
        <StaggerItem><Stat label="Total facturado del mes" value={money(data.mes)} hint="IVA incluido · excluye invalidados" icon={<FileText className="size-4" />} /></StaggerItem>
        <StaggerItem>
          <Stat
            tone="yellow"
            label="Producto más vendido (mes)"
            value={<span className="text-[17px] leading-snug">{data.top[0]?.p.nombre ?? '—'}</span>}
            hint={data.top[0] ? `${data.top[0].q} unidades` : ''}
            icon={<Crown className="size-4" />}
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">Ventas diarias</p>
              <p className="text-[12.5px] text-muted">Tiempo real · total con IVA</p>
            </div>
            <Segmented value={rango} onChange={setRango} options={[{ value: '7', label: '7 d' }, { value: '30', label: '30 d' }, { value: '45', label: '45 d' }]} />
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data.ventasDia} margin={{ left: -10, right: 4, top: 4 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#73F16F" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#73F16F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eeeeea" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#77776f' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: '#77776f' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                <Tooltip content={<TooltipBox />} cursor={{ stroke: '#333', strokeDasharray: 3 }} />
                <Area type="monotone" dataKey="total" stroke="#333333" strokeWidth={2} fill="url(#g)" animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-5">
          <p className="font-semibold">Ventas por categoría</p>
          <p className="mb-4 text-[12.5px] text-muted">Mes en curso · sin IVA</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.categorias} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12, fill: '#333' }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipBox />} cursor={{ fill: '#f4f4f1' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} animationDuration={700}>
                  {data.categorias.map((_, i) => <Cell key={i} fill={COLORES_CAT[i % COLORES_CAT.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="font-semibold">Documentos recientes</p>
            <Link to="/dte" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">Ver todos <ArrowUpRight className="size-3.5" /></Link>
          </div>
          <table className="w-full">
            <tbody>
              {recientes.map((d) => (
                <tr key={d.id} className="transition hover:bg-paper/60">
                  <td className="td w-14"><TipoBadge tipo={d.tipoDte} /></td>
                  <td className="td"><p className="font-mono text-[12px]">{d.numeroControl}</p><p className="text-[12px] text-muted">{d.receptorNombre}</p></td>
                  <td className="td text-[12px] text-muted">{tiempoRelativo(d.creado)}</td>
                  <td className="td"><EstadoBadge estado={d.estado} /></td>
                  <td className="td text-right font-semibold tabular-nums">{money(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          {contingencia > 0 && (
            <Link to="/contingencia" className="card flex items-center gap-4 border-sun bg-sun-50 p-5 transition hover:shadow-lift">
              <span className="flex size-10 items-center justify-center rounded-xl bg-sun text-ink"><RadioTower className="size-5" /></span>
              <div>
                <p className="font-semibold">{contingencia} DTE en contingencia</p>
                <p className="text-[12.5px] text-sun-800">Se reintentarán automáticamente</p>
              </div>
            </Link>
          )}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-coral" /> Alertas de reorden</p>
              <Badge tone={bajoStock.length ? 'red' : 'green'}>{bajoStock.length}</Badge>
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {bajoStock.length === 0 && <li className="px-5 pb-5 text-sm text-muted">Todo el inventario está sobre el mínimo.</li>}
              {bajoStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-coral-700">{p.nombre}</p>
                    <p className="font-mono text-[11px] text-muted">{p.sku}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-coral-50 px-2 py-1 text-[12px] font-semibold text-coral-700 tabular-nums ring-1 ring-coral/20">{num(p.stock)} / {p.stockMinimo}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
