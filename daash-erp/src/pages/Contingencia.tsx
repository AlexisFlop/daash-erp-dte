import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff, FileClock, RefreshCw, Server, ServerCrash, Timer, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DteDetalle, TipoBadge } from '../components/dte'
import { Badge, Button, Drawer, Empty, Field, JsonView, Modal, PageHeader, toast } from '../components/ui'
import { TIPOS_CONTINGENCIA } from '../lib/catalogos'
import { useStore } from '../lib/store'
import { useShallow } from 'zustand/react/shallow'
import type { EventoContingencia } from '../lib/types'
import { cx, fmtFecha, money } from '../lib/utils'

function useAhora() {
  const [t, setT] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])
  return t
}

const PASOS = [
  { t: 'Detección', d: 'El servicio de recepción del MH no responde o se reporta una falla del emisor.' },
  { t: 'Emisión diferida', d: 'Los DTE se generan con tipoModelo 2 y tipoOperacion 2; las ventas no se detienen.' },
  { t: 'Evento de contingencia', d: 'Al restablecerse el servicio se transmite el evento con el detalle de DTE afectados.' },
  { t: 'Transmisión de lotes', d: 'Se envían los DTE pendientes y cada uno recibe su sello de recepción.' },
]

export default function Contingencia() {
  const config = useStore((s) => s.config)
  const eventos = useStore((s) => s.eventos)
  const pendientes = useStore(useShallow((s) => s.dtes.filter((d) => d.estado === 'CONTINGENCIA')))
  const setMh = useStore((s) => s.setMhEnLinea)
  const reintentar = useStore((s) => s.ejecutarReintento)
  const puede = useStore((s) => s.puede('contingencia', 'u'))
  const ahora = useAhora()
  const [modal, setModal] = useState(false)
  const [tipo, setTipo] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false)
  const [evSel, setEvSel] = useState<EventoContingencia | null>(null)
  const [dteSel, setDteSel] = useState<string | null>(null)

  const activo = eventos.find((e) => e.estado === 'ACTIVO')
  const pendienteEnvio = eventos.some((e) => e.estado === 'PENDIENTE_ENVIO')
  const seg = config.proximoReintento ? Math.max(0, Math.ceil((new Date(config.proximoReintento).getTime() - ahora) / 1000)) : null
  const intervalo = config.modoDemo ? 20 : 300
  const paso = config.mhEnLinea ? (pendienteEnvio || pendientes.length ? 3 : -1) : pendientes.length ? 1 : 0

  return (
    <>
      <PageHeader
        eyebrow="Facturación electrónica"
        title="Contingencia del Ministerio de Hacienda"
        description="Continuidad operativa ante fallas de comunicación: emisión en modelo diferido, cola de reintentos automáticos y transmisión del evento de contingencia."
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <motion.div layout className={cx('card relative overflow-hidden p-7 transition-colors duration-500', config.mhEnLinea ? '' : 'border-sun bg-sun-50')}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.span key={String(config.mhEnLinea)} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className={cx('flex size-16 items-center justify-center rounded-2xl', config.mhEnLinea ? 'bg-ink text-leaf' : 'bg-sun text-ink')}>
                    {config.mhEnLinea ? <Server className="size-7" /> : <ServerCrash className="size-7" />}
                  </motion.span>
                </AnimatePresence>
                <span className={cx('absolute -top-1 -right-1 size-4 rounded-full ring-4', config.mhEnLinea ? 'bg-leaf ring-white' : 'bg-coral ring-sun-50')}>
                  <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-50" />
                </span>
              </div>
              <div>
                <p className="text-[12px] font-semibold tracking-[0.14em] text-muted uppercase">Servicio de recepción DTE</p>
                <p className="text-[28px] leading-tight font-semibold tracking-tight">{config.mhEnLinea ? 'En línea' : 'Fuera de servicio'}</p>
                <p className="text-sm text-muted">
                  {config.mhEnLinea ? 'Las transmisiones se realizan en modelo previo (tiempo real).' : `Contingencia activa desde ${activo ? fmtFecha(activo.fInicio, true) : '—'}`}
                </p>
              </div>
            </div>
            {puede && (
              <div className="flex gap-2">
                {config.mhEnLinea ? (
                  <Button variant="secondary" icon={<CloudOff className="size-4" />} onClick={() => setModal(true)}>Simular caída del MH</Button>
                ) : (
                  <Button icon={<Wifi className="size-4" />} onClick={async () => { if (await setMh(true)) toast.ok('Servicio restablecido', 'El servidor transmitirá el evento de contingencia y los lotes pendientes') }}>Restablecer servicio</Button>
                )}
              </div>
            )}
          </div>
          {!config.mhEnLinea && activo && (
            <div className="mt-6 grid gap-3 rounded-xl bg-white/70 p-4 text-[13px] ring-1 ring-sun md:grid-cols-3">
              <div><p className="label mb-0">Tipo (CAT-005)</p><p className="font-medium">{activo.tipoContingencia} · {TIPOS_CONTINGENCIA[activo.tipoContingencia]}</p></div>
              <div><p className="label mb-0">DTE afectados</p><p className="font-medium">{activo.dtes.length}</p></div>
              <div><p className="label mb-0">Código del evento</p><p className="font-mono text-[11.5px]">{activo.id}</p></div>
            </div>
          )}
        </motion.div>

        <div className="card p-7">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold"><Timer className="size-4" /> Cron de reintentos</p>
            <Badge tone="gray">cada {config.modoDemo ? `${intervalo} s (demo)` : '5 min'}</Badge>
          </div>
          <div className="mt-6 flex items-end gap-4">
            <div className="relative size-24">
              <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
                <circle cx="50" cy="50" r="44" stroke="#eeeeea" strokeWidth="8" fill="none" />
                <motion.circle cx="50" cy="50" r="44" stroke={config.mhEnLinea ? '#73F16F' : '#F5E661'} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={276.5} animate={{ strokeDashoffset: seg === null ? 276.5 : 276.5 * (seg / intervalo) }} transition={{ duration: 0.5 }} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums">{seg === null ? '—' : seg >= 60 ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : `${seg}s`}</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-muted">{seg === null ? 'Sin documentos pendientes en cola.' : 'Próximo intento automático de transmisión.'}</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums">{pendientes.length} <span className="text-sm font-normal text-muted">DTE en cola</span></p>
            </div>
          </div>
          <Button
            className="mt-6 w-full"
            variant="secondary"
            loading={cargando}
            icon={<RefreshCw className="size-4" />}
            disabled={!pendientes.length && !pendienteEnvio}
            onClick={async () => {
              setCargando(true)
              const r = await reintentar(true)
              setCargando(false)
              if (r.fallo) toast.error('Reintento fallido', 'El MH sigue sin responder; se reprogramó el siguiente intento')
              else toast.ok('Transmisión completada', `${r.transmitidos} DTE sellados`)
            }}
          >
            Reintentar ahora
          </Button>
        </div>
      </div>

      {/* Línea de proceso */}
      <div className="card mt-4 p-6">
        <p className="mb-5 font-semibold">Flujo de contingencia</p>
        <div className="grid gap-4 md:grid-cols-4">
          {PASOS.map((p, i) => (
            <div key={p.t} className="relative">
              <div className="mb-3 flex items-center gap-3">
                <motion.span animate={{ scale: i === paso ? [1, 1.12, 1] : 1 }} transition={{ repeat: i === paso ? Infinity : 0, duration: 1.6 }} className={cx('flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', i < paso ? 'bg-leaf text-ink' : i === paso ? 'bg-ink text-white' : 'bg-paper text-muted ring-1 ring-line')}>
                  {i + 1}
                </motion.span>
                {i < 3 && <span className={cx('h-0.5 flex-1 rounded-full', i < paso ? 'bg-leaf' : 'bg-line')} />}
              </div>
              <p className={cx('text-[14px] font-semibold', i > paso && paso !== -1 && 'text-muted')}>{p.t}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{p.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-[12.5px] text-muted ring-1 ring-line">
          Conforme a la normativa DTE, el evento de contingencia y los documentos emitidos en modelo diferido deben transmitirse al MH dentro del plazo establecido (72 horas) posterior a la finalización del evento.
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3"><p className="font-semibold">Cola de documentos pendientes</p></div>
          {pendientes.length === 0 ? (
            <Empty icon={<FileClock className="size-5" />} title="Cola vacía" text='Activa "Simular caída del MH" y realiza una venta en el POS para ver el flujo.' />
          ) : (
            <table className="w-full">
              <tbody>
                <AnimatePresence>
                  {pendientes.map((d) => (
                    <motion.tr key={d.id} layout exit={{ opacity: 0, x: 30 }} onClick={() => setDteSel(d.id)} className="cursor-pointer hover:bg-paper/60">
                      <td className="td w-14"><TipoBadge tipo={d.tipoDte} /></td>
                      <td className="td"><p className="font-mono text-[12px]">{d.numeroControl}</p><p className="text-[12px] text-muted">{d.receptorNombre}</p></td>
                      <td className="td text-[12px] text-muted">{d.intentos} intento(s)</td>
                      <td className="td text-right font-semibold tabular-nums">{money(d.total)}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 pt-5 pb-3"><p className="font-semibold">Eventos de contingencia</p></div>
          {eventos.length === 0 ? (
            <Empty icon={<CloudOff className="size-5" />} title="Sin eventos registrados" />
          ) : (
            <table className="w-full">
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} onClick={() => setEvSel(e)} className="cursor-pointer hover:bg-paper/60">
                    <td className="td"><p className="font-mono text-[12px]">{e.id.slice(0, 18)}…</p><p className="text-[12px] text-muted">{TIPOS_CONTINGENCIA[e.tipoContingencia]}</p></td>
                    <td className="td text-[12px] text-muted">{fmtFecha(e.fInicio, true)}{e.fFin && <> → {new Date(e.fFin).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</>}</td>
                    <td className="td text-right tabular-nums">{e.dtes.length} DTE</td>
                    <td className="td"><Badge tone={e.estado === 'TRANSMITIDO' ? 'green' : e.estado === 'ACTIVO' ? 'yellow' : 'gray'} dot>{e.estado === 'TRANSMITIDO' ? 'Transmitido' : e.estado === 'ACTIVO' ? 'Activo' : 'Por enviar'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Simular caída del servicio"
        subtitle="Se activará un evento de contingencia y los DTE se emitirán en modelo diferido"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button variant="danger" disabled={tipo === 5 && motivo.trim().length < 5} icon={<CloudOff className="size-4" />} onClick={async () => { if (await setMh(false, tipo, motivo.trim())) { setModal(false); toast.warn('Contingencia activada', 'Las ventas continúan; los DTE se encolan para transmisión') } }}>Activar contingencia</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tipo de contingencia (CAT-005)">
            <select className="input" value={tipo} onChange={(e) => setTipo(Number(e.target.value))}>
              {Object.entries(TIPOS_CONTINGENCIA).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
            </select>
          </Field>
          {tipo === 5 && (
            <Field label="Motivo de la contingencia" hint="Máximo 500 caracteres">
              <textarea className="input h-24 py-2" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Field>
          )}
        </div>
      </Modal>

      <Drawer open={!!evSel} onClose={() => setEvSel(null)} title="Evento de contingencia" subtitle={<span className="font-mono text-[12px]">{evSel?.id}</span>}>
        {evSel && (
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div><p className="label mb-0">Inicio</p>{fmtFecha(evSel.fInicio, true)}</div>
              <div><p className="label mb-0">Fin</p>{evSel.fFin ? fmtFecha(evSel.fFin, true) : 'En curso'}</div>
              <div><p className="label mb-0">Tipo</p>{TIPOS_CONTINGENCIA[evSel.tipoContingencia]}</div>
              <div><p className="label mb-0">Sello de recepción</p><span className="font-mono text-[11.5px] break-all">{evSel.selloRecibido ?? 'Pendiente'}</span></div>
            </div>
            {evSel.json ? <JsonView data={evSel.json} /> : <p className="rounded-xl bg-paper p-4 text-sm text-muted">El JSON del evento (contingencia-schema-v3) se genera al restablecerse el servicio, con la fecha y hora de fin.</p>}
          </div>
        )}
      </Drawer>
      <DteDetalle id={dteSel} onClose={() => setDteSel(null)} />
    </>
  )
}
