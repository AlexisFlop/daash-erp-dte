import { Lock, Pencil, Plus, Power, RotateCcw, Save, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Confirm, Field, IconButton, Modal, PageHeader, SearchInput, Toggle, toast } from '../components/ui'
import { politicaPassword } from '../lib/auth'
import { DEPARTAMENTOS, MODULOS, SUCURSALES } from '../lib/catalogos'
import { permisos } from '../lib/seed'
import { useStore } from '../lib/store'
import type { Accion, Bitacora, Rol, Usuario } from '../lib/types'
import { cx, fmtFecha, tiempoRelativo, validarCorreo, validarDUI } from '../lib/utils'
import { Requisitos } from './Auth'

// ======================= USUARIOS =======================
export function Usuarios() {
  const usuarios = useStore((s) => s.usuarios)
  const roles = useStore((s) => s.roles)
  const guardar = useStore((s) => s.guardarUsuario)
  const toggle = useStore((s) => s.toggleUsuario)
  const yo = useStore((s) => s.sesion?.usuario.id)
  const puedeC = useStore((s) => s.puede('usuarios', 'c'))
  const puedeU = useStore((s) => s.puede('usuarios', 'u'))
  const puedeD = useStore((s) => s.puede('usuarios', 'd'))
  const [q, setQ] = useState('')
  const [ed, setEd] = useState<(Partial<Usuario> & { password?: string }) | null>(null)
  const [intento, setIntento] = useState(false)
  const [baja, setBaja] = useState<Usuario | null>(null)
  const lista = usuarios.filter((u) => !q || u.nombre.toLowerCase().includes(q.toLowerCase()) || u.correo.includes(q.toLowerCase()))
  const nuevo = ed && !ed.id
  const err = ed && {
    nombre: (ed.nombre ?? '').trim().length < 5 && 'Nombre completo requerido',
    correo: (!validarCorreo(ed.correo ?? '') && 'Correo inválido') || (usuarios.some((u) => u.correo === ed.correo?.toLowerCase() && u.id !== ed.id) && 'Correo ya registrado'),
    dui: !validarDUI(ed.dui ?? '') && 'DUI inválido',
    password: (nuevo || ed.password) && !politicaPassword(ed.password ?? '').every((r) => r.ok) && 'No cumple la política',
  }
  const e = (k: keyof NonNullable<typeof err>) => intento && err?.[k]

  return (
    <>
      <PageHeader eyebrow="Administración" title="Usuarios" description="Gestión del personal, asignación de sucursal y rol. Las bajas son lógicas (soft delete) para preservar la integridad del historial." actions={puedeC && <Button icon={<Plus className="size-4" />} onClick={() => { setIntento(false); setEd({ rolId: 'cajero', sucursal: SUCURSALES[0], nombre: '', correo: '', dui: '', password: '' }) }}>Nuevo usuario</Button>} />
      <div className="card overflow-hidden">
        <div className="border-b border-line p-4"><SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o correo…" icon={<Search className="size-4" />} /></div>
        <table className="w-full">
          <thead className="bg-paper/60"><tr><th className="th">Usuario</th><th className="th">Rol</th><th className="th">Sucursal</th><th className="th">Último acceso</th><th className="th">Estado</th><th className="th w-20" /></tr></thead>
          <tbody>
            {lista.map((u) => {
              const bloqueado = u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date()
              return (
                <tr key={u.id} className={cx('hover:bg-paper/60', !u.activo && 'opacity-50')}>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-[12px] font-semibold text-leaf">{u.nombre.split(' ').slice(0, 2).map((p) => p[0]).join('')}</span>
                      <div><p className="font-medium">{u.nombre} {u.id === yo && <span className="text-[11px] text-muted">(tú)</span>}</p><p className="text-[12px] text-muted">{u.correo}</p></div>
                    </div>
                  </td>
                  <td className="td"><Badge tone={u.rolId === 'gerente' ? 'dark' : 'gray'}>{roles.find((r) => r.id === u.rolId)?.nombre}</Badge></td>
                  <td className="td text-[12.5px] text-muted">{u.sucursal}</td>
                  <td className="td text-[12.5px] text-muted">{u.ultimoAcceso ? tiempoRelativo(u.ultimoAcceso) : 'Nunca'}</td>
                  <td className="td">{bloqueado ? <Badge tone="red" dot>Bloqueado</Badge> : <Badge tone={u.activo ? 'green' : 'gray'} dot>{u.activo ? 'Activo' : 'De baja'}</Badge>}</td>
                  <td className="td">
                    <div className="flex justify-end">
                      {puedeU && <IconButton title="Editar" onClick={() => { setIntento(false); setEd({ ...u, password: '' }) }}><Pencil className="size-3.5" /></IconButton>}
                      {puedeD && u.id !== yo && <IconButton title={u.activo ? 'Dar de baja' : 'Reactivar'} onClick={() => (u.activo ? setBaja(u) : toggle(u.id))}><Power className="size-3.5" /></IconButton>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal
        open={!!ed}
        onClose={() => setEd(null)}
        title={nuevo ? 'Nuevo usuario' : 'Editar usuario'}
        footer={<><Button variant="secondary" onClick={() => setEd(null)}>Cancelar</Button><Button onClick={async () => { setIntento(true); if (err && Object.values(err).some(Boolean)) return; if (await guardar(ed!)) { toast.ok('Usuario guardado', ed!.nombre); setEd(null) } }}>Guardar</Button></>}
      >
        {ed && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre completo" error={e('nombre')} className="col-span-2"><input className="input" value={ed.nombre} onChange={(x) => setEd({ ...ed, nombre: x.target.value })} autoFocus /></Field>
            <Field label="Correo corporativo" error={e('correo')}><input className="input" value={ed.correo} onChange={(x) => setEd({ ...ed, correo: x.target.value })} /></Field>
            <Field label="DUI" error={e('dui')}><input className="input font-mono" value={ed.dui} onChange={(x) => setEd({ ...ed, dui: x.target.value.replace(/[^\d-]/g, '').slice(0, 10) })} placeholder="00000000-0" /></Field>
            <Field label="Rol"><select className="input" value={ed.rolId} onChange={(x) => setEd({ ...ed, rolId: x.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></Field>
            <Field label="Sucursal"><select className="input" value={ed.sucursal} onChange={(x) => setEd({ ...ed, sucursal: x.target.value })}>{SUCURSALES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label={nuevo ? 'Contraseña inicial' : 'Nueva contraseña (opcional)'} error={e('password')} className="col-span-2"><input type="password" className="input" value={ed.password} onChange={(x) => setEd({ ...ed, password: x.target.value })} /></Field>
            {(nuevo || ed.password) && <div className="col-span-2"><Requisitos password={ed.password ?? ''} /></div>}
            <p className="col-span-2 text-[12px] text-muted">Las contraseñas se almacenan únicamente como hash (Bcrypt en el backend; SHA-256 con sal en este prototipo).</p>
          </div>
        )}
      </Modal>
      <Confirm open={!!baja} onClose={() => setBaja(null)} onConfirm={() => baja && toggle(baja.id)} danger title="Dar de baja usuario" confirmText="Dar de baja" text={<>El usuario <b>{baja?.nombre}</b> no podrá iniciar sesión. Sus ventas y documentos se conservan en el historial.</>} />
    </>
  )
}

// ======================= ROLES =======================
const ACCIONES: { id: Accion; label: string }[] = [{ id: 'c', label: 'Crear' }, { id: 'r', label: 'Leer' }, { id: 'u', label: 'Actualizar' }, { id: 'd', label: 'Borrar' }]

export function Roles() {
  const roles = useStore((s) => s.roles)
  const usuarios = useStore((s) => s.usuarios)
  const guardar = useStore((s) => s.guardarRol)
  const eliminar = useStore((s) => s.eliminarRol)
  const puedeC = useStore((s) => s.puede('roles', 'c'))
  const puedeU = useStore((s) => s.puede('roles', 'u'))
  const [selId, setSelId] = useState(roles[0].id)
  const [borrador, setBorrador] = useState<Rol | null>(null)
  const rol = borrador ?? roles.find((r) => r.id === selId) ?? roles[0]
  const editable = puedeU && !!borrador
  const sucio = borrador && JSON.stringify(borrador) !== JSON.stringify(roles.find((r) => r.id === borrador.id))

  const setPerm = (m: string, a: Accion, v: boolean) => {
    if (!borrador) return
    const p = structuredClone(borrador.permisos)
    p[m as keyof typeof p][a] = v
    if (a !== 'r' && v) p[m as keyof typeof p].r = true
    if (a === 'r' && !v) p[m as keyof typeof p] = { c: false, r: false, u: false, d: false }
    setBorrador({ ...borrador, permisos: p })
  }

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Roles y permisos"
        description="Control de acceso basado en roles (RBAC). Cada rol define permisos CRUD por módulo; el menú y las acciones se adaptan automáticamente."
        actions={puedeC && <Button icon={<Plus className="size-4" />} onClick={() => { const r: Rol = { id: `rol-${Date.now()}`, nombre: 'Nuevo rol', descripcion: '', sistema: false, autorizaDescuentos: false, permisos: permisos({ dashboard: 'read' }) }; setBorrador(r); setSelId(r.id) }}>Crear rol</Button>}
      />
      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {[...roles, ...(borrador && !roles.some((r) => r.id === borrador.id) ? [borrador] : [])].map((r) => (
            <button key={r.id} onClick={() => { setSelId(r.id); setBorrador(null) }} className={cx('card w-full cursor-pointer p-4 text-left transition', r.id === rol.id ? 'ring-2 ring-ink' : 'hover:shadow-lift')}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{r.nombre}</p>
                {r.sistema ? <Lock className="size-3.5 text-muted" /> : <Badge tone="green">Personalizado</Badge>}
              </div>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{r.descripcion || 'Sin descripción'}</p>
              <p className="mt-2 text-[11.5px] text-muted">{usuarios.filter((u) => u.rolId === r.id).length} usuario(s) · {MODULOS.filter((m) => r.permisos[m.id]?.r).length} módulos</p>
            </button>
          ))}
        </div>
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
            {editable ? (
              <div className="grid flex-1 gap-3 md:grid-cols-2">
                <Field label="Nombre del rol"><input className="input" value={borrador!.nombre} onChange={(e) => setBorrador({ ...borrador!, nombre: e.target.value })} /></Field>
                <Field label="Descripción"><input className="input" value={borrador!.descripcion} onChange={(e) => setBorrador({ ...borrador!, descripcion: e.target.value })} /></Field>
              </div>
            ) : (
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5" /> {rol.nombre}</p>
                <p className="text-sm text-muted">{rol.descripcion}</p>
              </div>
            )}
            <div className="flex gap-2">
              {puedeU && !borrador && <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setBorrador(structuredClone(rol))}>Editar permisos</Button>}
              {borrador && <Button variant="ghost" onClick={() => setBorrador(null)}>Descartar</Button>}
              {borrador && <Button icon={<Save className="size-4" />} disabled={!sucio && roles.some((r) => r.id === borrador.id)} onClick={async () => { if (await guardar(borrador)) { setSelId(borrador.id); setBorrador(null); toast.ok('Rol guardado', 'Los permisos se aplican de inmediato') } }}>Guardar</Button>}
              {!rol.sistema && puedeU && !borrador && <IconButton title="Eliminar rol" onClick={async () => { if (await eliminar(rol.id)) { toast.ok('Rol eliminado'); setSelId(roles[0].id) } }}><Trash2 className="size-4" /></IconButton>}
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div>
              <p className="text-[13.5px] font-medium">Autorizar descuentos sobre el límite base</p>
              <p className="text-[12px] text-muted">Permite aprobar descuentos especiales en el POS (RF-11)</p>
            </div>
            <Toggle checked={rol.autorizaDescuentos} disabled={!editable} onChange={(v) => setBorrador({ ...borrador!, autorizaDescuentos: v })} />
          </div>
          <table className="w-full">
            <thead className="bg-paper/60"><tr><th className="th">Módulo</th>{ACCIONES.map((a) => <th key={a.id} className="th text-center">{a.label}</th>)}</tr></thead>
            <tbody>
              {MODULOS.map((m) => (
                <tr key={m.id} className="hover:bg-paper/40">
                  <td className="td"><p className="font-medium">{m.nombre}</p><p className="text-[11.5px] text-muted">{m.grupo}</p></td>
                  {ACCIONES.map((a) => {
                    const on = rol.permisos[m.id]?.[a.id]
                    return (
                      <td key={a.id} className="td text-center">
                        <button
                          disabled={!editable}
                          onClick={() => setPerm(m.id, a.id, !on)}
                          className={cx('inline-flex size-6 items-center justify-center rounded-md transition', on ? 'bg-ink text-leaf' : 'bg-paper ring-1 ring-line', editable ? 'cursor-pointer hover:scale-110' : 'cursor-default')}
                        >
                          {on && <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.5l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ======================= AUDITORÍA =======================
const NIVEL: Record<Bitacora['nivel'], 'green' | 'yellow' | 'red' | 'gray'> = { ok: 'green', warn: 'yellow', error: 'red', info: 'gray' }

export function Auditoria() {
  const bitacora = useStore((s) => s.bitacora)
  const usuarios = useStore((s) => s.usuarios)
  const [q, setQ] = useState('')
  const [modulo, setModulo] = useState('')
  const [nivel, setNivel] = useState('')
  const [lim, setLim] = useState(60)
  const lista = useMemo(() => bitacora.filter((b) => (!modulo || b.modulo === modulo) && (!nivel || b.nivel === nivel) && (!q || (b.accion + b.detalle).toLowerCase().includes(q.toLowerCase()))), [bitacora, q, modulo, nivel])
  return (
    <>
      <PageHeader eyebrow="Administración" title="Bitácora de auditoría" description="Registro inmutable de eventos de seguridad, operaciones de caja, inventario y transmisiones DTE." />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <SearchInput className="min-w-64 flex-1" value={q} onChange={setQ} placeholder="Buscar en eventos…" icon={<Search className="size-4" />} />
          <select className="input w-auto" value={modulo} onChange={(e) => setModulo(e.target.value)}>
            <option value="">Todos los módulos</option>
            <option value="auth">Autenticación</option>
            {MODULOS.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <select className="input w-auto" value={nivel} onChange={(e) => setNivel(e.target.value)}>
            <option value="">Todos los niveles</option><option value="ok">Éxito</option><option value="info">Información</option><option value="warn">Advertencia</option><option value="error">Error</option>
          </select>
        </div>
        <table className="w-full">
          <thead className="bg-paper/60"><tr><th className="th">Fecha</th><th className="th">Usuario</th><th className="th">Módulo</th><th className="th">Evento</th><th className="th">Detalle</th></tr></thead>
          <tbody>
            {lista.slice(0, lim).map((b) => (
              <tr key={b.id} className="hover:bg-paper/50">
                <td className="td text-[12px] whitespace-nowrap text-muted">{fmtFecha(b.fecha, true)}</td>
                <td className="td text-[12.5px]">{usuarios.find((u) => u.id === b.usuarioId)?.nombre ?? 'Sistema'}</td>
                <td className="td"><span className="font-mono text-[11.5px] text-muted">{b.modulo}</span></td>
                <td className="td"><Badge tone={NIVEL[b.nivel]} dot>{b.accion}</Badge></td>
                <td className="td text-[12.5px] text-muted">{b.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length > lim && <div className="border-t border-line p-3 text-center"><button className="cursor-pointer text-[13px] font-medium text-muted hover:text-ink" onClick={() => setLim(lim + 60)}>Mostrar más</button></div>}
      </div>
    </>
  )
}

// ======================= CONFIGURACIÓN =======================
export function Configuracion() {
  const config = useStore((s) => s.config)
  const actualizar = useStore((s) => s.actualizarConfig)
  const setMh = useStore((s) => s.setMhEnLinea)
  const reset = useStore((s) => s.restablecerDemo)
  const puedeU = useStore((s) => s.puede('configuracion', 'u'))
  const [em, setEm] = useState(config.emisor)
  const [confirm, setConfirm] = useState(false)
  const fila = (t: string, d: string, ctrl: React.ReactNode) => (
    <div className="flex items-center justify-between gap-6 border-t border-line px-6 py-4 first:border-t-0">
      <div><p className="text-[13.5px] font-medium">{t}</p><p className="text-[12.5px] text-muted">{d}</p></div>
      {ctrl}
    </div>
  )
  return (
    <>
      <PageHeader eyebrow="Administración" title="Configuración" description="Datos del emisor, ambiente de facturación y simulador del servicio del Ministerio de Hacienda." />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <div className="border-b border-line px-6 py-4"><p className="font-semibold">Datos del emisor</p><p className="text-[12.5px] text-muted">Se incluyen en el bloque "emisor" de cada DTE</p></div>
          <div className="grid grid-cols-2 gap-4 p-6">
            <Field label="Razón social" className="col-span-2"><input disabled={!puedeU} className="input" value={em.nombre} onChange={(e) => setEm({ ...em, nombre: e.target.value })} /></Field>
            <Field label="Nombre comercial"><input disabled={!puedeU} className="input" value={em.nombreComercial} onChange={(e) => setEm({ ...em, nombreComercial: e.target.value })} /></Field>
            <Field label="Correo"><input disabled={!puedeU} className="input" value={em.correo} onChange={(e) => setEm({ ...em, correo: e.target.value })} /></Field>
            <Field label="NIT"><input disabled={!puedeU} className="input font-mono" value={em.nit} onChange={(e) => setEm({ ...em, nit: e.target.value })} /></Field>
            <Field label="NRC"><input disabled={!puedeU} className="input font-mono" value={em.nrc} onChange={(e) => setEm({ ...em, nrc: e.target.value })} /></Field>
            <Field label="Código de establecimiento"><input disabled={!puedeU} className="input font-mono" maxLength={4} value={em.codEstable} onChange={(e) => setEm({ ...em, codEstable: e.target.value.toUpperCase() })} /></Field>
            <Field label="Punto de venta"><input disabled={!puedeU} className="input font-mono" maxLength={4} value={em.codPuntoVenta} onChange={(e) => setEm({ ...em, codPuntoVenta: e.target.value.toUpperCase() })} /></Field>
            <Field label="Departamento"><select disabled={!puedeU} className="input" value={em.direccion.departamento} onChange={(e) => setEm({ ...em, direccion: { ...em.direccion, departamento: e.target.value, municipio: Object.keys(DEPARTAMENTOS[e.target.value].municipios)[0] } })}>{Object.entries(DEPARTAMENTOS).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}</select></Field>
            <Field label="Municipio"><select disabled={!puedeU} className="input" value={em.direccion.municipio} onChange={(e) => setEm({ ...em, direccion: { ...em.direccion, municipio: e.target.value } })}>{Object.entries(DEPARTAMENTOS[em.direccion.departamento].municipios).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Dirección" className="col-span-2"><input disabled={!puedeU} className="input" value={em.direccion.complemento} onChange={(e) => setEm({ ...em, direccion: { ...em.direccion, complemento: e.target.value } })} /></Field>
            {puedeU && <div className="col-span-2 flex justify-end"><Button icon={<Save className="size-4" />} onClick={async () => { if (await actualizar({ emisor: em })) toast.ok('Datos del emisor actualizados') }}>Guardar</Button></div>}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card">
            <div className="border-b border-line px-6 py-4"><p className="font-semibold">Facturación electrónica</p></div>
            {fila('Ambiente', '00 = pruebas · 01 = producción', <select disabled={!puedeU} className="input w-40" value={config.ambiente} onChange={(e) => actualizar({ ambiente: e.target.value as '00' | '01' })}><option value="00">00 · Pruebas</option><option value="01">01 · Producción</option></select>)}
            {fila('Descuento base del cajero', 'Sobre este porcentaje se requiere autorización de gerente', <div className="flex items-center gap-2"><input disabled={!puedeU} type="number" className="input w-20 text-right" value={config.descuentoBase} onChange={(e) => actualizar({ descuentoBase: Math.max(0, Number(e.target.value)) })} /><span className="text-muted">%</span></div>)}
            {fila('Correlativos', 'Último número de control emitido por tipo', <div className="flex gap-2 font-mono text-[12px]">{Object.entries(config.correlativos).map(([k, v]) => <span key={k} className="rounded-md bg-paper px-2 py-1 ring-1 ring-line">{k}: {v}</span>)}</div>)}
          </div>
          <div className="card">
            <div className="border-b border-line px-6 py-4"><p className="font-semibold">Simulador del Ministerio de Hacienda</p><p className="text-[12.5px] text-muted">Herramientas para demostrar los flujos del prototipo</p></div>
            {fila('Servicio de recepción en línea', 'Apágalo para provocar el flujo de contingencia', <Toggle disabled={!puedeU} checked={config.mhEnLinea} onChange={(v) => setMh(v, 1, '')} />)}
            {fila('Simular rechazo en el próximo envío', 'El MH devolverá un error de validación (código 004)', <Toggle disabled={!puedeU} checked={config.simularRechazo} onChange={(v) => actualizar({ simularRechazo: v })} />)}
            {fila('Modo demostración del cron', 'Reintenta cada 20 s en lugar de cada 5 min', <Toggle disabled={!puedeU} checked={config.modoDemo} onChange={(v) => actualizar({ modoDemo: v })} />)}
            {fila('Latencia simulada', `${config.latenciaMs} ms por transmisión`, <input disabled={!puedeU} type="range" min={200} max={3000} step={100} value={config.latenciaMs} onChange={(e) => actualizar({ latenciaMs: Number(e.target.value) })} className="w-40 accent-[#333]" />)}
          </div>
          {puedeU && (
            <div className="card flex items-center justify-between gap-4 p-6">
              <div><p className="font-semibold text-coral-700">Restablecer datos de demostración</p><p className="text-[12.5px] text-muted">Elimina los cambios y regenera el historial de ventas</p></div>
              <Button variant="danger" icon={<RotateCcw className="size-4" />} onClick={() => setConfirm(true)}>Restablecer</Button>
            </div>
          )}
        </div>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} danger title="¿Restablecer la base de datos demo?" confirmText="Restablecer" text="Se perderán todas las ventas, documentos y cambios realizados. Se cerrará la sesión." onConfirm={async () => { if (await reset()) location.href = '/login' }} />
    </>
  )
}
