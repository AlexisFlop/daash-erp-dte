import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote, CreditCard, Download, Eye, FileJson, Landmark, Lock, Mail, Minus, PackageX, Percent, Plus, ScanBarcode, ShieldCheck, ShoppingCart, Trash2, UserPlus, UserRound, Wallet,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EnviarCorreo, ProcesoEmision, useAccionesDte } from '../components/dte'
import { Badge, Button, Dots, Empty, Field, IconButton, Modal, Segmented, toast } from '../components/ui'
import { CATEGORIAS } from '../lib/catalogos'
import { calcularTotales } from '../lib/dte'
import { type PasoEmision, useStore } from '../lib/store'
import type { Dte, ItemVenta, MetodoPago } from '../lib/types'

/** Gerente que autorizó el descuento: las credenciales viajan con la venta y el servidor las vuelve a verificar */
interface Autorizador { id: string; nombre: string; correo: string; password: string }
import { cx, money, round2 } from '../lib/utils'
import { ClienteForm } from './Clientes'

const METODOS: { id: MetodoPago; label: string; icon: React.ReactNode }[] = [
  { id: 'EFECTIVO', label: 'Efectivo', icon: <Banknote className="size-4" /> },
  { id: 'TARJETA', label: 'Tarjeta', icon: <CreditCard className="size-4" /> },
  { id: 'TRANSFERENCIA', label: 'Transferencia', icon: <Landmark className="size-4" /> },
]

