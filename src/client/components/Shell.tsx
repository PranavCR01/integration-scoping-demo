import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppConfig, Customer, GoalProfile } from '../../core/types'
import { chooseGoal } from '../../core/ordering'

// ---------- Header ----------

export function Header({
  configLabel,
  configCount,
  swapped,
  canSimulate,
  onLoadFile,
  onSimulate,
  onReset,
}: {
  configLabel: string
  configCount: number
  swapped: boolean
  canSimulate: boolean
  onLoadFile: () => void
  onSimulate: () => void
  onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const short = swapped ? (/simulated/i.test(configLabel) ? 'Simulated SAFE internal list' : configLabel) : 'SAFE public list'
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h10M4 12h16M4 17h7" />
              <circle cx="18" cy="7" r="2" />
              <circle cx="15" cy="17" r="2" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-slate-900">Integration Scoping</div>
            <div className="hidden text-xs text-slate-500 sm:block">First-week plan for a new customer</div>
          </div>
        </div>
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${swapped ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <span className={`h-2 w-2 rounded-full ${swapped ? 'bg-teal-600' : 'bg-slate-400'}`} />
            <span className="max-w-[9rem] truncate sm:max-w-[16rem]">
              {short}
              <span className="hidden sm:inline"> · {configCount} integrations</span>
            </span>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6l4 4 4-4" /></svg>
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
                <div className="font-medium text-slate-700">Integrations list in use</div>
                <div className="mt-0.5">{configLabel}</div>
              </div>
              <MenuItem onClick={() => { setOpen(false); onLoadFile() }} title="Load config file" sub="Swap in another list (same JSON shape)" />
              {canSimulate && !swapped && <MenuItem onClick={() => { setOpen(false); onSimulate() }} title="Use simulated internal list" sub="Public list plus Snyk, for the demo" />}
              {swapped && <MenuItem onClick={() => { setOpen(false); onReset() }} title="Reset to public list" sub="SAFE's public integrations page" />}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuItem({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full px-4 py-2.5 text-left hover:bg-slate-50">
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </button>
  )
}

// ---------- Intake (landing page, and the edit dialog) ----------

export function Intake({
  customer,
  customers,
  onChange,
  onPick,
  onBuild,
  busy,
  liveEnabled,
  mode,
  onMode,
  cta,
  eyebrow = 'New customer kickoff',
  goalProfiles = {},
}: {
  customer: Customer
  customers: Customer[]
  onChange: (c: Customer) => void
  onPick: (id: string) => void
  onBuild: () => void
  busy: boolean
  liveEnabled: boolean
  mode: 'saved' | 'live'
  onMode: (m: 'saved' | 'live') => void
  cta: string
  eyebrow?: string
  goalProfiles?: Record<string, GoalProfile>
}) {
  const [newTool, setNewTool] = useState('')
  const [editGoal, setEditGoal] = useState(false)
  const add = () => {
    const t = newTool.trim()
    if (t && !customer.tools.includes(t)) onChange({ ...customer, tools: [...customer.tools, t] })
    setNewTool('')
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">{eyebrow}</span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Fictional customer</span>
      </div>
      {customers.length > 1 ? (
        <select value={customer.id} onChange={(e) => onPick(e.target.value)} className="mt-2 -ml-1 rounded-md bg-transparent px-1 text-3xl font-semibold tracking-tight text-slate-900 hover:bg-slate-100">
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{customer.name}</h1>
      )}

      <div className="mt-5">
        <Label>Goal</Label>
        {editGoal ? (
          <textarea autoFocus value={customer.goal} onBlur={() => setEditGoal(false)} onChange={(e) => onChange({ ...customer, goal: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
        ) : (
          <button onClick={() => setEditGoal(true)} className="group mt-1 flex w-full items-start gap-2 rounded-lg text-left text-lg text-slate-800 hover:text-slate-950">
            <span>{customer.goal}</span>
            <svg viewBox="0 0 16 16" className="mt-1.5 h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z" /></svg>
          </button>
        )}
        <GoalRules goal={customer.goal} profiles={goalProfiles} onPick={(g) => onChange({ ...customer, goal: g })} />
      </div>

      <div className="mt-5">
        <Label>Tools they run ({customer.tools.length})</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {customer.tools.map((t) => (
            <span key={t} className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-2 text-sm font-medium text-slate-800 shadow-sm">
              {t}
              <button onClick={() => onChange({ ...customer, tools: customer.tools.filter((x) => x !== t) })} className="rounded text-slate-300 hover:text-rose-600" aria-label={`Remove ${t}`}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
            className="inline-flex"
          >
            <input value={newTool} onChange={(e) => setNewTool(e.target.value)} placeholder="+ Add a tool" className="w-36 rounded-lg border border-dashed border-slate-300 bg-transparent px-3 py-1.5 text-sm placeholder:text-slate-400 focus:w-48 focus:border-teal-500 focus:outline-none" />
          </form>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button onClick={onBuild} disabled={busy || customer.tools.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-[15px] font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-50">
          {busy ? (
            <>
              <Spinner /> {mode === 'live' ? 'Drafting and checking…' : 'Building plan…'}
            </>
          ) : (
            <>
              {cta}
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
            </>
          )}
        </button>
        {liveEnabled ? (
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {(['saved', 'live'] as const).map((m) => (
              <button key={m} onClick={() => onMode(m)} className={`rounded-md px-2.5 py-1 font-medium ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                {m === 'saved' ? 'Saved draft' : 'Draft live (about 2 min)'}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-500">Uses a saved model draft, re-checked against the docs on every run</span>
        )}
      </div>
    </div>
  )
}

export function Landing(props: Parameters<typeof Intake>[0]) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.12)] sm:p-9">
        <Intake {...props} />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Feature
          icon={<path d="M4 6h16M4 12h10M4 18h6" />}
          title="Coverage and order"
          text="Which tools SAFE connects to today, what needs a decision, and what to connect first."
        />
        <Feature
          icon={<><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M16 11h5M18.5 8.5v5" /></>}
          title="Access requests by person"
          text="Who owns each tool on the customer side, with an email ready to send."
        />
        <Feature
          icon={<><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>}
          title="Data readiness"
          text="Duplicates, stale assets and coverage gaps found before any risk figure."
        />
      </div>
      <div className="mx-auto mt-5 flex max-w-2xl items-start gap-2 text-sm text-slate-500">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
        <span>Every technical detail is checked against the vendor's own documentation. Anything that can't be checked is marked Confirm, never guessed.</span>
      </div>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm leading-relaxed text-slate-600">{text}</div>
    </div>
  )
}

// ---------- Customer bar (after the plan is built) ----------

export function CustomerBar({ customer, onEdit, exports }: { customer: Customer; onEdit: () => void; exports: { label: string; sub: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-slate-900">{customer.name}</span>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Fictional customer</span>
          <button onClick={onEdit} className="text-xs font-medium text-teal-800 hover:underline">
            Edit
          </button>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500">{customer.tools.join(' · ')}</div>
      </div>
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" /></svg>
          Export
        </button>
        {open && (
          <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {exports.map((e) => (
              <MenuItem key={e.label} title={e.label} sub={e.sub} onClick={() => { setOpen(false); e.onClick() }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 pt-20" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// Shows which rule set the typed goal will use, and offers the other goals as one-click presets.
function GoalRules({ goal, profiles, onPick }: { goal: string; profiles: Record<string, GoalProfile>; onPick: (g: string) => void }) {
  if (!Object.keys(profiles).length) return null
  const choice = chooseGoal(goal, { connection_order: { goal_profiles: profiles } } as unknown as AppConfig)
  return (
    <div className="mt-2.5">
      <div className="text-xs text-slate-500">
        Plan rules: <span className="font-semibold text-teal-800">{choice.label}</span>
        {choice.matched.length ? <span> (goal mentions "{choice.matched.join('", "')}")</span> : <span> (no keyword matched)</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400">Try another goal:</span>
        {Object.entries(profiles)
          .filter(([k]) => k !== 'default')
          .map(([k, p]) => (
            <button
              key={k}
              onClick={() => onPick(p.example_goal)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${choice.key === k ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              {p.label}
            </button>
          ))}
      </div>
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</div>
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
}
