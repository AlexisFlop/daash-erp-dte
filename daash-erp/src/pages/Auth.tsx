import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, FileCheck2, Lock, Mail, RadioTower, ShieldCheck, ShieldX } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MINUTOS_TOKEN_RESET, politicaPassword } from '../lib/auth'
import { CREDENCIALES_DEMO } from '../lib/seed'
import { get } from '../lib/api'
import { useStore } from '../lib/store'
import type { CorreoSimulado } from '../lib/types'
import { cx } from '../lib/utils'
import { Button, Dots, Field, Logo, Modal, toast } from '../components/ui'

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <motion.div className="absolute -right-40 -bottom-40 size-[520px] rounded-full bg-leaf/10 blur-3xl" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 8, repeat: Infinity }} />
        <div className="relative flex items-center gap-3">
          <Logo light className="h-7" />
        </div>
        <div className="relative mt-auto max-w-md">
          <Dots size={9} animated />
          <h2 className="mt-5 text-[40px] leading-[1.08] font-semibold tracking-tight">
            Facturación electrónica
            <br />
            <span className="text-white/45">sin fricción.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/55">
            Punto de venta, inventario y documentos tributarios electrónicos conforme a la normativa del Ministerio de Hacienda de El Salvador.
          </p>
          <div className="mt-10 space-y-3">
            {[
              { i: <FileCheck2 className="size-4" />, t: 'JSON firmado y sello de recepción', c: 'text-leaf' },
              { i: <RadioTower className="size-4" />, t: 'Contingencia automática ante caídas del MH', c: 'text-sun' },
              { i: <ShieldCheck className="size-4" />, t: 'Control de acceso por roles y auditoría', c: 'text-coral' },
            ].map((f, k) => (
              <motion.div key={f.t} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + k * 0.12 }} className="flex items-center gap-3 text-[14px] text-white/75">
                <span className={cx('flex size-8 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10', f.c)}>{f.i}</span>
                {f.t}
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative mt-12 text-[12px] text-white/30">Adventure Works El Salvador · Desarrollado por Daash Devs · Prototipo académico</p>
      </div>
      <div className="flex items-center justify-center bg-white p-6 sm:p-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <Logo className="h-7" />
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder = '••••••••', autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input autoFocus={autoFocus} type={ver ? 'text' : 'password'} className="input h-11 pr-10 pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button type="button" onClick={() => setVer(!ver)} className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-muted hover:text-ink" aria-label="Mostrar contraseña">
        {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function Login() {
  const login = useStore((s) => s.login)
  const nav = useNavigate()
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [shake, setShake] = useState(0)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    await new Promise((r) => setTimeout(r, 450))
    const r = await login(correo, password)
    setCargando(false)
    if (r.ok) {
      nav('/')
      toast.ok('Bienvenido', 'Sesión iniciada con token JWT firmado (HS256)')
    } else {
      setError(r.mensaje ?? 'Error')
      setShake((s) => s + 1)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-[28px] font-semibold tracking-tight">Iniciar sesión</h1>
      <p className="mt-1.5 text-sm text-muted">Ingresa con tu correo corporativo para acceder según tu rol.</p>
      <motion.form key={shake} animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined} transition={{ duration: 0.4 }} onSubmit={enviar} className="mt-8 space-y-4">
        <Field label="Correo electrónico">
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input autoFocus type="email" required className="input h-11 pl-9" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@adventureworks.com.sv" />
          </div>
        </Field>
        <Field label="Contraseña">
          <PasswordInput value={password} onChange={setPassword} />
        </Field>
        <div className="flex justify-end">
          <Link to="/recuperar" className="text-[13px] font-medium text-ink underline-offset-4 hover:underline">¿Olvidaste tu contraseña?</Link>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-xl bg-coral-50 px-3.5 py-2.5 text-[13px] font-medium text-coral-700 ring-1 ring-coral/20">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <Button type="submit" size="lg" className="w-full" loading={cargando}>
          Ingresar <ArrowRight className="size-4" />
        </Button>
      </motion.form>

      <div className="mt-10">
        <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
          <span className="h-px flex-1 bg-line" /> Accesos de demostración <span className="h-px flex-1 bg-line" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CREDENCIALES_DEMO.map((c) => (
            <button
              key={c.correo}
              type="button"
              onClick={() => { setCorreo(c.correo); setPassword(c.password); setError('') }}
              className={cx('cursor-pointer rounded-xl border px-3 py-2.5 text-left transition hover:border-ink/30 hover:bg-paper', correo === c.correo ? 'border-ink bg-paper' : 'border-line')}
            >
              <p className="text-[13px] font-semibold">{c.rol}</p>
              <p className="truncate font-mono text-[10.5px] text-muted">{c.password}</p>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  )
}

export function Recuperar() {
  const solicitar = useStore((s) => s.solicitarReset)
  const [correo, setCorreo] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  return (
    <AuthShell>
      <Link to="/login" className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Volver al inicio de sesión
      </Link>
      <AnimatePresence mode="wait">
        {!enviado ? (
          <motion.div key="f" exit={{ opacity: 0, x: -20 }}>
            <h1 className="text-[28px] font-semibold tracking-tight">Recuperar acceso</h1>
            <p className="mt-1.5 text-sm text-muted">Te enviaremos un enlace temporal válido por {MINUTOS_TOKEN_RESET} minutos.</p>
            <form
              className="mt-8 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setCargando(true)
                await solicitar(correo)
                await new Promise((r) => setTimeout(r, 600))
                setCargando(false)
                setEnviado(true)
              }}
            >
              <Field label="Correo electrónico">
                <input type="email" required autoFocus className="input h-11" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@adventureworks.com.sv" />
              </Field>
              <Button type="submit" size="lg" className="w-full" loading={cargando}>Enviar enlace</Button>
            </form>
          </motion.div>
        ) : (
          <motion.div key="ok" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-700 ring-1 ring-leaf/40">
              <Mail className="size-5" />
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight">Revisa tu correo</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Si <b className="text-ink">{correo}</b> está registrado, recibirás un enlace para restablecer tu contraseña. Por seguridad, la respuesta es la misma aunque el correo no exista.
            </p>
            <BandejaInline correo={correo} />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}

function BandejaInline({ correo }: { correo: string }) {
  const [mail, setMail] = useState<CorreoSimulado | null>(null)
  useEffect(() => {
    get<CorreoSimulado[]>(`/auth/bandeja-demo?correo=${encodeURIComponent(correo.trim().toLowerCase())}`)
      .then((l) => setMail(l.find((c) => c.enlace) ?? null))
      .catch(() => setMail(null))
  }, [correo])
  if (!mail) return null
  return (
    <div className="mt-8 rounded-2xl border border-line bg-paper p-4">
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
        <Dots size={6} /> Bandeja simulada
      </p>
      <p className="text-[13px] font-semibold">{mail.asunto}</p>
      <p className="mt-1 text-[12.5px] text-muted">{mail.cuerpo}</p>
      <Link to={mail.enlace!} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[12.5px] font-medium text-white">
        Abrir enlace <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}

export function Requisitos({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-2 gap-1.5">
      {politicaPassword(password).map((r) => (
        <li key={r.texto} className={cx('flex items-center gap-1.5 text-[12px] transition-colors', r.ok ? 'text-leaf-700' : 'text-muted')}>
          <span className={cx('flex size-4 items-center justify-center rounded-full transition', r.ok ? 'bg-leaf text-ink' : 'bg-paper ring-1 ring-line')}>{r.ok && <Check className="size-2.5" strokeWidth={3} />}</span>
          {r.texto}
        </li>
      ))}
    </ul>
  )
}

export function Restablecer() {
  const { token = '' } = useParams()
  const validar = useStore((s) => s.validarResetToken)
  const restablecer = useStore((s) => s.restablecerPassword)
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [valido, setValido] = useState<{ expira: string } | null | undefined>(undefined)
  useEffect(() => {
    validar(token).then(setValido)
  }, [token, validar])
  const ok = politicaPassword(pw).every((r) => r.ok) && pw === pw2
  return (
    <AuthShell>
      {valido === undefined ? (
        <div className="py-10"><Dots size={9} animated /></div>
      ) : !valido ? (
        <div>
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-coral-50 text-coral ring-1 ring-coral/30">
            <ShieldX className="size-5" />
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight">Enlace inválido o expirado</h1>
          <p className="mt-2 text-sm text-muted">Los enlaces de restablecimiento caducan a los {MINUTOS_TOKEN_RESET} minutos y solo pueden usarse una vez.</p>
          <Link to="/recuperar"><Button className="mt-6">Solicitar un nuevo enlace</Button></Link>
        </div>
      ) : (
        <>
          <h1 className="text-[28px] font-semibold tracking-tight">Nueva contraseña</h1>
          <p className="mt-1.5 text-sm text-muted">Expira {new Date(valido.expira).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}.</p>
          <form
            className="mt-8 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!ok) return
              if (await restablecer(token, pw)) {
                toast.ok('Contraseña actualizada', 'Ya puedes iniciar sesión')
                nav('/login')
              }
            }}
          >
            <Field label="Nueva contraseña"><PasswordInput autoFocus value={pw} onChange={setPw} /></Field>
            <Field label="Confirmar contraseña" error={pw2 && pw !== pw2 ? 'Las contraseñas no coinciden' : ''}><PasswordInput value={pw2} onChange={setPw2} /></Field>
            <Requisitos password={pw} />
            <Button type="submit" size="lg" className="w-full" disabled={!ok}>Guardar contraseña</Button>
          </form>
        </>
      )}
    </AuthShell>
  )
}

export function CambiarPassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cambiar = useStore((s) => s.cambiarPassword)
  const [a, setA] = useState('')
  const [n, setN] = useState('')
  const ok = politicaPassword(n).every((r) => r.ok)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambiar contraseña"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!ok || !a}
            onClick={async () => {
              if (await cambiar(a, n)) {
                toast.ok('Contraseña actualizada')
                setA('')
                setN('')
                onClose()
              } else toast.error('Contraseña actual incorrecta')
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Contraseña actual"><PasswordInput value={a} onChange={setA} /></Field>
        <Field label="Nueva contraseña"><PasswordInput value={n} onChange={setN} /></Field>
        <Requisitos password={n} />
      </div>
    </Modal>
  )
}

export function SinAcceso() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-coral-50 text-coral ring-1 ring-coral/30">
        <ShieldX className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold">Acceso restringido</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">Tu rol no tiene permiso de lectura sobre este módulo. El intento quedó registrado en la bitácora de auditoría.</p>
      <Link to="/"><Button variant="secondary" className="mt-6">Ir al inicio</Button></Link>
    </div>
  )
}
