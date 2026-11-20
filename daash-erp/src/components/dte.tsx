import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Check, Download, Eye, FileJson, FileMinus2, Loader2, Mail, RefreshCw, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TIPOS_CONTINGENCIA, TIPOS_DTE, TIPOS_INVALIDACION } from '../lib/catalogos'
import { abrirPdfDte, descargarPdfDte } from '../lib/pdf'
import { type PasoEmision, useStore } from '../lib/store'
import { useShallow } from 'zustand/react/shallow'
import type { Dte, EstadoDte, ItemVenta } from '../lib/types'
import { cx, descargar, fmtFecha, fromB64url, money, validarCorreo } from '../lib/utils'
import { Badge, Button, Dots, Drawer, Field, JsonView, Modal, Tabs, toast } from './ui'

export const ESTADOS: Record<EstadoDte, { tone: 'green' | 'yellow' | 'red' | 'gray'; label: string }> = {
  PROCESADO: { tone: 'green', label: 'Procesado' },
  CONTINGENCIA: { tone: 'yellow', label: 'En contingencia' },
  RECHAZADO: { tone: 'red', label: 'Rechazado' },
  INVALIDADO: { tone: 'gray', label: 'Invalidado' },
}
export const EstadoBadge = ({ estado }: { estado: EstadoDte }) => (
  <Badge tone={ESTADOS[estado].tone} dot>
    {ESTADOS[estado].label}
  </Badge>
)

export const TipoBadge = ({ tipo }: { tipo: Dte['tipoDte'] }) => (
  <span className={cx('inline-flex h-6 min-w-10 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-semibold', tipo === '01' ? 'bg-ink text-white' : tipo === '03' ? 'bg-leaf text-ink' : 'bg-sun text-ink')}>
    {TIPOS_DTE[tipo].corto}
  </span>
)

// ---------------- Proceso de emisión animado ----------------
const PASOS: { id: PasoEmision; label: string; detalle: string }[] = [
  { id: 'validando', label: 'Validando', detalle: 'Precios oficiales, stock y esquema JSON' },
  { id: 'generando', label: 'Generando DTE', detalle: 'Código de generación y número de control' },
  { id: 'firmando', label: 'Firmando', detalle: 'JWS RS512 con certificado del emisor' },
  { id: 'transmitiendo', label: 'Transmitiendo al MH', detalle: 'Servicio de recepción de DTE' },
]

