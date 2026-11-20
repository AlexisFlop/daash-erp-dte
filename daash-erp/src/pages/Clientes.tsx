import { Building2, Pencil, Plus, Power, Search, UserRound, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Empty, Field, IconButton, Modal, PageHeader, SearchInput, Segmented, toast } from '../components/ui'
import { ACTIVIDADES, DEPARTAMENTOS } from '../lib/catalogos'
import { useStore } from '../lib/store'
import type { Cliente } from '../lib/types'
import { cx, validarCorreo, validarDUI, validarNIT, validarNRC } from '../lib/utils'

const vacio = (): Cliente => ({
  id: '', tipo: 'CONSUMIDOR', nombre: '', tipoDocumento: '13', numDocumento: '', correo: '', telefono: '', direccion: { departamento: '06', municipio: '20', complemento: '' }, activo: true, creado: '',
})

/** Formatea mientras se escribe: DUI 00000000-0, NIT 0000-000000-000-0, NRC 000000-0 */
const mascara = (v: string, tipo: 'dui' | 'nit' | 'nrc') => {
  const d = v.replace(/\D/g, '')
  if (tipo === 'dui') return d.slice(0, 9).replace(/^(\d{8})(\d)/, '$1-$2')
  if (tipo === 'nrc') return d.length > 1 ? `${d.slice(0, Math.min(d.length - 1, 6))}-${d.slice(Math.min(d.length - 1, 6), 7)}` : d
  const p = [d.slice(0, 4), d.slice(4, 10), d.slice(10, 13), d.slice(13, 14)].filter(Boolean)
  return p.join('-')
}

