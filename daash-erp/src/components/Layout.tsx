import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3, Boxes, Building2, ChevronsLeft, FileText, KeyRound, LayoutDashboard, LogOut, Mail, Paperclip, RadioTower, ScrollText, Settings,
  ShieldCheck, ShoppingCart, Truck, Users, UserSquare2, Wallet,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { MODULOS } from '../lib/catalogos'
import { useStore } from '../lib/store'
import type { Modulo } from '../lib/types'
import { cx, tiempoRelativo } from '../lib/utils'
import { CambiarPassword } from '../pages/Auth'
import { Badge, Drawer, Logo, toast } from './ui'

const ICONOS: Record<Modulo, ReactNode> = {
  dashboard: <LayoutDashboard className="size-[18px]" />,
  pos: <ShoppingCart className="size-[18px]" />,
  caja: <Wallet className="size-[18px]" />,
  dte: <FileText className="size-[18px]" />,
  contingencia: <RadioTower className="size-[18px]" />,
  inventario: <Boxes className="size-[18px]" />,
  compras: <Truck className="size-[18px]" />,
  proveedores: <Building2 className="size-[18px]" />,
  clientes: <UserSquare2 className="size-[18px]" />,
  reportes: <BarChart3 className="size-[18px]" />,
  usuarios: <Users className="size-[18px]" />,
  roles: <ShieldCheck className="size-[18px]" />,
  auditoria: <ScrollText className="size-[18px]" />,
  configuracion: <Settings className="size-[18px]" />,
}

export const RUTAS: Record<Modulo, string> = {
  dashboard: '/', pos: '/pos', caja: '/caja', dte: '/dte', contingencia: '/contingencia', inventario: '/inventario', compras: '/compras',
  proveedores: '/proveedores', clientes: '/clientes', reportes: '/reportes', usuarios: '/usuarios', roles: '/roles', auditoria: '/auditoria', configuracion: '/configuracion',
}

/** Sincronización con el servidor: el cron de contingencia corre en el backend; aquí solo se refresca el estado */
function useSincronizacion() {
  const refrescar = useStore((s) => s.refrescar)
  const pendientes = useStore((s) => s.dtes.filter((d) => d.estado === 'CONTINGENCIA').length)
  const activo = useStore((s) => !s.config.mhEnLinea || !!s.config.proximoReintento)
  const previo = useRef(pendientes)
  useEffect(() => {
    if (previo.current > 0 && pendientes === 0) toast.ok('Contingencia resuelta', `${previo.current} DTE transmitidos y sellados por el MH`)
    previo.current = pendientes
  }, [pendientes])
  useEffect(() => {
    const t = setInterval(() => refrescar('contingencia', 'dtes', 'correos'), activo || pendientes > 0 ? 3000 : 20000)
    return () => clearInterval(t)
  }, [activo, pendientes, refrescar])
}

export function MhStatus({ compact }: { compact?: boolean }) {
  const enLinea = useStore((s) => s.config.mhEnLinea)
  const pendientes = useStore((s) => s.dtes.filter((d) => d.estado === 'CONTINGENCIA').length)
  const ambiente = useStore((s) => s.config.ambiente)
  return (
    <Link
      to="/contingencia"
      className={cx(
        'group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
        enLinea ? 'border-line bg-white text-ink hover:border-ink/20' : 'border-sun bg-sun-50 text-sun-800',
      )}
    >
      <span className={cx('relative flex size-2 rounded-full', enLinea ? 'bg-leaf text-leaf/60' : 'bg-sun text-sun')}>
        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
      </span>
      {enLinea ? 'MH en línea' : 'Contingencia activa'}
      {!compact && <span className="text-muted">· {ambiente === '00' ? 'Pruebas' : 'Producción'}</span>}
      {pendientes > 0 && <Badge tone="yellow">{pendientes} en cola</Badge>}
    </Link>
  )
}

