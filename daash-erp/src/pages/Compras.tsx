import { Building2, Pencil, Plus, Power, Search, Trash2, Truck } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Badge, Button, Empty, Field, IconButton, Modal, PageHeader, SearchInput, Stat, toast } from '../components/ui'
import { useStore } from '../lib/store'
import { useShallow } from 'zustand/react/shallow'
import type { ItemCompra, Proveedor } from '../lib/types'
import { cx, fechaISO, fmtFecha, money, round2, validarCorreo, validarNIT, validarNRC } from '../lib/utils'

function NuevaCompra({ onClose }: { onClose: () => void }) {
  const proveedores = useStore(useShallow((s) => s.proveedores.filter((p) => p.activo)))
  const productos = useStore(useShallow((s) => s.productos.filter((p) => p.activo)))
  const registrar = useStore((s) => s.registrarCompra)
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? '')
  const [numero, setNumero] = useState('')
  const [fecha, setFecha] = useState(fechaISO())
  const [items, setItems] = useState<ItemCompra[]>([])
  const [pid, setPid] = useState('')
  const subtotal = round2(items.reduce((a, i) => a + i.cantidad * i.costoUnit, 0))
  const iva = round2(subtotal * 0.13)
  const valido = proveedorId && numero.trim() && items.length && items.every((i) => i.cantidad > 0 && i.costoUnit > 0)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Field label="Proveedor" className="col-span-3 md:col-span-1">
          <select className="input" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razonSocial}</option>)}
          </select>
        </Field>
        <Field label="N.º de comprobante (CCF del proveedor)"><input className="input font-mono" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="DTE-03-…" /></Field>
        <Field label="Fecha"><input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      </div>
      <div className="flex gap-2">
        <select className="input flex-1" value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">Agregar producto…</option>
          {productos.filter((p) => !items.some((i) => i.productoId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.nombre} (stock {p.stock})</option>)}
        </select>
        <Button variant="secondary" icon={<Plus className="size-4" />} disabled={!pid} onClick={() => { const p = productos.find((x) => x.id === pid)!; setItems([...items, { productoId: pid, cantidad: 1, costoUnit: p.costo }]); setPid('') }}>Agregar</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full">
          <thead className="bg-paper"><tr><th className="th">Producto</th><th className="th w-28 text-right">Cantidad</th><th className="th w-32 text-right">Costo unit.</th><th className="th text-right">Subtotal</th><th className="th w-10" /></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="td py-8 text-center text-muted">Agrega los productos de la factura de compra</td></tr>}
            {items.map((it, i) => {
              const p = productos.find((x) => x.id === it.productoId)!
              return (
                <tr key={it.productoId}>
                  <td className="td"><p className="font-medium">{p.nombre}</p><p className="font-mono text-[11px] text-muted">{p.sku}</p></td>
                  <td className="td"><input type="number" min={1} className="input h-9 text-right tabular-nums" value={it.cantidad} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, cantidad: Math.max(0, Number(e.target.value)) } : x)))} /></td>
                  <td className="td"><input type="number" step="0.01" className="input h-9 text-right tabular-nums" value={it.costoUnit} onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, costoUnit: Number(e.target.value) } : x)))} /></td>
                  <td className="td text-right font-medium tabular-nums">{money(it.cantidad * it.costoUnit)}</td>
                  <td className="td"><IconButton title="Quitar" onClick={() => setItems(items.filter((_, k) => k !== i))}><Trash2 className="size-3.5" /></IconButton></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex justify-end gap-8 border-t border-line bg-paper px-4 py-3 text-[13px]">
          <span className="text-muted">Subtotal <b className="ml-1 text-ink tabular-nums">{money(subtotal)}</b></span>
          <span className="text-muted">Crédito fiscal IVA <b className="ml-1 text-ink tabular-nums">{money(iva)}</b></span>
          <span className="text-muted">Total <b className="ml-1 text-[15px] text-ink tabular-nums">{money(subtotal + iva)}</b></span>
        </div>
      </div>
      <p className="text-[12.5px] text-muted">Al guardar, las existencias aumentan automáticamente, se registra la entrada en el Kardex y se actualiza el costo promedio ponderado.</p>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valido} onClick={async () => { if (await registrar({ proveedorId, numeroComprobante: numero.trim(), fecha, items })) { toast.ok('Compra registrada', `${items.length} producto(s) ingresaron al Kardex`); onClose() } }}>Registrar compra</Button>
      </div>
    </div>
  )
}