export function ProcesoEmision({ paso }: { paso: PasoEmision | null }) {
  const final = paso === 'procesado' || paso === 'contingencia' || paso === 'rechazado'
  const idx = final ? 4 : PASOS.findIndex((p) => p.id === paso)
  return (
    <div className="space-y-1">
      {PASOS.map((p, i) => {
        const hecho = i < idx || (final && !(paso === 'contingencia' && p.id === 'transmitiendo'))
        const saltado = paso === 'contingencia' && p.id === 'transmitiendo'
        const activo = i === idx && !final
        return (
          <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span
              className={cx(
                'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
                hecho ? 'bg-leaf text-ink' : saltado ? 'bg-sun text-ink' : activo ? 'bg-ink text-white' : 'bg-paper text-muted ring-1 ring-line',
              )}
            >
              {hecho ? <Check className="size-3.5" strokeWidth={3} /> : saltado ? <X className="size-3.5" /> : activo ? <Loader2 className="size-3.5 animate-spin" /> : <span className="text-[11px] font-semibold">{i + 1}</span>}
            </span>
            <div>
              <p className={cx('text-[13.5px] font-medium', !hecho && !activo && !saltado && 'text-muted')}>{saltado ? 'MH sin respuesta → contingencia' : p.label}</p>
              <p className="text-[12px] text-muted">{saltado ? 'Se emite en modelo diferido; se reintentará automáticamente' : p.detalle}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ---------------- Acciones de documento ----------------
export function useAccionesDte() {
  const config = useStore((s) => s.config)
  return {
    pdf: async (d: Dte) => {
      await descargarPdfDte(d, config)
      toast.ok('PDF generado', 'Representación gráfica descargada')
    },
    verPdf: async (d: Dte) => window.open(await abrirPdfDte(d, config), '_blank'),
    json: (d: Dte) => descargar(`${d.id}.json`, JSON.stringify(d.json, null, 2)),
  }
}

export function EnviarCorreo({ dte, open, onClose }: { dte: Dte; open: boolean; onClose: () => void }) {
  const cliente = useStore((s) => s.clientes.find((c) => c.id === dte.clienteId))
  const enviar = useStore((s) => s.enviarCorreoDte)
  const [para, setPara] = useState(cliente?.correo ?? '')
  useEffect(() => setPara(cliente?.correo ?? ''), [cliente, open])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar comprobante por correo"
      subtitle="Se adjuntan el PDF y el archivo JSON del DTE"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button icon={<Send className="size-4" />} disabled={!validarCorreo(para)} onClick={async () => { if (await enviar(dte.id, para)) { toast.ok('Correo enviado', para); onClose() } }}>Enviar</Button>
        </>
      }
    >
      <Field label="Correo del receptor" error={para && !validarCorreo(para) ? 'Correo inválido' : ''}>
        <input className="input" value={para} onChange={(e) => setPara(e.target.value)} placeholder="cliente@correo.com" autoFocus />
      </Field>
    </Modal>
  )
}

function InvalidarModal({ dte, open, onClose }: { dte: Dte; open: boolean; onClose: () => void }) {
  const invalidar = useStore((s) => s.invalidarDte)
  const [tipo, setTipo] = useState<1 | 2 | 3>(2)
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invalidar documento"
      subtitle={`${TIPOS_DTE[dte.tipoDte].nombre} · ${dte.numeroControl}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            loading={cargando}
            disabled={tipo === 3 && motivo.trim().length < 5}
            onClick={async () => {
              setCargando(true)
              const r = await invalidar(dte.id, tipo, motivo.trim() || TIPOS_INVALIDACION[tipo])
              setCargando(false)
              if (r.ok) {
                toast.ok('Documento invalidado', 'Evento de invalidación recibido por el MH · stock devuelto')
                onClose()
              } else toast.error('No se pudo invalidar', r.mensaje)
            }}
          >
            Transmitir invalidación
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-coral-50 px-3.5 py-3 text-[13px] text-coral-700 ring-1 ring-coral/20">
          Se generará y transmitirá un evento de invalidación (anulación) al Ministerio de Hacienda. Los productos regresarán al inventario. Esta acción no se puede deshacer.
        </p>
        <Field label="Tipo de invalidación (CAT-024)">
          <select className="input" value={tipo} onChange={(e) => setTipo(Number(e.target.value) as 1 | 2 | 3)}>
            {Object.entries(TIPOS_INVALIDACION).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
          </select>
        </Field>
        <Field label="Motivo" hint={tipo === 3 ? 'Obligatorio para el tipo "Otro"' : 'Opcional'}>
          <textarea className="input h-20 py-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={250} />
        </Field>
      </div>
    </Modal>
  )
}

function NotaCreditoModal({ dte, open, onClose }: { dte: Dte; open: boolean; onClose: () => void }) {
  const venta = useStore((s) => s.ventas.find((v) => v.id === dte.ventaId))
  const ncs = useStore(useShallow((s) => s.dtes.filter((d) => d.relacionadoId === dte.id && d.estado !== 'INVALIDADO')))
  const emitir = useStore((s) => s.emitirNotaCredito)
  const devuelto = (pid: string) => ncs.reduce((a, nc) => a + ((nc.json.cuerpoDocumento as { codigo: string; cantidad: number }[]).filter((c) => c.codigo === venta?.items.find((i) => i.productoId === pid)?.sku).reduce((x, c) => x + c.cantidad, 0)), 0)
  const [cant, setCant] = useState<Record<string, number>>({})
  const [paso, setPaso] = useState<PasoEmision | null>(null)
  const items: ItemVenta[] = (venta?.items ?? []).filter((i) => (cant[i.productoId] ?? 0) > 0).map((i) => ({ ...i, cantidad: cant[i.productoId] }))
  const total = items.reduce((a, i) => a + i.cantidad * i.precio * 1.13, 0)
  return (
    <Modal
      open={open}
      onClose={() => { setPaso(null); setCant({}); onClose() }}
      title="Emitir nota de crédito"
      subtitle={`Relacionada a CCF ${dte.numeroControl}`}
      size="lg"
      footer={
        !paso || paso === 'validando' ? (
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              icon={<FileMinus2 className="size-4" />}
              disabled={!items.length}
              loading={!!paso}
              onClick={async () => {
                const r = await emitir(dte.id, items, setPaso)
                if (!r.ok) {
                  setPaso(null)
                  toast.error('No se pudo emitir', r.errores?.join(' · '))
                } else toast.ok('Nota de crédito emitida', `${r.dte!.numeroControl} · stock devuelto al inventario`)
              }}
            >
              Emitir NC · {money(total)}
            </Button>
          </>
        ) : (
          <Button onClick={() => { setPaso(null); setCant({}); onClose() }}>Listo</Button>
        )
      }
    >
      {paso ? (
        <ProcesoEmision paso={paso} />
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="th pl-0">Producto</th>
              <th className="th text-right">Vendido</th>
              <th className="th text-right">Devuelto</th>
              <th className="th w-32 text-right">A devolver</th>
            </tr>
          </thead>
          <tbody>
            {venta?.items.map((i) => {
              const max = i.cantidad - devuelto(i.productoId)
              return (
                <tr key={i.productoId}>
                  <td className="td pl-0">
                    <p className="font-medium">{i.nombre}</p>
                    <p className="font-mono text-[11px] text-muted">{i.sku} · {money(i.precio)} + IVA</p>
                  </td>
                  <td className="td text-right tabular-nums">{i.cantidad}</td>
                  <td className="td text-right text-muted tabular-nums">{i.cantidad - max}</td>
                  <td className="td text-right">
                    <input type="number" min={0} max={max} disabled={max <= 0} className="input h-9 w-24 text-right" value={cant[i.productoId] ?? 0} onChange={(e) => setCant({ ...cant, [i.productoId]: Math.min(max, Math.max(0, Number(e.target.value))) })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Modal>
  )
}

export function DteDetalle({ id, onClose }: { id: string | null; onClose: () => void }) {
  const dte = useStore((s) => s.dtes.find((d) => d.id === id))
  const evento = useStore((s) => s.eventos.find((e) => e.id === dte?.eventoContingenciaId))
  const relacionado = useStore((s) => s.dtes.find((d) => d.id === dte?.relacionadoId))
  const ncs = useStore(useShallow((s) => s.dtes.filter((d) => d.relacionadoId === dte?.id)))
  const usuario = useStore((s) => s.usuarios.find((u) => u.id === dte?.usuarioId))
  const puedeAnular = useStore((s) => s.puede('dte', 'd'))
  const puedeNC = useStore((s) => s.puede('dte', 'u'))
  const retransmitir = useStore((s) => s.retransmitirDte)
  const acc = useAccionesDte()
  const [tab, setTab] = useState<'resumen' | 'json' | 'firma' | 'mh'>('resumen')
  const [modal, setModal] = useState<'correo' | 'invalidar' | 'nc' | null>(null)
  const [reintentando, setReintentando] = useState(false)
  useEffect(() => setTab('resumen'), [id])

  return (
    <Drawer
      open={!!dte}
      onClose={onClose}
      width="max-w-3xl"
      title={dte ? <span className="flex items-center gap-2.5"><TipoBadge tipo={dte.tipoDte} /> {TIPOS_DTE[dte.tipoDte].nombre}</span> : ''}
      subtitle={dte && <span className="font-mono text-[12px]">{dte.numeroControl}</span>}
    >
      {dte && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-3">
            <EstadoBadge estado={dte.estado} />
            <span className="flex-1" />
            <Button size="sm" variant="secondary" icon={<Eye className="size-3.5" />} onClick={() => acc.verPdf(dte)}>Ver PDF</Button>
            <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />} onClick={() => acc.pdf(dte)}>PDF</Button>
            <Button size="sm" variant="secondary" icon={<FileJson className="size-3.5" />} onClick={() => acc.json(dte)}>JSON</Button>
            <Button size="sm" variant="secondary" icon={<Mail className="size-3.5" />} onClick={() => setModal('correo')}>Correo</Button>
            {dte.estado === 'RECHAZADO' && (
              <Button size="sm" icon={<RefreshCw className={cx('size-3.5', reintentando && 'animate-spin')} />} disabled={reintentando} onClick={async () => { setReintentando(true); const r = await retransmitir(dte.id); setReintentando(false); if (r?.estado === 'PROCESADO') toast.ok('Documento procesado', 'Sello de recepción recibido'); else toast.error('Retransmisión fallida', 'El MH no está disponible') }}>
                Corregir y retransmitir
              </Button>
            )}
            {dte.estado === 'PROCESADO' && dte.tipoDte === '03' && puedeNC && <Button size="sm" variant="secondary" icon={<FileMinus2 className="size-3.5" />} onClick={() => setModal('nc')}>Nota de crédito</Button>}
            {dte.estado === 'PROCESADO' && puedeAnular && <Button size="sm" variant="danger" icon={<Ban className="size-3.5" />} onClick={() => setModal('invalidar')}>Invalidar</Button>}
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'resumen', label: 'Resumen' }, { id: 'json', label: 'JSON del DTE' }, { id: 'firma', label: 'Firma (JWS)' }, { id: 'mh', label: 'Respuesta MH' }]} />
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="p-6">
              {tab === 'resumen' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {[
                      ['Código de generación', <span className="font-mono text-[12px]">{dte.id}</span>],
                      ['Sello de recepción', dte.selloRecibido ? <span className="font-mono text-[12px] break-all">{dte.selloRecibido}</span> : <span className="text-sun-800">Pendiente</span>],
                      ['Fecha y hora de emisión', `${dte.fechaEmi} ${dte.horaEmi}`],
                      ['Procesado por MH', dte.fhProcesamiento ?? '—'],
                      ['Receptor', dte.receptorNombre],
                      ['Emitido por', usuario?.nombre ?? '—'],
                      ['Modelo / transmisión', `${(dte.json.identificacion as { tipoModelo: number }).tipoModelo === 1 ? 'Previo' : 'Diferido'} · ${(dte.json.identificacion as { tipoOperacion: number }).tipoOperacion === 1 ? 'Normal' : 'Contingencia'}`],
                      ['Intentos de transmisión', dte.intentos],
                    ].map(([k, v], i) => (
                      <div key={i}>
                        <p className="label mb-0.5">{k}</p>
                        <div className="text-[13.5px]">{v}</div>
                      </div>
                    ))}
                  </div>
                  {evento && (
                    <div className="rounded-xl bg-sun-50 px-4 py-3 text-[13px] ring-1 ring-sun/60">
                      <p className="font-semibold text-sun-800">Evento de contingencia {evento.id.slice(0, 8)}</p>
                      <p className="mt-0.5 text-sun-800/80">{TIPOS_CONTINGENCIA[evento.tipoContingencia]} · {evento.estado === 'TRANSMITIDO' ? 'Evento transmitido' : 'Pendiente de transmitir'}</p>
                    </div>
                  )}
                  {relacionado && <p className="text-[13px] text-muted">Documento relacionado: <b className="font-mono text-ink">{relacionado.numeroControl}</b></p>}
                  {ncs.length > 0 && <p className="text-[13px] text-muted">Notas de crédito emitidas: {ncs.map((n) => <b key={n.id} className="mr-2 font-mono text-ink">{n.numeroControl.slice(-6)}</b>)}</p>}
                  {dte.invalidacion && (
                    <div className="rounded-xl bg-paper px-4 py-3 text-[13px] ring-1 ring-line">
                      <p className="font-semibold">Invalidado el {fmtFecha(dte.invalidacion.fecha, true)}</p>
                      <p className="mt-0.5 text-muted">{TIPOS_INVALIDACION[dte.invalidacion.tipoAnulacion]} · {dte.invalidacion.motivo} · por {dte.invalidacion.responsable}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted">Sello invalidación: {dte.invalidacion.selloRecibido}</p>
                    </div>
                  )}
                  <div className="overflow-hidden rounded-xl border border-line">
                    <table className="w-full">
                      <thead className="bg-paper">
                        <tr><th className="th">Descripción</th><th className="th text-right">Cant.</th><th className="th text-right">P. unit.</th><th className="th text-right">Gravado</th></tr>
                      </thead>
                      <tbody>
                        {(dte.json.cuerpoDocumento as { numItem: number; descripcion: string; cantidad: number; precioUni: number; ventaGravada: number; codigo: string }[]).map((it) => (
                          <tr key={it.numItem}>
                            <td className="td"><p className="font-medium">{it.descripcion}</p><p className="font-mono text-[11px] text-muted">{it.codigo}</p></td>
                            <td className="td text-right tabular-nums">{it.cantidad}</td>
                            <td className="td text-right tabular-nums">{money(it.precioUni)}</td>
                            <td className="td text-right tabular-nums">{money(it.ventaGravada)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end gap-8 border-t border-line bg-paper px-4 py-3 text-[13px]">
                      <span className="text-muted">IVA <b className="ml-1 text-ink tabular-nums">{money(dte.iva)}</b></span>
                      <span className="text-muted">Total <b className="ml-1 text-[15px] text-ink tabular-nums">{money(dte.total)}</b></span>
                    </div>
                  </div>
                  <p className="text-[12px] text-muted">Total en letras: {(dte.json.resumen as { totalLetras: string }).totalLetras}</p>
                </div>
              )}
              {tab === 'json' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[12px] text-muted">
                    <span>Esquema <b className="font-mono text-ink">{TIPOS_DTE[dte.tipoDte].esquema}</b> · Guía de emisión DTE v1.4</span>
                    <button className="cursor-pointer font-medium text-ink hover:underline" onClick={() => acc.json(dte)}>Descargar .json</button>
                  </div>
                  <JsonView data={dte.json} />
                  {dte.invalidacion && (
                    <>
                      <p className="pt-3 text-[13px] font-semibold">Evento de invalidación (anulacion-schema-v2)</p>
                      <JsonView data={dte.invalidacion.json} maxH="max-h-80" />
                    </>
                  )}
                </div>
              )}
              {tab === 'firma' && <FirmaView firma={dte.firma} />}
              {tab === 'mh' && (dte.respuesta ? <JsonView data={dte.respuesta} /> : <p className="py-10 text-center text-sm text-muted">Sin respuesta del Ministerio de Hacienda todavía.</p>)}
            </motion.div>
          </AnimatePresence>
          <EnviarCorreo dte={dte} open={modal === 'correo'} onClose={() => setModal(null)} />
          <InvalidarModal dte={dte} open={modal === 'invalidar'} onClose={() => setModal(null)} />
          <NotaCreditoModal dte={dte} open={modal === 'nc'} onClose={() => setModal(null)} />
        </>
      )}
    </Drawer>
  )
}

function FirmaView({ firma }: { firma: string }) {
  const [h, p, s] = firma.split('.')
  let header = ''
  try { header = JSON.stringify(JSON.parse(fromB64url(h)), null, 2) } catch { header = h }
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">
        El documento se firma como JWS compacto (<span className="font-mono">header.payload.signature</span>). En producción el firmador del MH usa el certificado (.crt) del contribuyente; aquí la firma se simula con SHA-512.
      </p>
      <div className="flex items-center gap-2"><Dots size={7} /><span className="text-[12px] font-semibold">Header</span></div>
      <JsonView raw={header} maxH="max-h-32" />
      <p className="text-[12px] font-semibold">Token firmado</p>
      <div className="max-h-64 overflow-auto rounded-xl border border-line bg-[#fbfbf9] p-4 font-mono text-[11px] leading-relaxed break-all">
        <span className="text-coral-700">{h}</span>.<span className="text-ink/70">{p.length > 900 ? p.slice(0, 900) + '…' : p}</span>.<span className="text-leaf-700">{s}</span>
      </div>
    </div>
  )
}
