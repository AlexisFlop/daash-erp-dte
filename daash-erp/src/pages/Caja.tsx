import { motion } from 'framer-motion'
import { Banknote, CreditCard, Landmark, Lock, Printer, Receipt, Unlock, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Field, Modal, PageHeader, Stat, toast } from '../components/ui'
import { pdfCorteZ } from '../lib/pdf'
import { useStore } from '../lib/store'
import type { MetodoPago, Turno } from '../lib/types'
import { cx, fmtFecha, money, round2 } from '../lib/utils'

const DENOMINACIONES = [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01]

function Arqueo({ onTotal }: { onTotal: (n: number) => void }) {
  const [c, setC] = useState<Record<number, number>>({})
  const total = round2(DENOMINACIONES.reduce((a, d) => a + d * (c[d] ?? 0), 0))
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {DENOMINACIONES.map((d) => (
          <div key={d} className="flex items-center gap-2">
            <span className="w-16 text-right text-[13px] font-medium tabular-nums">{d >= 1 ? `$${d}` : `${Math.round(d * 100)}¢`}</span>
            <span className="text-muted">×</span>
            <input
              type="number"
              min={0}
              className="input h-9 w-20 text-right tabular-nums"
              value={c[d] ?? ''}
              onChange={(e) => {
                const n = { ...c, [d]: Math.max(0, Number(e.target.value)) }
                setC(n)
                onTotal(round2(DENOMINACIONES.reduce((a, x) => a + x * (n[x] ?? 0), 0)))
              }}
            />
            <span className="flex-1 text-right text-[12px] text-muted tabular-nums">{money(d * (c[d] ?? 0))}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-paper px-4 py-3">
        <span className="text-sm text-muted">Efectivo contado</span>
        <span className="text-lg font-semibold tabular-nums">{money(total)}</span>
      </div>
    </div>
  )
}

export default function Caja() {
  const turno = useStore((s) => s.turnoAbierto())
  const turnos = useStore((s) => s.turnos)
  const ventas = useStore((s) => s.ventas)
  const dtes = useStore((s) => s.dtes)
  const usuarios = useStore((s) => s.usuarios)
  const config = useStore((s) => s.config)
  const abrir = useStore((s) => s.abrirTurno)
  const cerrar = useStore((s) => s.cerrarTurno)
  const puedeC = useStore((s) => s.puede('caja', 'c'))
  const [fondo, setFondo] = useState('100.00')
  const [caja, setCaja] = useState('Caja 01')
  const [modalZ, setModalZ] = useState(false)
  const [contado, setContado] = useState(0)
  const [cerrado, setCerrado] = useState<Turno | null>(null)

  const vTurno = turno ? ventas.filter((v) => v.turnoId === turno.id && dtes.find((d) => d.id === v.dteId)?.estado !== 'INVALIDADO') : []
  const porMetodo = (m: MetodoPago) => round2(vTurno.filter((v) => v.metodoPago === m).reduce((a, v) => a + v.total, 0))
  const total = round2(vTurno.reduce((a, v) => a + v.total, 0))
  const esperado = turno ? round2(turno.fondoInicial + porMetodo('EFECTIVO')) : 0

  return (
    <>
      <PageHeader eyebrow="Operación" title="Caja y turnos" description="Apertura de turno con fondo inicial, arqueo de efectivo y corte de caja Z por método de pago." />

      {!turno ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card mb-6 grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-paper text-muted ring-1 ring-line"><Lock className="size-5" /></span>
            <div>
              <p className="text-lg font-semibold">No tienes un turno abierto</p>
              <p className="text-sm text-muted">El sistema no permite procesar ventas sin una caja abierta (RF-09).</p>
            </div>
          </div>
          {puedeC && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Caja">
                <select className="input w-36" value={caja} onChange={(e) => setCaja(e.target.value)}>
                  <option>Caja 01</option><option>Caja 02</option><option>Caja 03</option>
                </select>
              </Field>
              <Field label="Fondo inicial">
                <input type="number" step="0.01" className="input w-36 text-right tabular-nums" value={fondo} onChange={(e) => setFondo(e.target.value)} />
              </Field>
              <Button icon={<Unlock className="size-4" />} onClick={async () => { if (await abrir(Number(fondo) || 0, caja)) toast.ok('Turno abierto', `${caja} · fondo ${money(Number(fondo))}`) }}>Abrir turno</Button>
            </div>
          )}
        </motion.div>
      ) : (
        <>
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-4">
              <span className="relative flex size-12 items-center justify-center rounded-2xl bg-ink text-leaf"><Wallet className="size-5" /><span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-leaf ring-2 ring-white" /></span>
              <div>
                <p className="text-lg font-semibold">{turno.caja} · turno abierto</p>
                <p className="text-sm text-muted">Desde {fmtFecha(turno.apertura, true)} · fondo inicial {money(turno.fondoInicial)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/pos"><Button variant="secondary" icon={<Receipt className="size-4" />}>Ir al POS</Button></Link>
              <Button variant="primary" icon={<Lock className="size-4" />} onClick={() => { setContado(0); setModalZ(true) }}>Realizar corte Z</Button>
            </div>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-5">
            <Stat tone="green" label="Ventas del turno" value={money(total)} hint={`${vTurno.length} transacciones`} />
            <Stat label="Efectivo" value={money(porMetodo('EFECTIVO'))} icon={<Banknote className="size-4" />} />
            <Stat label="Tarjeta" value={money(porMetodo('TARJETA'))} icon={<CreditCard className="size-4" />} />
            <Stat label="Transferencia" value={money(porMetodo('TRANSFERENCIA'))} icon={<Landmark className="size-4" />} />
            <Stat tone="yellow" label="Efectivo esperado en caja" value={money(esperado)} hint="Fondo + ventas en efectivo" />
          </div>
        </>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 pt-5 pb-3"><p className="font-semibold">Historial de cortes Z</p></div>
        <table className="w-full">
          <thead className="bg-paper/60">
            <tr><th className="th">Caja</th><th className="th">Cajero</th><th className="th">Apertura</th><th className="th">Cierre</th><th className="th text-right">Trans.</th><th className="th text-right">Ventas</th><th className="th text-right">Diferencia</th><th className="th w-12" /></tr>
          </thead>
          <tbody>
            {turnos.filter((t) => t.estado === 'CERRADO').slice(0, 25).map((t) => (
              <tr key={t.id} className="hover:bg-paper/60">
                <td className="td font-medium">{t.caja}</td>
                <td className="td">{usuarios.find((u) => u.id === t.usuarioId)?.nombre}</td>
                <td className="td text-muted">{fmtFecha(t.apertura, true)}</td>
                <td className="td text-muted">{fmtFecha(t.cierre!, true)}</td>
                <td className="td text-right tabular-nums">{t.resumen?.transacciones}</td>
                <td className="td text-right font-semibold tabular-nums">{money(t.resumen?.ventas ?? 0)}</td>
                <td className="td text-right"><Badge tone={t.resumen?.diferencia === 0 ? 'green' : 'red'}>{money(t.resumen?.diferencia ?? 0)}</Badge></td>
                <td className="td"><button className="cursor-pointer text-muted hover:text-ink" title="Imprimir corte Z" onClick={() => pdfCorteZ(t, usuarios.find((u) => u.id === t.usuarioId), config)}><Printer className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalZ}
        onClose={() => { setModalZ(false); setCerrado(null) }}
        title={cerrado ? 'Corte Z completado' : 'Corte de caja Z'}
        subtitle={cerrado ? 'El turno fue cerrado' : 'Cuenta el efectivo físico por denominación'}
        size="lg"
        footer={
          cerrado ? (
            <>
              <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => pdfCorteZ(cerrado, usuarios.find((u) => u.id === cerrado.usuarioId), config)}>Imprimir ticket Z</Button>
              <Button onClick={() => { setModalZ(false); setCerrado(null) }}>Listo</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setModalZ(false)}>Cancelar</Button>
              <Button icon={<Lock className="size-4" />} onClick={async () => { const t = await cerrar(contado); if (t) { setCerrado(t); toast.ok('Turno cerrado', `Diferencia ${money(t.resumen!.diferencia)}`) } }}>Cerrar turno</Button>
            </>
          )
        }
      >
        {cerrado ? (
          <div className="space-y-2 text-sm">
            {[
              ['Transacciones', String(cerrado.resumen!.transacciones)],
              ['Efectivo', money(cerrado.resumen!.porMetodo.EFECTIVO)],
              ['Tarjeta', money(cerrado.resumen!.porMetodo.TARJETA)],
              ['Transferencia', money(cerrado.resumen!.porMetodo.TRANSFERENCIA)],
              ['Total ventas', money(cerrado.resumen!.ventas)],
              ['Efectivo esperado', money(cerrado.resumen!.esperadoEfectivo)],
              ['Efectivo contado', money(cerrado.efectivoContado!)],
            ].map(([k, v]) => <div key={k} className="flex justify-between border-b border-line py-2"><span className="text-muted">{k}</span><span className="font-medium tabular-nums">{v}</span></div>)}
            <div className={cx('mt-3 flex justify-between rounded-xl px-4 py-3 font-semibold', cerrado.resumen!.diferencia === 0 ? 'bg-leaf-50 text-leaf-700' : 'bg-coral-50 text-coral-700')}>
              <span>Diferencia</span><span className="tabular-nums">{money(cerrado.resumen!.diferencia)}</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_220px]">
            <Arqueo onTotal={setContado} />
            <div className="space-y-3 rounded-2xl bg-paper p-4 text-[13px]">
              <p className="font-semibold">Resumen del sistema</p>
              <div className="flex justify-between"><span className="text-muted">Fondo inicial</span><span className="tabular-nums">{money(turno?.fondoInicial ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Ventas efectivo</span><span className="tabular-nums">{money(porMetodo('EFECTIVO'))}</span></div>
              <div className="flex justify-between font-semibold"><span>Esperado</span><span className="tabular-nums">{money(esperado)}</span></div>
              <div className="h-px bg-line" />
              <div className={cx('flex justify-between font-semibold', round2(contado - esperado) === 0 ? 'text-leaf-700' : 'text-coral-700')}>
                <span>Diferencia</span><span className="tabular-nums">{money(round2(contado - esperado))}</span>
              </div>
              <button className="cursor-pointer text-[12px] font-medium text-ink underline-offset-2 hover:underline" onClick={() => setContado(esperado)}>Usar monto exacto</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