function Bandeja() {
  const correos = useStore((s) => s.correos)
  const marcar = useStore((s) => s.marcarCorreoLeido)
  const [open, setOpen] = useState(false)
  const noLeidos = correos.filter((c) => !c.leido).length
  return (
    <>
      <button onClick={() => setOpen(true)} title="Bandeja de correo simulada" className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-xl text-muted transition hover:bg-ink/5 hover:text-ink">
        <Mail className="size-[18px]" />
        {noLeidos > 0 && <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-coral text-[9px] font-bold text-white">{noLeidos}</span>}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Bandeja de correo simulada" subtitle="Servidor SMTP de pruebas: aquí llegan los comprobantes y enlaces de recuperación" width="max-w-lg">
        {correos.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">Sin correos todavía.</p>
        ) : (
          <ul className="divide-y divide-line">
            {correos.map((c) => (
              <li key={c.id} className={cx('px-6 py-4', !c.leido && 'bg-leaf-50/40')} onMouseEnter={() => !c.leido && marcar(c.id)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[13px] font-semibold">{c.asunto}</p>
                  <span className="shrink-0 text-[11px] text-muted">{tiempoRelativo(c.fecha)}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-muted">Para: {c.para}</p>
                <p className="mt-2 text-[13px] leading-relaxed">{c.cuerpo}</p>
                {c.enlace && (
                  <Link to={c.enlace} onClick={() => setOpen(false)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[12px] font-medium text-white">
                    <KeyRound className="size-3.5" /> Restablecer contraseña
                  </Link>
                )}
                {c.adjuntos && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.adjuntos.map((a) => (
                      <span key={a} className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-1 font-mono text-[11px] text-muted ring-1 ring-line">
                        <Paperclip className="size-3" /> {a.slice(0, 14)}…{a.slice(-5)}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  )
}

export function Layout() {
  useSincronizacion()
  const usuario = useStore((s) => s.usuarioActual())
  const rol = useStore((s) => s.rolActual())
  const logout = useStore((s) => s.logout)
  const nav = useNavigate()
  const loc = useLocation()
  const [colapsado, setColapsado] = useState(false)
  const [menu, setMenu] = useState(false)
  const [pwd, setPwd] = useState(false)
  const visibles = MODULOS.filter((m) => rol?.permisos[m.id]?.r)
  const grupos = [...new Set(visibles.map((m) => m.grupo))]
  const iniciales = usuario?.nombre.split(' ').slice(0, 2).map((p) => p[0]).join('') ?? ''

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <motion.aside animate={{ width: colapsado ? 76 : 256 }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="relative flex shrink-0 flex-col bg-ink-950 text-white">
        <div className="flex h-16 items-center gap-3 px-5">
          {colapsado ? (
            <img src="/favicon.svg" className="size-8" alt="Daash" />
          ) : (
            <div className="flex items-center gap-3">
              <Logo light className="h-[22px]" />
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white/70">ERP</span>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4">
          {grupos.map((g) => (
            <div key={g} className="mt-4">
              {!colapsado && <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-white/35 uppercase">{g}</p>}
              {visibles
                .filter((m) => m.grupo === g)
                .map((m) => (
                  <NavLink key={m.id} to={RUTAS[m.id]} end={m.id === 'dashboard'} title={m.nombre} className="group relative block">
                    {({ isActive }) => (
                      <span className={cx('relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] transition-colors', isActive ? 'text-white' : 'text-white/55 hover:bg-white/5 hover:text-white')}>
                        {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                        {isActive && <motion.span layoutId="nav-bar" className="absolute top-2.5 -left-3 h-5 w-1 rounded-r-full bg-leaf" />}
                        <span className="relative">{ICONOS[m.id]}</span>
                        {!colapsado && <span className="relative truncate">{m.nombre}</span>}
                      </span>
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <button onClick={() => setColapsado(!colapsado)} className="mx-3 mb-3 flex h-9 cursor-pointer items-center gap-3 rounded-xl px-3 text-[12px] text-white/40 transition hover:bg-white/5 hover:text-white">
          <ChevronsLeft className={cx('size-4 transition-transform', colapsado && 'rotate-180')} />
          {!colapsado && 'Contraer menú'}
        </button>
      </motion.aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-white/80 px-8 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3 text-[13px] text-muted">
            <span className="truncate">{usuario?.sucursal}</span>
          </div>
          <div className="flex items-center gap-2">
            <MhStatus />
            <Bandeja />
            <div className="relative">
              <button onClick={() => setMenu(!menu)} className="flex cursor-pointer items-center gap-3 rounded-xl py-1.5 pr-2 pl-1.5 transition hover:bg-ink/5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-[12px] font-semibold text-leaf">{iniciales}</span>
                <span className="hidden text-left md:block">
                  <span className="block text-[13px] leading-tight font-semibold">{usuario?.nombre}</span>
                  <span className="block text-[11.5px] leading-tight text-muted">{rol?.nombre}</span>
                </span>
              </button>
              <AnimatePresence>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-lift">
                      <div className="px-3 py-2.5">
                        <p className="text-[13px] font-semibold">{usuario?.nombre}</p>
                        <p className="text-[12px] text-muted">{usuario?.correo}</p>
                      </div>
                      <div className="my-1 h-px bg-line" />
                      <button onClick={() => { setMenu(false); setPwd(true) }} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] hover:bg-paper">
                        <KeyRound className="size-4 text-muted" /> Cambiar contraseña
                      </button>
                      <button onClick={() => { logout(); nav('/login') }} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-coral-700 hover:bg-coral-50">
                        <LogOut className="size-4" /> Cerrar sesión
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="mx-auto max-w-[1400px] px-8 py-8">
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CambiarPassword open={pwd} onClose={() => setPwd(false)} />
    </div>
  )
}