export default function Compras() {
  const compras = useStore((s) => s.compras)
  const proveedores = useStore((s) => s.proveedores)
  const productos = useStore((s) => s.productos)
  const usuarios = useStore((s) => s.usuarios)
  const puedeC = useStore((s) => s.puede('compras', 'c'))
  const [nueva, setNueva] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const mes = fechaISO().slice(0, 7)
  const delMes = compras.filter((c) => c.fecha.slice(0, 7) === mes)
  return (
    <>
      <PageHeader eyebrow="Bodega" title="Compras" description="Registro de facturas de compra (créditos fiscales) que ingresan mercadería al inventario." actions={puedeC && <Button icon={<Plus className="size-4" />} onClick={() => setNueva(true)}>Registrar compra</Button>} />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Compras del mes" value={delMes.length} icon={<Truck className="size-4" />} />
        <Stat tone="green" label="Total comprado (mes)" value={money(delMes.reduce((a, c) => a + c.total, 0))} />
        <Stat tone="yellow" label="Crédito fiscal IVA (mes)" value={money(delMes.reduce((a, c) => a + c.iva, 0))} />
      </div>
      <div className="card overflow-hidden">
        {compras.length === 0 ? (
          <Empty icon={<Truck className="size-5" />} title="Sin compras registradas" />
        ) : (
          <table className="w-full">
            <thead className="bg-paper/60"><tr><th className="th">Fecha</th><th className="th">Comprobante</th><th className="th">Proveedor</th><th className="th text-right">Ítems</th><th className="th text-right">Subtotal</th><th className="th text-right">IVA</th><th className="th text-right">Total</th><th className="th">Registró</th></tr></thead>
            <tbody>
              {compras.map((c) => (
                <Fragment key={c.id}>
                  <tr onClick={() => setAbierta(abierta === c.id ? null : c.id)} className="cursor-pointer hover:bg-paper/60">
                    <td className="td text-muted">{fmtFecha(c.fecha)}</td>
                    <td className="td font-mono text-[12.5px]">{c.numeroComprobante}</td>
                    <td className="td">{proveedores.find((p) => p.id === c.proveedorId)?.razonSocial}</td>
                    <td className="td text-right tabular-nums">{c.items.length}</td>
                    <td className="td text-right tabular-nums">{money(c.subtotal)}</td>
                    <td className="td text-right text-muted tabular-nums">{money(c.iva)}</td>
                    <td className="td text-right font-semibold tabular-nums">{money(c.total)}</td>
                    <td className="td text-muted">{usuarios.find((u) => u.id === c.usuarioId)?.nombre.split(' ')[0]}</td>
                  </tr>
                  {abierta === c.id && (
                    <tr>
                      <td colSpan={8} className="bg-paper/60 px-8 py-3">
                        {c.items.map((i) => {
                          const p = productos.find((x) => x.id === i.productoId)
                          return <p key={i.productoId} className="flex justify-between py-1 text-[12.5px]"><span>{p?.sku} · {p?.nombre}</span><span className="tabular-nums">{i.cantidad} × {money(i.costoUnit)}</span></p>
                        })}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={nueva} onClose={() => setNueva(false)} title="Registrar factura de compra" size="xl">
        {nueva && <NuevaCompra onClose={() => setNueva(false)} />}
      </Modal>
    </>
  )
}

const provVacio: Proveedor = { id: '', razonSocial: '', nit: '', nrc: '', contacto: '', telefono: '', correo: '', activo: true }

export function Proveedores() {
  const proveedores = useStore((s) => s.proveedores)
  const compras = useStore((s) => s.compras)
  const guardar = useStore((s) => s.guardarProveedor)
  const toggle = useStore((s) => s.toggleProveedor)
  const puedeC = useStore((s) => s.puede('proveedores', 'c'))
  const puedeU = useStore((s) => s.puede('proveedores', 'u'))
  const [q, setQ] = useState('')
  const [ed, setEd] = useState<Proveedor | null>(null)
  const [intento, setIntento] = useState(false)
  const lista = useMemo(() => proveedores.filter((p) => !q || p.razonSocial.toLowerCase().includes(q.toLowerCase()) || p.nit.includes(q)), [proveedores, q])
  const err = ed && {
    razonSocial: ed.razonSocial.trim().length < 3 && 'Razón social requerida',
    nit: !validarNIT(ed.nit) && 'NIT inválido (0000-000000-000-0)',
    nrc: !validarNRC(ed.nrc) && 'NRC inválido (000000-0)',
    contacto: !ed.contacto.trim() && 'Persona de contacto requerida',
    telefono: !/^\d{4}-?\d{4}$/.test(ed.telefono) && 'Teléfono inválido (0000-0000)',
    correo: ed.correo && !validarCorreo(ed.correo) && 'Correo inválido',
  }
  const e = (k: keyof NonNullable<typeof err>) => intento && err?.[k]
  return (
    <>
      <PageHeader eyebrow="Bodega" title="Proveedores" description="Directorio centralizado con los datos fiscales de cada proveedor." actions={puedeC && <Button icon={<Plus className="size-4" />} onClick={() => { setIntento(false); setEd({ ...provVacio }) }}>Nuevo proveedor</Button>} />
      <div className="card overflow-hidden">
        <div className="border-b border-line p-4"><SearchInput value={q} onChange={setQ} placeholder="Buscar por razón social o NIT…" icon={<Search className="size-4" />} /></div>
        <table className="w-full">
          <thead className="bg-paper/60"><tr><th className="th">Razón social</th><th className="th">NIT</th><th className="th">NRC</th><th className="th">Contacto</th><th className="th text-right">Compras</th><th className="th">Estado</th><th className="th w-20" /></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className={cx('hover:bg-paper/60', !p.activo && 'opacity-50')}>
                <td className="td"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-paper text-muted"><Building2 className="size-4" /></span><span className="font-medium">{p.razonSocial}</span></div></td>
                <td className="td font-mono text-[12.5px]">{p.nit}</td>
                <td className="td font-mono text-[12.5px]">{p.nrc}</td>
                <td className="td text-[12.5px]"><p>{p.contacto}</p><p className="text-muted">{p.telefono} · {p.correo}</p></td>
                <td className="td text-right tabular-nums">{compras.filter((c) => c.proveedorId === p.id).length}</td>
                <td className="td"><Badge tone={p.activo ? 'green' : 'gray'} dot>{p.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                <td className="td"><div className="flex justify-end">{puedeU && <><IconButton title="Editar" onClick={() => { setIntento(false); setEd(p) }}><Pencil className="size-3.5" /></IconButton><IconButton title="Activar / desactivar" onClick={() => toggle(p.id)}><Power className="size-3.5" /></IconButton></>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={!!ed}
        onClose={() => setEd(null)}
        title={ed?.id ? 'Editar proveedor' : 'Nuevo proveedor'}
        footer={<><Button variant="secondary" onClick={() => setEd(null)}>Cancelar</Button><Button onClick={async () => { setIntento(true); if (err && Object.values(err).some(Boolean)) return; if (await guardar(ed!)) { toast.ok('Proveedor guardado', ed!.razonSocial); setEd(null) } }}>Guardar</Button></>}
      >
        {ed && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Razón social" error={e('razonSocial')} className="col-span-2"><input className="input" value={ed.razonSocial} onChange={(x) => setEd({ ...ed, razonSocial: x.target.value })} autoFocus /></Field>
            <Field label="NIT" error={e('nit')}><input className="input font-mono" value={ed.nit} onChange={(x) => setEd({ ...ed, nit: x.target.value })} placeholder="0614-000000-000-0" /></Field>
            <Field label="NRC" error={e('nrc')}><input className="input font-mono" value={ed.nrc} onChange={(x) => setEd({ ...ed, nrc: x.target.value })} placeholder="000000-0" /></Field>
            <Field label="Persona de contacto" error={e('contacto')}><input className="input" value={ed.contacto} onChange={(x) => setEd({ ...ed, contacto: x.target.value })} /></Field>
            <Field label="Teléfono" error={e('telefono')}><input className="input" value={ed.telefono} onChange={(x) => setEd({ ...ed, telefono: x.target.value })} placeholder="2200-0000" /></Field>
            <Field label="Correo" error={e('correo')} className="col-span-2"><input className="input" value={ed.correo} onChange={(x) => setEd({ ...ed, correo: x.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  )
}
