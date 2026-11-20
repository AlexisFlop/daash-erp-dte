import { type ReactNode, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dots, Toaster } from './components/ui'
import { useStore } from './lib/store'
import type { Modulo } from './lib/types'
import { Auditoria, Configuracion, Roles, Usuarios } from './pages/Admin'
import { Login, Recuperar, Restablecer, SinAcceso } from './pages/Auth'
import Caja from './pages/Caja'
import Clientes from './pages/Clientes'
import Compras, { Proveedores } from './pages/Compras'
import Contingencia from './pages/Contingencia'
import Dashboard from './pages/Dashboard'
import Documentos from './pages/Documentos'
import Inventario from './pages/Inventario'
import POS from './pages/POS'
import Reportes from './pages/Reportes'

function Protegido({ children }: { children: ReactNode }) {
  const sesion = useStore((s) => s.sesion)
  return sesion ? children : <Navigate to="/login" replace />
}

function Permiso({ modulo, children }: { modulo: Modulo; children: ReactNode }) {
  const puede = useStore((s) => s.puede(modulo, 'r'))
  return puede ? children : <SinAcceso />
}

function Inicio() {
  // Si el rol no ve el dashboard, redirige al primer módulo permitido
  const rol = useStore((s) => s.rolActual())
  if (rol?.permisos.dashboard.r) return <Dashboard />
  if (rol?.permisos.pos.r) return <Navigate to="/pos" replace />
  return <SinAcceso />
}

const rutas: [string, Modulo, ReactNode][] = [
  ['/pos', 'pos', <POS />],
  ['/caja', 'caja', <Caja />],
  ['/dte', 'dte', <Documentos />],
  ['/contingencia', 'contingencia', <Contingencia />],
  ['/inventario', 'inventario', <Inventario />],
  ['/compras', 'compras', <Compras />],
  ['/proveedores', 'proveedores', <Proveedores />],
  ['/clientes', 'clientes', <Clientes />],
  ['/reportes', 'reportes', <Reportes />],
  ['/usuarios', 'usuarios', <Usuarios />],
  ['/roles', 'roles', <Roles />],
  ['/auditoria', 'auditoria', <Auditoria />],
  ['/configuracion', 'configuracion', <Configuracion />],
]

export default function App() {
  const verificada = useStore((s) => s.sesionVerificada)
  const sesion = useStore((s) => s.sesion)
  const restaurar = useStore((s) => s.restaurarSesion)
  useEffect(() => {
    restaurar()
  }, [restaurar])

  const cargando = useStore((s) => s.cargando)
  if (!verificada || cargando)
    return (
      <div className="flex h-full items-center justify-center">
        <Dots size={10} animated />
      </div>
    )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={sesion ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/restablecer/:token" element={<Restablecer />} />
        <Route element={<Protegido><Layout /></Protegido>}>
          <Route index element={<Inicio />} />
          {rutas.map(([path, m, el]) => <Route key={path} path={path} element={<Permiso modulo={m}>{el}</Permiso>} />)}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