function AutorizarDescuento({ open, onClose, pct, onOk }: { open: boolean; onClose: () => void; pct: number; onOk: (u: Autorizador) => void }) {
  const verificar = useStore((s) => s.verificarCredencialAutorizador)
  const [correo, setCorreo] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [cargando, setCargando] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Autorización de gerente"
      subtitle={`El descuento de ${pct}% supera el límite base permitido al cajero`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            loading={cargando}
            icon={<ShieldCheck className="size-4" />}
            onClick={async () => {
              setCargando(true)
              const u = await verificar(correo, pw)
              setCargando(false)
              if (u) {
                onOk({ ...u, correo, password: pw })
                setCorreo('')
                setPw('')
                setErr('')
              } else setErr('Credenciales inválidas o el usuario no tiene nivel de gerente')
            }}
          >
            Autorizar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Correo del gerente"><input className="input" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="gerente@adventureworks.com.sv" autoFocus /></Field>
        <Field label="Contraseña" error={err}><input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function AbrirCajaInline() {
  const abrir = useStore((s) => s.abrirTurno)
  const puede = useStore((s) => s.puede('caja', 'c'))
  const [fondo, setFondo] = useState('100.00')
  return (
    <div className="flex h-[calc(100vh-180px)] items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-ink text-leaf"><Lock className="size-6" /></div>
        <h2 className="text-xl font-semibold">Caja cerrada</h2>
        <p className="mt-1.5 text-sm text-muted">Para facturar necesitas abrir tu turno registrando el fondo inicial de caja.</p>
        {puede ? (
          <div className="mt-6 flex gap-2">
            <div className="relative flex-1">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span>
              <input type="number" step="0.01" className="input h-11 pl-7 text-right tabular-nums" value={fondo} onChange={(e) => setFondo(e.target.value)} />
            </div>
            <Button size="lg" icon={<Wallet className="size-4" />} onClick={async () => { if (await abrir(Number(fondo) || 0, 'Caja 01')) toast.ok('Turno abierto', `Fondo inicial ${money(Number(fondo))}`) }}>Abrir turno</Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-coral-700">Tu rol no puede abrir caja.</p>
        )}
      </motion.div>
    </div>
  )
}

export default function POS() {
  const productos = useStore((s) => s.productos)
  const clientes = useStore((s) => s.clientes)
  const config = useStore((s) => s.config)
  const rol = useStore((s) => s.rolActual())
  const turno = useStore((s) => s.turnoAbierto())
  const emitir = useStore((s) => s.emitirVenta)
  const acc = useAccionesDte()

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todas')
  const [carrito, setCarrito] = useState<ItemVenta[]>([])
  const [clienteId, setClienteId] = useState<string>('')
  const [tipo, setTipo] = useState<'01' | '03'>('01')
  const [descuento, setDescuento] = useState(0)
  const [autorizador, setAutorizador] = useState<Autorizador | null>(null)
  const [modal, setModal] = useState<'auth' | 'cobro' | 'cliente' | 'correo' | null>(null)
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO')
  const [recibido, setRecibido] = useState('')
  const [paso, setPaso] = useState<PasoEmision | null>(null)
  const [resultado, setResultado] = useState<Dte | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  const filtrados = useMemo(() => {
    const t = q.toLowerCase()
    return productos.filter((p) => p.activo && (cat === 'Todas' || p.categoria === cat) && (!t || p.nombre.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.codigoBarras.includes(t)))
  }, [productos, q, cat])

  const cliente = clientes.find((c) => c.id === clienteId)
  const totales = calcularTotales(carrito, descuento, tipo)
  const requiereAuth = descuento > config.descuentoBase && !rol?.autorizaDescuentos && !autorizador
  const cambio = metodo === 'EFECTIVO' && recibido ? round2(Number(recibido) - totales.total) : 0

  const agregar = (id: string, cant = 1) => {
    const p = productos.find((x) => x.id === id)!
    if (p.stock <= 0) return toast.error('Sin existencias', `${p.nombre} no tiene stock disponible`)
    setCarrito((c) => {
      const ex = c.find((i) => i.productoId === id)
      if (ex) {
        if (ex.cantidad + cant > p.stock) {
          toast.warn('Stock máximo alcanzado', `Solo hay ${p.stock} unidades de ${p.nombre}`)
          return c
        }
        return c.map((i) => (i.productoId === id ? { ...i, cantidad: i.cantidad + cant } : i))
      }
      return [...c, { productoId: id, sku: p.sku, nombre: p.nombre, cantidad: cant, precio: p.precio }]
    })
  }
  const setCant = (id: string, n: number) => {
    const p = productos.find((x) => x.id === id)!
    if (n <= 0) return setCarrito((c) => c.filter((i) => i.productoId !== id))
    if (n > p.stock) return toast.warn('Stock máximo alcanzado', `Disponible: ${p.stock}`)
    setCarrito((c) => c.map((i) => (i.productoId === id ? { ...i, cantidad: n } : i)))
  }

  const escanear = (codigo: string) => {
    const p = productos.find((x) => x.activo && (x.codigoBarras === codigo || x.sku.toLowerCase() === codigo.toLowerCase()))
    if (p) {
      agregar(p.id)
      setQ('')
    } else if (filtrados.length === 1) {
      agregar(filtrados[0].id)
      setQ('')
    }
  }

  const reiniciar = () => {
    setCarrito([])
    setClienteId('')
    setTipo('01')
    setDescuento(0)
    setAutorizador(null)
    setRecibido('')
    setPaso(null)
    setResultado(null)
    setModal(null)
    setTimeout(() => scanRef.current?.focus(), 50)
  }

  const cobrar = async () => {
    const r = await emitir({ items: carrito, descuentoPct: descuento, autorizacion: autorizador ? { correo: autorizador.correo, password: autorizador.password } : undefined, clienteId: clienteId || undefined, tipoDte: tipo, metodoPago: metodo, recibido: metodo === 'EFECTIVO' ? Number(recibido) || undefined : undefined }, setPaso)
    if (!r.ok) {
      setPaso(null)
      toast.error('No se pudo emitir el documento', r.errores?.join(' · '))
      return
    }
    setResultado(r.dte!)
  }

  if (!turno) return <AbrirCajaInline />

  const contribuyentes = clientes.filter((c) => c.activo && c.tipo === 'CONTRIBUYENTE')
  const listaClientes = tipo === '03' ? contribuyentes : clientes.filter((c) => c.activo)

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      {/* Catálogo */}
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight">Punto de venta</h1>
            <p className="text-sm text-muted">{turno.caja} · turno abierto {new Date(turno.apertura).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          {!config.mhEnLinea && <Badge tone="yellow" dot>Emitiendo en contingencia</Badge>}
        </div>
        <div className="mb-4 flex flex-wrap gap-3">
          <form className="min-w-64 flex-1" onSubmit={(e) => { e.preventDefault(); escanear(q.trim()) }}>
            <div className="relative">
              <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input ref={scanRef} autoFocus className="input h-11 pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escanear código de barras o buscar por nombre / SKU…" />
              <span className="kbd absolute top-1/2 right-3 -translate-y-1/2">Enter</span>
            </div>
          </form>
        </div>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {['Todas', ...CATEGORIAS].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cx('cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-medium transition', cat === c ? 'bg-ink text-white' : 'bg-white text-muted ring-1 ring-line hover:text-ink')}>
              {c}
            </button>
          ))}
        </div>
        <motion.div layout className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence>
            {filtrados.map((p) => {
              const enCarrito = carrito.find((i) => i.productoId === p.id)?.cantidad ?? 0
              const agotado = p.stock <= 0
              return (
                <motion.button
                  layout
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={agotado ? undefined : { y: -2 }}
                  whileTap={agotado ? undefined : { scale: 0.98 }}
                  disabled={agotado}
                  onClick={() => agregar(p.id)}
                  className={cx('card group relative cursor-pointer p-4 text-left transition-shadow hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-50', enCarrito > 0 && 'ring-2 ring-ink')}
                >
                  {enCarrito > 0 && <span className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-leaf">{enCarrito}</span>}
                  <span className="text-[10.5px] font-semibold tracking-wider text-muted uppercase">{p.categoria}</span>
                  <p className="mt-1 line-clamp-2 min-h-[2.6em] text-[13.5px] leading-snug font-semibold">{p.nombre}</p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-muted">{p.sku}</p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[16px] font-semibold tabular-nums">{money(round2(p.precio * 1.13))}</p>
                      <p className="text-[10.5px] text-muted">IVA incluido</p>
                    </div>
                    {agotado ? <Badge tone="red">Agotado</Badge> : <Badge tone={p.stock <= p.stockMinimo ? 'red' : 'gray'}>{p.stock} u.</Badge>}
                  </div>
                </motion.button>
              )
            })}
          </AnimatePresence>
        </motion.div>
        {filtrados.length === 0 && <Empty icon={<PackageX className="size-5" />} title="Sin resultados" text="No hay productos que coincidan con la búsqueda." />}
      </div>

      {/* Carrito */}
      <div className="xl:sticky xl:top-0 xl:self-start">
        <div className="card flex max-h-[calc(100vh-130px)] flex-col overflow-hidden">
          <div className="border-b border-line p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 font-semibold"><ShoppingCart className="size-4" /> Venta actual</p>
              {carrito.length > 0 && <button onClick={() => setCarrito([])} className="cursor-pointer text-[12px] text-muted hover:text-coral-700">Vaciar</button>}
            </div>
            <Segmented
              value={tipo}
              onChange={(t) => {
                setTipo(t)
                if (t === '03' && cliente?.tipo !== 'CONTRIBUYENTE') setClienteId('')
              }}
              options={[{ value: '01', label: 'Factura' }, { value: '03', label: 'Crédito fiscal' }]}
            />
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                <select className={cx('input appearance-none pl-9', tipo === '03' && !clienteId && 'input-error')} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">{tipo === '03' ? 'Seleccione contribuyente…' : 'Consumidor final'}</option>
                  {listaClientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <IconButton className="size-10 rounded-xl border border-line" title="Registrar cliente" onClick={() => setModal('cliente')}><UserPlus className="size-4" /></IconButton>
            </div>
            {cliente && (
              <p className="mt-2 font-mono text-[11px] text-muted">
                {cliente.tipoDocumento === '13' ? 'DUI' : 'NIT'} {cliente.numDocumento}{cliente.nrc && ` · NRC ${cliente.nrc}`}
              </p>
            )}
          </div>

          <div className="min-h-32 flex-1 overflow-y-auto">
            {carrito.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Dots size={7} />
                <p className="mt-3 text-sm text-muted">Escanea o selecciona productos</p>
              </div>
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {totales.lineas.map((l) => (
                    <motion.li key={l.productoId} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border-b border-line">
                      <div className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{l.nombre}</p>
                          <p className="text-[11.5px] text-muted tabular-nums">{money(l.precioUni)} c/u{tipo === '03' && ' + IVA'}</p>
                        </div>
                        <div className="flex items-center rounded-lg ring-1 ring-line">
                          <button className="cursor-pointer p-1.5 text-muted hover:text-ink" onClick={() => setCant(l.productoId, l.cantidad - 1)}><Minus className="size-3.5" /></button>
                          <span className="w-7 text-center text-[13px] font-semibold tabular-nums">{l.cantidad}</span>
                          <button className="cursor-pointer p-1.5 text-muted hover:text-ink" onClick={() => setCant(l.productoId, l.cantidad + 1)}><Plus className="size-3.5" /></button>
                        </div>
                        <p className="w-20 text-right text-[13px] font-semibold tabular-nums">{money(l.ventaGravada)}</p>
                        <button className="cursor-pointer text-muted hover:text-coral" onClick={() => setCant(l.productoId, 0)}><Trash2 className="size-3.5" /></button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>

          <div className="border-t border-line bg-paper/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Percent className="size-4 text-muted" />
              <span className="flex-1 text-[13px] text-muted">Descuento</span>
              {autorizador && <Badge tone="green">Autorizado · {autorizador.nombre.split(' ')[0]}</Badge>}
              {requiereAuth && <Badge tone="yellow">Requiere gerente</Badge>}
              <input
                type="number"
                min={0}
                max={50}
                className="input h-8 w-20 text-right tabular-nums"
                value={descuento}
                onChange={(e) => {
                  setDescuento(Math.min(50, Math.max(0, Number(e.target.value))))
                  setAutorizador(null)
                }}
              />
            </div>
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between text-muted"><dt>Subtotal (sin IVA)</dt><dd className="tabular-nums">{money(totales.subtotal)}</dd></div>
              {totales.descuento > 0 && <div className="flex justify-between text-coral-700"><dt>Descuento {descuento}%</dt><dd className="tabular-nums">−{money(totales.descuento)}</dd></div>}
              <div className="flex justify-between text-muted"><dt>IVA 13%</dt><dd className="tabular-nums">{money(totales.iva)}</dd></div>
              <div className="flex items-baseline justify-between pt-2">
                <dt className="font-semibold">Total a pagar</dt>
                <motion.dd key={totales.total} initial={{ scale: 1.06 }} animate={{ scale: 1 }} className="text-[26px] font-semibold tracking-tight tabular-nums">{money(totales.total)}</motion.dd>
              </div>
            </dl>
            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={!carrito.length || (tipo === '03' && !clienteId)}
              onClick={() => (requiereAuth ? setModal('auth') : setModal('cobro'))}
            >
              {requiereAuth ? 'Solicitar autorización' : 'Cobrar'}
            </Button>
          </div>
        </div>
      </div>

      <AutorizarDescuento
        open={modal === 'auth'}
        onClose={() => setModal(null)}
        pct={descuento}
        onOk={(u) => {
          setAutorizador(u)
          toast.ok('Descuento autorizado', `${descuento}% autorizado por ${u.nombre}`)
          setModal('cobro')
        }}
      />

      <Modal open={modal === 'cliente'} onClose={() => setModal(null)} title="Registrar cliente" size="lg">
        <ClienteForm
          inicial={tipo === '03' ? { tipo: 'CONTRIBUYENTE' } : undefined}
          onCancel={() => setModal(null)}
          onSaved={(id) => {
            setClienteId(id)
            setModal(null)
          }}
        />
      </Modal>

      {/* Cobro + emisión */}
      <Modal open={modal === 'cobro'} onClose={() => (paso && !resultado ? null : resultado ? reiniciar() : setModal(null))} title={resultado ? 'Venta completada' : paso ? 'Emitiendo documento' : 'Cobro'} subtitle={!paso ? `${tipo === '01' ? 'Factura' : 'Comprobante de Crédito Fiscal'} · ${cliente?.nombre ?? 'Consumidor final'}` : undefined} size="md">
        {!paso ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-ink p-5 text-white">
              <p className="text-[12px] text-white/60">Total a cobrar</p>
              <p className="text-[34px] font-semibold tracking-tight tabular-nums">{money(totales.total)}</p>
              <p className="text-[12px] text-white/50">IVA {money(totales.iva)} · {carrito.reduce((a, i) => a + i.cantidad, 0)} artículos</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map((m) => (
                <button key={m.id} onClick={() => setMetodo(m.id)} className={cx('flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-[13px] font-medium transition', metodo === m.id ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink/30')}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            {metodo === 'EFECTIVO' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Efectivo recibido">
                  <input type="number" step="0.01" autoFocus className="input h-11 text-right text-lg tabular-nums" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder={totales.total.toFixed(2)} />
                </Field>
                <div>
                  <span className="label">Cambio</span>
                  <p className={cx('flex h-11 items-center justify-end rounded-xl px-3 text-lg font-semibold tabular-nums', cambio < 0 ? 'bg-coral-50 text-coral-700' : 'bg-leaf-50 text-leaf-700')}>{money(Math.max(cambio, 0))}</p>
                </div>
                <div className="col-span-2 flex gap-1.5">
                  {[Math.ceil(totales.total), Math.ceil(totales.total / 5) * 5, Math.ceil(totales.total / 20) * 20, Math.ceil(totales.total / 100) * 100].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                    <button key={v} onClick={() => setRecibido(String(v))} className="cursor-pointer rounded-lg bg-paper px-3 py-1.5 text-[12px] font-medium tabular-nums ring-1 ring-line hover:ring-ink/30">{money(v)}</button>
                  ))}
                </div>
              </div>
            )}
            <Button size="lg" className="w-full" disabled={metodo === 'EFECTIVO' && !!recibido && cambio < 0} onClick={cobrar}>
              Confirmar y emitir DTE
            </Button>
          </div>
        ) : !resultado ? (
          <ProcesoEmision paso={paso} />
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className={cx('rounded-2xl p-5', resultado.estado === 'PROCESADO' ? 'bg-leaf-50 ring-1 ring-leaf/50' : resultado.estado === 'CONTINGENCIA' ? 'bg-sun-50 ring-1 ring-sun' : 'bg-coral-50 ring-1 ring-coral/30')}>
              <div className="flex items-center gap-3">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }} className={cx('flex size-10 items-center justify-center rounded-full', resultado.estado === 'PROCESADO' ? 'bg-leaf' : resultado.estado === 'CONTINGENCIA' ? 'bg-sun' : 'bg-coral text-white')}>
                  <ShieldCheck className="size-5" />
                </motion.span>
                <div>
                  <p className="font-semibold">{resultado.estado === 'PROCESADO' ? 'DTE recibido por Hacienda' : resultado.estado === 'CONTINGENCIA' ? 'Emitido en contingencia' : 'Documento rechazado por el MH'}</p>
                  <p className="text-[12.5px] text-muted">{resultado.estado === 'PROCESADO' ? 'Sello de recepción asignado' : resultado.estado === 'CONTINGENCIA' ? 'Se transmitirá automáticamente al restablecerse el servicio' : resultado.respuesta?.descripcionMsg}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-[12px]">
                <div><dt className="text-muted">Número de control</dt><dd className="font-mono">{resultado.numeroControl}</dd></div>
                <div><dt className="text-muted">Código de generación</dt><dd className="font-mono">{resultado.id}</dd></div>
                {resultado.selloRecibido && <div><dt className="text-muted">Sello de recepción</dt><dd className="font-mono break-all">{resultado.selloRecibido}</dd></div>}
              </dl>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">Total cobrado</span>
              <span className="text-xl font-semibold tabular-nums">{money(resultado.total)}</span>
            </div>
            {metodo === 'EFECTIVO' && cambio > 0 && <div className="flex items-baseline justify-between"><span className="text-sm text-muted">Cambio</span><span className="text-xl font-semibold text-leaf-700 tabular-nums">{money(cambio)}</span></div>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={<Eye className="size-4" />} onClick={() => acc.verPdf(resultado)}>Ver PDF</Button>
              <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => acc.pdf(resultado)}>Descargar PDF</Button>
              <Button variant="secondary" icon={<FileJson className="size-4" />} onClick={() => acc.json(resultado)}>Archivo JSON</Button>
              <Button variant="secondary" icon={<Mail className="size-4" />} onClick={() => setModal('correo')}>Enviar por correo</Button>
            </div>
            <div className="flex gap-2">
              <Link to="/dte" className="flex-1"><Button variant="ghost" className="w-full">Ver en documentos</Button></Link>
              <Button className="flex-1" variant="accent" onClick={reiniciar}>Nueva venta</Button>
            </div>
          </motion.div>
        )}
      </Modal>
      {resultado && <EnviarCorreo dte={resultado} open={modal === 'correo'} onClose={() => setModal('cobro')} />}
    </div>
  )
}
