import { Download, FileSearch, FileText, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DteDetalle, ESTADOS, EstadoBadge, TipoBadge, useAccionesDte } from '../components/dte'
import { Empty, IconButton, PageHeader, SearchInput, Stat } from '../components/ui'
import { TIPOS_DTE } from '../lib/catalogos'
import { useStore } from '../lib/store'
import type { EstadoDte, TipoDte } from '../lib/types'
import { cx, money } from '../lib/utils'

export default function Documentos() {
  const dtes = useStore((s) => s.dtes)
  const acc = useAccionesDte()
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<TipoDte | ''>('')
  const [estado, setEstado] = useState<EstadoDte | ''>('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [limite, setLimite] = useState(40)

  const lista = useMemo(() => {
    const t = q.toLowerCase()
    return dtes.filter(
      (d) =>
        (!tipo || d.tipoDte === tipo) &&
        (!estado || d.estado === estado) &&
        (!desde || d.fechaEmi >= desde) &&
        (!hasta || d.fechaEmi <= hasta) &&
        (!t || d.numeroControl.toLowerCase().includes(t) || d.id.toLowerCase().includes(t) || d.receptorNombre.toLowerCase().includes(t) || d.selloRecibido?.toLowerCase().includes(t)),
    )
  }, [dtes, q, tipo, estado, desde, hasta])

  const cuenta = (e: EstadoDte) => dtes.filter((d) => d.estado === e).length

  return (
    <>
      <PageHeader eyebrow="Facturación electrónica" title="Documentos tributarios electrónicos" description="Consulta, descarga de PDF y JSON, reenvío, notas de crédito e invalidación de los DTE emitidos." />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {(Object.keys(ESTADOS) as EstadoDte[]).map((e) => (
          <button key={e} onClick={() => setEstado(estado === e ? '' : e)} className={cx('cursor-pointer text-left transition', estado === e && 'rounded-2xl ring-2 ring-ink')}>
            <Stat tone={ESTADOS[e].tone === 'gray' ? undefined : ESTADOS[e].tone} label={ESTADOS[e].label} value={cuenta(e)} />
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <SearchInput className="min-w-72 flex-1" value={q} onChange={setQ} placeholder="Número de control, código de generación, sello o receptor…" icon={<Search className="size-4" />} />
          <select className="input w-auto" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDte)}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS_DTE).map(([k, v]) => <option key={k} value={k}>{k} · {v.nombre}</option>)}
          </select>
          <input type="date" className="input w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <span className="text-muted">—</span>
          <input type="date" className="input w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {lista.length === 0 ? (
          <Empty icon={<FileSearch className="size-5" />} title="Sin documentos" text="Ajusta los filtros de búsqueda." />
        ) : (
          <table className="w-full">
            <thead className="bg-paper/60">
              <tr><th className="th w-16">Tipo</th><th className="th">Número de control</th><th className="th">Receptor</th><th className="th">Emisión</th><th className="th">Estado</th><th className="th text-right">IVA</th><th className="th text-right">Total</th><th className="th w-20" /></tr>
            </thead>
            <tbody>
              {lista.slice(0, limite).map((d) => (
                <tr key={d.id} onClick={() => setSel(d.id)} className="cursor-pointer transition hover:bg-paper/70">
                  <td className="td"><TipoBadge tipo={d.tipoDte} /></td>
                  <td className="td"><p className="font-mono text-[12.5px] whitespace-nowrap">{d.numeroControl}</p><p className="max-w-64 truncate font-mono text-[10.5px] text-muted">{d.id}</p></td>
                  <td className="td">{d.receptorNombre}</td>
                  <td className="td text-muted tabular-nums">{d.fechaEmi} <span className="text-[11px]">{d.horaEmi.slice(0, 5)}</span></td>
                  <td className="td"><EstadoBadge estado={d.estado} /></td>
                  <td className="td text-right text-muted tabular-nums">{money(d.iva)}</td>
                  <td className="td text-right font-semibold tabular-nums">{money(d.total)}</td>
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <IconButton title="Descargar PDF" onClick={() => acc.pdf(d)}><Download className="size-3.5" /></IconButton>
                      <IconButton title="Ver detalle" onClick={() => setSel(d.id)}><FileText className="size-3.5" /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lista.length > limite && (
          <div className="border-t border-line p-3 text-center">
            <button className="cursor-pointer text-[13px] font-medium text-muted hover:text-ink" onClick={() => setLimite(limite + 40)}>Mostrar más ({lista.length - limite} restantes)</button>
          </div>
        )}
      </div>
      <DteDetalle id={sel} onClose={() => setSel(null)} />
    </>
  )
}
