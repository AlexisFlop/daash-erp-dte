import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Loader2, X, XCircle } from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import logo from '../assets/logo.svg'
import logoLight from '../assets/logo-light.svg'
import { cx } from '../lib/utils'

// ---------------- Marca ----------------
export const Logo = ({ light, className = 'h-7' }: { light?: boolean; className?: string }) => (
  <img src={light ? logoLight : logo} alt="Daash" className={cx('w-auto select-none', className)} draggable={false} />
)

export const Dots = ({ size = 8, animated }: { size?: number; animated?: boolean }) => (
  <span className="inline-flex items-center gap-1">
    {['bg-coral', 'bg-sun', 'bg-leaf'].map((c, i) => (
      <motion.span
        key={c}
        className={cx('rounded-full', c)}
        style={{ width: size, height: size }}
        animate={animated ? { y: [0, -3, 0] } : undefined}
        transition={animated ? { duration: 0.9, repeat: Infinity, delay: i * 0.15 } : undefined}
      />
    ))}
  </span>
)

// ---------------- Botón ----------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-900 shadow-sm',
  accent: 'bg-leaf text-ink-950 hover:brightness-95 shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:border-ink/25 hover:bg-paper',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-coral text-white hover:bg-coral-700 shadow-sm',
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, children, className, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export const IconButton = ({ children, className, title, ...p }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...p}
    title={title}
    aria-label={title}
    className={cx('inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-40', className)}
  >
    {children}
  </button>
)

// ---------------- Badge ----------------
type Tone = 'green' | 'yellow' | 'red' | 'gray' | 'dark'
const tones: Record<Tone, string> = {
  green: 'bg-leaf-50 text-leaf-700 ring-leaf/40',
  yellow: 'bg-sun-50 text-sun-800 ring-sun/70',
  red: 'bg-coral-50 text-coral-700 ring-coral/30',
  gray: 'bg-paper text-muted ring-line',
  dark: 'bg-ink text-white ring-ink',
}
export const Badge = ({ tone = 'gray', children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) => (
  <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset', tones[tone], className)}>
    {dot && <span className={cx('size-1.5 rounded-full', tone === 'green' ? 'bg-leaf-700' : tone === 'yellow' ? 'bg-sun-800' : tone === 'red' ? 'bg-coral' : 'bg-current')} />}
    {children}
  </span>
)

// ---------------- Formularios ----------------
export function Field({ label, error, hint, children, className }: { label: string; error?: string | false; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      <AnimatePresence>
        {error ? (
          <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 block text-[11.5px] font-medium text-coral-700">
            {error}
          </motion.span>
        ) : hint ? (
          <span className="mt-1 block text-[11.5px] text-muted">{hint}</span>
        ) : null}
      </AnimatePresence>
    </label>
  )
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-40', checked ? 'bg-ink' : 'bg-neutral-300')}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className={cx('absolute top-0.5 size-5 rounded-full shadow', checked ? 'right-0.5 bg-leaf' : 'left-0.5 bg-white')} />
    </button>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-paper p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx('relative cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', value === o.value ? 'text-ink' : 'text-muted hover:text-ink')}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-line" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ---------------- Overlays ----------------
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            role="dialog"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className={cx(
              'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-lift',
              size === 'sm' && 'max-w-md',
              size === 'md' && 'max-w-xl',
              size === 'lg' && 'max-w-3xl',
              size === 'xl' && 'max-w-5xl',
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div>
                <h3 className="text-[15px] font-semibold">{title}</h3>
                {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
              </div>
              <IconButton onClick={onClose} title="Cerrar">
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line bg-paper/60 px-6 py-3.5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, subtitle, children, width = 'max-w-2xl' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink-950/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className={cx('absolute top-0 right-0 flex h-full w-full flex-col bg-white shadow-lift', width)}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold">{title}</h3>
                {subtitle && <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>}
              </div>
              <IconButton onClick={onClose} title="Cerrar">
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ---------------- Toasts ----------------
interface ToastItem { id: number; tipo: 'ok' | 'error' | 'warn' | 'info'; titulo: string; texto?: string }
const useToasts = create<{ items: ToastItem[]; push: (t: Omit<ToastItem, 'id'>) => void; remove: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random()
    set((s) => ({ items: [...s.items, { ...t, id }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 4200)
  },
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}))
export const toast = {
  ok: (titulo: string, texto?: string) => useToasts.getState().push({ tipo: 'ok', titulo, texto }),
  error: (titulo: string, texto?: string) => useToasts.getState().push({ tipo: 'error', titulo, texto }),
  warn: (titulo: string, texto?: string) => useToasts.getState().push({ tipo: 'warn', titulo, texto }),
  info: (titulo: string, texto?: string) => useToasts.getState().push({ tipo: 'info', titulo, texto }),
}
export function Toaster() {
  const { items, remove } = useToasts()
  const icon = { ok: <CheckCircle2 className="size-4 text-leaf-700" />, error: <XCircle className="size-4 text-coral" />, warn: <AlertTriangle className="size-4 text-sun-800" />, info: <Info className="size-4 text-ink" /> }
  const bar = { ok: 'bg-leaf', error: 'bg-coral', warn: 'bg-sun', info: 'bg-ink' }
  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[360px] flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            className="pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border border-line bg-white py-3 pr-3 pl-4 shadow-lift"
          >
            <span className={cx('absolute inset-y-0 left-0 w-1', bar[t.tipo])} />
            <span className="mt-0.5">{icon[t.tipo]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">{t.titulo}</p>
              {t.texto && <p className="mt-0.5 text-[12.5px] break-words text-muted">{t.texto}</p>}
            </div>
            <IconButton className="size-6" onClick={() => remove(t.id)} title="Cerrar">
              <X className="size-3.5" />
            </IconButton>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

// ---------------- Layout helpers ----------------
export const PageHeader = ({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) => (
  <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && <p className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{eyebrow}</p>}
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
)

export const Stagger = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
    {children}
  </motion.div>
)
export const StaggerItem = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div className={className} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } }}>
    {children}
  </motion.div>
)

export function Stat({ label, value, hint, icon, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'green' | 'yellow' | 'red' }) {
  return (
    <div className="card relative overflow-hidden p-5">
      {tone && <span className={cx('absolute top-0 left-5 h-[3px] w-10 rounded-b-full', tone === 'green' ? 'bg-leaf' : tone === 'yellow' ? 'bg-sun' : 'bg-coral')} />}
      <div className="flex items-start justify-between">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <p className="mt-2 text-[26px] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <div className="mt-2 text-[12px] text-muted">{hint}</div>}
    </div>
  )
}

export const Empty = ({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-paper text-muted ring-1 ring-line">{icon}</div>
    <p className="font-semibold">{title}</p>
    {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
)

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-line px-6">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cx('relative cursor-pointer px-3 py-3 text-[13px] font-medium transition-colors', value === t.id ? 'text-ink' : 'text-muted hover:text-ink')}>
          {t.label}
          {value === t.id && <motion.span layoutId={`tabs-${tabs.map((x) => x.id).join()}`} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
        </button>
      ))}
    </div>
  )
}

