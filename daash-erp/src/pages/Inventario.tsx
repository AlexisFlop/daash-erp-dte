import { AlertTriangle, ArrowDownRight, ArrowUpRight, History, Package, Pencil, Plus, Power, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Drawer, Empty, Field, IconButton, Modal, PageHeader, SearchInput, Segmented, Stat, toast } from '../components/ui'
import { CATEGORIAS } from '../lib/catalogos'
import { useStore } from '../lib/store'
import type { Producto, TipoKardex } from '../lib/types'
import { cx, fmtFecha, money, num, round2 } from '../lib/utils'

const vacio: Producto = { id: '', sku: '', codigoBarras: '', nombre: '', descripcion: '', categoria: 'Accesorios', precio: 0, costo: 0, stock: 0, stockMinimo: 5, activo: true }

const TIPOS_K: Record<TipoKardex, { label: string; tone: 'green' | 'red' | 'yellow' | 'gray' }> = {
  INICIAL: { label: 'Inicial', tone: 'gray' },
  ENTRADA: { label: 'Entrada', tone: 'green' },
  SALIDA: { label: 'Salida', tone: 'red' },
  AJUSTE_POS: { label: 'Ajuste +', tone: 'yellow' },
  AJUSTE_NEG: { label: 'Ajuste −', tone: 'yellow' },
  DEVOLUCION: { label: 'Devolución', tone: 'green' },
}