export function ClienteForm({ inicial, onSaved, onCancel }: { inicial?: Partial<Cliente>; onSaved: (id: string) => void; onCancel: () => void }) {
  const guardar = useStore((s) => s.guardarCliente)
  const [c, setC] = useState<Cliente>({ ...vacio(), ...(inicial?.tipo === 'CONTRIBUYENTE' && !inicial.id ? { tipoDocumento: '36' } : {}), ...inicial })
  const [intento, setIntento] = useState(false)
  const set = (p: Partial<Cliente>) => setC((x) => ({ ...x, ...p }))
  const contrib = c.tipo === 'CONTRIBUYENTE'

  const errores = {
    nombre: c.nombre.trim().length < 3 && 'Nombre requerido',
    numDocumento: c.tipoDocumento === '13' ? !validarDUI(c.numDocumento) && 'DUI inválido (formato 00000000-0 y dígito verificador)' : !validarNIT(c.numDocumento) && 'NIT inválido (0000-000000-000-0)',
    nrc: contrib && !validarNRC(c.nrc ?? '') && 'NRC inválido (ej. 123456-7)',
    codActividad: contrib && !c.codActividad && 'Seleccione la actividad económica',
    correo: (contrib || c.correo) && !validarCorreo(c.correo) && 'Correo inválido',
  }
  const valido = !Object.values(errores).some(Boolean)
  const e = (k: keyof typeof errores) => intento && errores[k]

  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault()
        setIntento(true)
        if (!valido) return
        const r = await guardar({ ...c, nombre: c.nombre.trim() })
        if (!r) return
        toast.ok(c.id ? 'Cliente actualizado' : 'Cliente registrado', r.nombre)
        onSaved(r.id)
      }}
      className="space-y-5"
    >
      <Segmented
        value={c.tipo}
        onChange={(t) => set({ tipo: t, tipoDocumento: t === 'CONTRIBUYENTE' ? '36' : c.tipoDocumento })}
        options={[{ value: 'CONSUMIDOR', label: 'Consumidor final' }, { value: 'CONTRIBUYENTE', label: 'Contribuyente (IVA)' }]}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field label={contrib ? 'Razón social' : 'Nombre completo'} error={e('nombre')} className="col-span-2">
          <input className={cx('input', e('nombre') && 'input-error')} value={c.nombre} onChange={(x) => set({ nombre: x.target.value })} autoFocus />
        </Field>
        {contrib && (
          <Field label="Nombre comercial" className="col-span-2">
            <input className="input" value={c.nombreComercial ?? ''} onChange={(x) => set({ nombreComercial: x.target.value })} />
          </Field>
        )}
        <Field label="Tipo de documento">
          <select className="input" value={c.tipoDocumento} onChange={(x) => set({ tipoDocumento: x.target.value as '13' | '36', numDocumento: '' })}>
            <option value="13">DUI</option>
            <option value="36">NIT</option>
          </select>
        </Field>
        <Field label={c.tipoDocumento === '13' ? 'Número de DUI' : 'Número de NIT'} error={e('numDocumento')}>
          <input className={cx('input font-mono', e('numDocumento') && 'input-error')} value={c.numDocumento} onChange={(x) => set({ numDocumento: mascara(x.target.value, c.tipoDocumento === '13' ? 'dui' : 'nit') })} placeholder={c.tipoDocumento === '13' ? '00000000-0' : '0000-000000-000-0'} />
        </Field>
        {contrib && (
          <>
            <Field label="NRC" error={e('nrc')}>
              <input className={cx('input font-mono', e('nrc') && 'input-error')} value={c.nrc ?? ''} onChange={(x) => set({ nrc: mascara(x.target.value, 'nrc') })} placeholder="000000-0" />
            </Field>
            <Field label="Actividad económica (CAT-019)" error={e('codActividad')}>
              <select className={cx('input', e('codActividad') && 'input-error')} value={c.codActividad ?? ''} onChange={(x) => set({ codActividad: x.target.value, descActividad: ACTIVIDADES[x.target.value] })}>
                <option value="">Seleccione…</option>
                {Object.entries(ACTIVIDADES).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Correo electrónico" error={e('correo')}>
          <input className={cx('input', e('correo') && 'input-error')} value={c.correo} onChange={(x) => set({ correo: x.target.value })} />
        </Field>
        <Field label="Teléfono">
          <input className="input" value={c.telefono} onChange={(x) => set({ telefono: x.target.value })} placeholder="0000-0000" />
        </Field>
        <Field label="Departamento">
          <select className="input" value={c.direccion.departamento} onChange={(x) => set({ direccion: { ...c.direccion, departamento: x.target.value, municipio: Object.keys(DEPARTAMENTOS[x.target.value].municipios)[0] } })}>
            {Object.entries(DEPARTAMENTOS).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
          </select>
        </Field>
        <Field label="Municipio">
          <select className="input" value={c.direccion.municipio} onChange={(x) => set({ direccion: { ...c.direccion, municipio: x.target.value } })}>
            {Object.entries(DEPARTAMENTOS[c.direccion.departamento].municipios).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Dirección (complemento)" className="col-span-2">
          <input className="input" value={c.direccion.complemento} onChange={(x) => set({ direccion: { ...c.direccion, complemento: x.target.value } })} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar cliente</Button>
      </div>
    </form>
  )
}

export default function Clientes() {
  const clientes = useStore((s) => s.clientes)
  const dtes = useStore((s) => s.dtes)
  const toggle = useStore((s) => s.toggleCliente)
  const puedeC = useStore((s) => s.puede('clientes', 'c'))
  const puedeU = useStore((s) => s.puede('clientes', 'u'))
  const puedeD = useStore((s) => s.puede('clientes', 'd'))
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'TODOS' | 'CONSUMIDOR' | 'CONTRIBUYENTE'>('TODOS')
  const [editar, setEditar] = useState<Cliente | null | 'nuevo'>(null)

  const lista = useMemo(() => {
    const t = q.toLowerCase()
    return clientes.filter((c) => (filtro === 'TODOS' || c.tipo === filtro) && (!t || c.nombre.toLowerCase().includes(t) || c.numDocumento.includes(t) || c.nrc?.includes(t)))
  }, [clientes, q, filtro])

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Clientes"
        description="Base de datos de clientes con validación de DUI, NIT y NRC salvadoreños para su asignación a comprobantes."
        actions={puedeC && <Button icon={<Plus className="size-4" />} onClick={() => setEditar('nuevo')}>Nuevo cliente</Button>}
      />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <SearchInput className="min-w-64 flex-1" value={q} onChange={setQ} placeholder="Buscar por nombre, DUI, NIT o NRC…" icon={<Search className="size-4" />} />
          <Segmented value={filtro} onChange={setFiltro} options={[{ value: 'TODOS', label: 'Todos' }, { value: 'CONSUMIDOR', label: 'Consumidores' }, { value: 'CONTRIBUYENTE', label: 'Contribuyentes' }]} />
        </div>
        {lista.length === 0 ? (
          <Empty icon={<Users className="size-5" />} title="Sin clientes" />
        ) : (
          <table className="w-full">
            <thead className="bg-paper/60">
              <tr><th className="th">Cliente</th><th className="th">Documento</th><th className="th">NRC</th><th className="th">Contacto</th><th className="th text-right">Documentos</th><th className="th">Estado</th><th className="th w-20" /></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className={cx('transition hover:bg-paper/60', !c.activo && 'opacity-50')}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className={cx('flex size-9 items-center justify-center rounded-xl', c.tipo === 'CONTRIBUYENTE' ? 'bg-leaf-50 text-leaf-700' : 'bg-paper text-muted')}>{c.tipo === 'CONTRIBUYENTE' ? <Building2 className="size-4" /> : <UserRound className="size-4" />}</span>
                      <div>
                        <p className="font-medium">{c.nombre}</p>
                        <p className="text-[12px] text-muted">{c.tipo === 'CONTRIBUYENTE' ? c.descActividad : 'Consumidor final'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td font-mono text-[12.5px]"><span className="mr-1.5 text-[10px] text-muted">{c.tipoDocumento === '13' ? 'DUI' : 'NIT'}</span>{c.numDocumento}</td>
                  <td className="td font-mono text-[12.5px]">{c.nrc ?? '—'}</td>
                  <td className="td text-[12.5px]"><p>{c.correo || '—'}</p><p className="text-muted">{c.telefono}</p></td>
                  <td className="td text-right tabular-nums">{dtes.filter((d) => d.clienteId === c.id).length}</td>
                  <td className="td"><Badge tone={c.activo ? 'green' : 'gray'} dot>{c.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="td">
                    <div className="flex justify-end gap-0.5">
                      {puedeU && <IconButton title="Editar" onClick={() => setEditar(c)}><Pencil className="size-3.5" /></IconButton>}
                      {puedeD && <IconButton title={c.activo ? 'Desactivar' : 'Activar'} onClick={() => toggle(c.id)}><Power className="size-3.5" /></IconButton>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={!!editar} onClose={() => setEditar(null)} title={editar === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'} size="lg">
        {editar && <ClienteForm inicial={editar === 'nuevo' ? undefined : editar} onCancel={() => setEditar(null)} onSaved={() => setEditar(null)} />}
      </Modal>
    </>
  )
}