// ---------------- Visor JSON ----------------
function highlight(json: string) {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (m) => {
      let cls = 'json-num'
      if (m.startsWith('"')) cls = m.endsWith(':') ? 'json-key' : 'json-str'
      else if (m === 'true' || m === 'false') cls = 'json-bool'
      else if (m === 'null') cls = 'json-null'
      return `<span class="${cls}">${m}</span>`
    })
}

export function JsonView({ data, raw, maxH = 'max-h-[60vh]' }: { data?: unknown; raw?: string; maxH?: string }) {
  const text = useMemo(() => raw ?? JSON.stringify(data, null, 2), [data, raw])
  const html = useMemo(() => (raw ? text.replace(/</g, '&lt;') : highlight(text)), [text, raw])
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-[#fbfbf9]">
      <div className="flex items-center justify-between border-b border-line bg-white px-3 py-2">
        <Dots size={7} />
        <button
          onClick={() => {
            navigator.clipboard.writeText(text)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-muted hover:bg-paper hover:text-ink"
        >
          {copiado ? <Check className="size-3.5 text-leaf-700" /> : <Copy className="size-3.5" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className={cx('overflow-auto p-4 font-mono text-[12px] leading-relaxed', maxH, raw && 'break-all whitespace-pre-wrap')} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title, text, confirmText = 'Confirmar', danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: ReactNode; confirmText?: string; danger?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>{confirmText}</Button>
        </>
      }
    >
      <p className="text-sm text-muted">{text}</p>
    </Modal>
  )
}

export const SearchInput = ({ value, onChange, placeholder, icon, className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; icon: ReactNode; className?: string; autoFocus?: boolean }) => (
  <div className={cx('relative', className)}>
    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{icon}</span>
    <input autoFocus={autoFocus} className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
)