function ProductoForm({ inicial, onClose }: { inicial: Producto; onClose: () => void }) {
  const guardar = useStore((s) => s.guardarProducto)
  const productos = useStore((s) => s.productos)
  const [p, setP] = useState(inicial)
  const [intento, setIntento] = useState(false)
  const set = (x: Partial<Producto>) => setP({ ...p, ...x })
  const err = {
    sku: (!p.sku.trim() && 'SKU obligatorio') || (productos.some((x) => x.sku === p.sku.trim() && x.id !== p.id) && 'El SKU ya existe'),
    nombre: !p.nombre.trim() && 'Nombre obligatorio',
    precio: p.precio <= 0 && 'Precio debe ser mayor a 0',
    costo: p.costo <= 0 && 'Costo obligatorio',
    margen: p.costo > p.precio && 'El costo supera el precio de venta',
  }
  const e = (k: keyof typeof err) => intento && err[k]
  const margen = p.precio ? round2(((p.precio - p.costo) / p.precio) * 100) : 0
  return (
    <form
      className="space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault()
        setIntento(true)
        if (Object.values(err).some(Boolean)) return
        if (!(await guardar({ ...p, sku: p.sku.trim().toUpperCase(), nombre: p.nombre.trim() }))) return
        toast.ok(p.id ? 'Producto actualizado' : 'Producto creado', p.nombre)
        onClose()
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU *" error={e('sku')}><input className={cx('input font-mono uppercase', e('sku') && 'input-error')} value={p.sku} onChange={(x) => set({ sku: x.target.value })} autoFocus /></Field>
        <Field label="Código de barras" hint="Se genera si se deja vacío"><input className="input font-mono" value={p.codigoBarras} onChange={(x) => set({ codigoBarras: x.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Nombre *" error={e('nombre')} className="col-span-2"><input className={cx('input', e('nombre') && 'input-error')} value={p.nombre} onChange={(x) => set({ nombre: x.target.value })} /></Field>
        <Field label="Descripción" className="col-span-2"><textarea className="input h-16 py-2" value={p.descripcion} onChange={(x) => set({ descripcion: x.target.value })} /></Field>
        <Field label="Categoría *"><select className="input" value={p.categoria} onChange={(x) => set({ categoria: x.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Stock mínimo *"><input type="number" min={0} className="input text-right tabular-nums" value={p.stockMinimo} onChange={(x) => set({ stockMinimo: Math.max(0, Number(x.target.value)) })} /></Field>
        <Field label="Precio de venta (sin IVA) *" error={e('precio')} hint={p.precio > 0 ? `Con IVA: ${money(round2(p.precio * 1.13))}` : undefined}><input type="number" step="0.01" className={cx('input text-right tabular-nums', e('precio') && 'input-error')} value={p.precio || ''} onChange={(x) => set({ precio: Number(x.target.value) })} /></Field>
        <Field label="Costo unitario *" error={e('costo') || e('margen')} hint={p.precio > 0 && p.costo > 0 ? `Margen ${margen}%` : undefined}><input type="number" step="0.01" className={cx('input text-right tabular-nums', (e('costo') || e('margen')) && 'input-error')} value={p.costo || ''} onChange={(x) => set({ costo: Number(x.target.value) })} /></Field>
        {!p.id && <Field label="Existencia inicial"><input type="number" min={0} className="input text-right tabular-nums" value={p.stock} onChange={(x) => set({ stock: Math.max(0, Number(x.target.value)) })} /></Field>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Guardar producto</Button>
      </div>
    </form>
  )
}

function AjusteModal({ producto, onClose }: { producto: Producto | null; onClose: () => void }) {
  const ajustar = useStore((s) => s.ajustarInventario)
  const [tipo, setTipo] = useState<'AJUSTE_POS' | 'AJUSTE_NEG'>('AJUSTE_NEG')
  const [cant, setCant] = useState(1)
  const [just, setJust] = useState('')
  const [motivo, setMotivo] = useState('Producto dañado')
  if (!producto) return null
  const nuevo = tipo === 'AJUSTE_POS' ? producto.stock + cant : producto.stock - cant
  const justificacion = `${motivo}${just.trim() ? ': ' + just.trim() : ''}`
  const valido = cant > 0 && nuevo >= 0 && just.trim().length >= 10
  return (
    <Modal
      open
      onClose={onClose}
      title="Ajuste manual de inventario"
      subtitle={`${producto.sku} · ${producto.nombre}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valido} onClick={async () => { if (await ajustar(producto.id, cant, tipo, justificacion)) { toast.ok('Ajuste registrado en Kardex', `Nuevo saldo: ${nuevo}`); onClose() } }}>Registrar ajuste</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented value={tipo} onChange={setTipo} options={[{ value: 'AJUSTE_NEG', label: 'Disminuir (−)' }, { value: 'AJUSTE_POS', label: 'Aumentar (+)' }]} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cantidad"><input type="number" min={1} className="input text-right tabular-nums" value={cant} onChange={(e) => setCant(Math.max(0, Number(e.target.value)))} /></Field>
          <Field label="Motivo">
            <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {['Producto dañado', 'Pérdida / robo', 'Diferencia en conteo físico', 'Muestra o garantía', 'Corrección de registro'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Justificación (obligatoria)" error={just && just.trim().length < 10 ? 'Mínimo 10 caracteres' : ''} hint="Queda registrada en el Kardex junto con tu usuario">
          <textarea className="input h-20 py-2" value={just} onChange={(e) => setJust(e.target.value)} placeholder="Describe el motivo del ajuste…" />
        </Field>
        <div className="flex items-center justify-between rounded-xl bg-paper px-4 py-3 text-sm">
          <span className="text-muted">Saldo actual <b className="text-ink tabular-nums">{producto.stock}</b></span>
          <span className="text-muted">Nuevo saldo <b className={cx('tabular-nums', nuevo < 0 ? 'text-coral-700' : 'text-ink')}>{nuevo}</b></span>
        </div>
      </div>
    </Modal>
  )
}

function KardexDrawer({ producto, onClose }: { producto: Producto | null; onClose: () => void }) {
  const kardex = useStore((s) => s.kardex)
  const usuarios = useStore((s) => s.usuarios)
  const movs = useMemo(() => kardex.filter((k) => k.productoId === producto?.id).slice().reverse(), [kardex, producto])
  return (
    <Drawer open={!!producto} onClose={onClose} title={`Kardex · ${producto?.nombre ?? ''}`} subtitle={<span className="font-mono text-[12px]">{producto?.sku}</span>} width="max-w-4xl">
      {producto && (
        <>
          <div className="grid grid-cols-3 gap-3 border-b border-line p-6">
            <Stat label="Existencia actual" value={num(producto.stock)} tone={producto.stock <= producto.stockMinimo ? 'red' : 'green'} />
            <Stat label="Costo promedio" value={money(producto.costo)} />
            <Stat label="Valor del inventario" value={money(producto.costo * producto.stock)} />
          </div>
          <table className="w-full">
            <thead className="sticky top-0 bg-paper">
              <tr><th className="th">Fecha</th><th className="th">Tipo</th><th className="th">Referencia</th><th className="th text-right">Cantidad</th><th className="th text-right">Saldo</th><th className="th">Usuario</th></tr>
            </thead>
            <tbody>
              {movs.map((k) => {
                const entra = ['INICIAL', 'ENTRADA', 'AJUSTE_POS', 'DEVOLUCION'].includes(k.tipo)
                return (
                  <tr key={k.id}>
                    <td className="td text-[12.5px] text-muted">{fmtFecha(k.fecha, true)}</td>
                    <td className="td"><Badge tone={TIPOS_K[k.tipo].tone}>{TIPOS_K[k.tipo].label}</Badge></td>
                    <td className="td text-[12.5px]"><p>{k.referencia}</p>{k.justificacion && <p className="text-[11.5px] text-muted italic">“{k.justificacion}”</p>}</td>
                    <td className={cx('td text-right font-medium tabular-nums', entra ? 'text-leaf-700' : 'text-coral-700')}>
                      <span className="inline-flex items-center gap-0.5">{entra ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{k.cantidad}</span>
                    </td>
                    <td className="td text-right font-semibold tabular-nums">{k.saldo}</td>
                    <td className="td text-[12.5px] text-muted">{usuarios.find((u) => u.id === k.usuarioId)?.nombre.split(' ').slice(0, 2).join(' ') ?? k.usuarioId}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </Drawer>
  )
}

export default function Inventario() {
  const productos = useStore((s) => s.productos)
  const toggle = useStore((s) => s.toggleProducto)
  const puedeC = useStore((s) => s.puede('inventario', 'c'))
  const puedeU = useStore((s) => s.puede('inventario', 'u'))
  const puedeD = useStore((s) => s.puede('inventario', 'd'))
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [soloBajo, setSoloBajo] = useState(false)
  const [editar, setEditar] = useState<Producto | null>(null)
  const [ajuste, setAjuste] = useState<Producto | null>(null)
  const [kardex, setKardex] = useState<Producto | null>(null)

  const lista = useMemo(() => {
    const t = q.toLowerCase()
    return productos.filter((p) => (!cat || p.categoria === cat) && (!soloBajo || p.stock <= p.stockMinimo) && (!t || p.nombre.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.codigoBarras.includes(t)))
  }, [productos, q, cat, soloBajo])

  const valor = round2(productos.reduce((a, p) => a + p.costo * p.stock, 0))
  const bajo = productos.filter((p) => p.activo && p.stock <= p.stockMinimo).length

  return (
    <>
      <PageHeader
        eyebrow="Bodega"
        title="Inventario y Kardex"
        description="Catálogo de bicicletas, componentes y accesorios con control automático de existencias, ajustes justificados y alertas de reorden."
        actions={puedeC && <Button icon={<Plus className="size-4" />} onClick={() => setEditar({ ...vacio })}>Nuevo producto</Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Productos activos" value={productos.filter((p) => p.activo).length} icon={<Package className="size-4" />} />
        <Stat label="Unidades en existencia" value={num(productos.reduce((a, p) => a + p.stock, 0))} />
        <Stat tone="green" label="Valor del inventario (costo)" value={money(valor)} />
        <button onClick={() => setSoloBajo(!soloBajo)} className={cx('cursor-pointer text-left', soloBajo && 'rounded-2xl ring-2 ring-coral')}>
          <Stat tone="red" label="Bajo stock mínimo" value={bajo} hint="Clic para filtrar" icon={<AlertTriangle className="size-4 text-coral" />} />
        </button>
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <SearchInput className="min-w-64 flex-1" value={q} onChange={setQ} placeholder="Buscar por nombre, SKU o código de barras…" icon={<Search className="size-4" />} />
          <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        {lista.length === 0 ? (
          <Empty icon={<Package className="size-5" />} title="Sin productos" />
        ) : (
          <table className="w-full">
            <thead className="bg-paper/60">
              <tr><th className="th">Producto</th><th className="th">Categoría</th><th className="th text-right">Costo</th><th className="th text-right">Precio</th><th className="th text-right">Con IVA</th><th className="th text-right">Stock</th><th className="th text-right">Mínimo</th><th className="th w-32" /></tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const bajoMin = p.stock <= p.stockMinimo
                return (
                  <tr key={p.id} className={cx('transition hover:bg-paper/60', bajoMin && p.activo && 'bg-coral-50/50', !p.activo && 'opacity-45')}>
                    <td className="td">
                      <p className={cx('font-medium', bajoMin && 'text-coral-700')}>{p.nombre}</p>
                      <p className="font-mono text-[11px] text-muted">{p.sku} · {p.codigoBarras}</p>
                    </td>
                    <td className="td text-muted">{p.categoria}</td>
                    <td className="td text-right text-muted tabular-nums">{money(p.costo)}</td>
                    <td className="td text-right tabular-nums">{money(p.precio)}</td>
                    <td className="td text-right font-medium tabular-nums">{money(round2(p.precio * 1.13))}</td>
                    <td className="td text-right">
                      <span className={cx('inline-flex min-w-10 justify-center rounded-lg px-2 py-0.5 font-semibold tabular-nums', bajoMin ? 'bg-coral text-white' : 'bg-paper')}>{p.stock}</span>
                    </td>
                    <td className="td text-right text-muted tabular-nums">{p.stockMinimo}</td>
                    <td className="td">
                      <div className="flex justify-end gap-0.5">
                        <IconButton title="Kardex" onClick={() => setKardex(p)}><History className="size-3.5" /></IconButton>
                        {puedeU && <IconButton title="Ajuste manual" onClick={() => setAjuste(p)}><SlidersHorizontal className="size-3.5" /></IconButton>}
                        {puedeU && <IconButton title="Editar" onClick={() => setEditar(p)}><Pencil className="size-3.5" /></IconButton>}
                        {puedeD && <IconButton title={p.activo ? 'Desactivar' : 'Activar'} onClick={() => toggle(p.id)}><Power className="size-3.5" /></IconButton>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={!!editar} onClose={() => setEditar(null)} title={editar?.id ? 'Editar producto' : 'Nuevo producto'} size="lg">
        {editar && <ProductoForm inicial={editar} onClose={() => setEditar(null)} />}
      </Modal>
      {ajuste && <AjusteModal producto={ajuste} onClose={() => setAjuste(null)} />}
      <KardexDrawer producto={kardex && productos.find((p) => p.id === kardex.id)!} onClose={() => setKardex(null)} />
    </>
  )
}
