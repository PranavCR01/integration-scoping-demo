import { useState } from 'react'
import type { Plan } from '../../core/types'
import type { OwnerActions, Summary } from '../../core/summary'
import { Pill } from './ui'

const WHO_TONE = { SAFE: 'violet', Customer: 'amber', Us: 'teal' } as const

export function SummaryCard({ plan, summary, onOwners }: { plan: Plan; summary: Summary; onOwners: () => void }) {
  const d = summary.data
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">Where things stand</div>
        <p className="mt-1.5 max-w-3xl text-lg font-medium leading-snug text-slate-900">{summary.headline}</p>
        <div className="mt-1.5 text-xs text-slate-500">Goal: {plan.customer.goal} · Plan built for: <span className="font-medium text-slate-700">{plan.goal.label}</span></div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-4 sm:divide-y-0">
        <Tile value={`${summary.ready_now} of ${summary.tools_total}`} label={summary.later_total ? `needed tools ready (${summary.later_total} more can wait)` : 'tools ready to connect'} tone="emerald" />
        <Tile value={summary.safe_items} label="items for SAFE to confirm" tone={summary.safe_items ? 'violet' : 'emerald'} />
        <Tile value={summary.customer_questions} label={`answers needed from ${plan.customer.name.split(' ')[0]}`} tone={summary.customer_questions ? 'amber' : 'emerald'} />
        <Tile
          value={d.status === 'not_run' ? 'Not checked' : d.blockers}
          label={d.status === 'not_run' ? 'data checks not run yet' : 'data issues blocking use'}
          tone={d.status === 'ready' ? 'emerald' : d.status === 'blocked' ? 'rose' : 'slate'}
        />
      </div>
      {summary.blockers.length > 0 && (
        <div className="px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">What stands between {plan.customer.name} and {plan.goal.short}</div>
          <ul className="mt-2 space-y-1.5">
            {summary.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                <span className="mt-0.5 w-20 shrink-0">
                  <Pill tone={WHO_TONE[b.who]}>{b.who === 'Us' ? 'Our side' : b.who}</Pill>
                </span>
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
          <button onClick={onOwners} className="mt-3 text-sm font-medium text-teal-800 hover:underline">
            See who owes what, with emails ready to send →
          </button>
        </div>
      )}
    </section>
  )
}

function Tile({ value, label, tone }: { value: string | number; label: string; tone: 'emerald' | 'violet' | 'amber' | 'rose' | 'slate' }) {
  const c = { emerald: 'text-emerald-700', violet: 'text-violet-700', amber: 'text-amber-700', rose: 'text-rose-700', slate: 'text-slate-500' }[tone]
  return (
    <div className="px-5 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${c}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

const PARTY = {
  customer: { tag: 'Customer', tone: 'amber' as const },
  safe: { tag: 'SAFE', tone: 'violet' as const },
  us: { tag: 'Our side', tone: 'teal' as const },
}
const KIND = { access: 'Access', question: 'Question', decision: 'Decision', data: 'Data' }

export function OwnersView({ actions, customerName, dataRun, later = [] }: { actions: OwnerActions[]; customerName: string; dataRun: boolean; later?: string[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Every open item, grouped by the person who has to act. Emails are built only from verified details and checked questions; nothing new is written for them. {!dataRun && 'Data items appear once the data checks have run.'}
      </p>
      {later.length > 0 && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          Not needed for this goal, so no requests yet: <span className="font-medium text-slate-700">{later.join(', ')}</span>.
        </p>
      )}
      {/* Narrow screens: one column in order. Wide screens: two independent columns, cards
          alternating left and right, so a tall card never leaves a gap beside a short one. */}
      <div className="space-y-4 xl:hidden">
        {actions.map((a) => (
          <OwnerCard key={`${a.party}-${a.owner}`} a={a} customerName={customerName} />
        ))}
      </div>
      <div className="hidden gap-4 xl:grid xl:grid-cols-2 xl:items-start">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-4">
            {actions
              .filter((_, i) => i % 2 === col)
              .map((a) => (
                <OwnerCard key={`${a.party}-${a.owner}`} a={a} customerName={customerName} />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function OwnerCard({ a, customerName }: { a: OwnerActions; customerName: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!a.email) return
    const text = `Subject: ${a.email.subject}\n\n${a.email.body}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const t = document.createElement('textarea')
      t.value = text
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const p = PARTY[a.party]
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Pill tone={p.tone}>{p.tag === 'Customer' ? customerName : p.tag}</Pill>
            <span className="text-xs text-slate-500">{a.items.length} item{a.items.length === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-1 font-semibold text-slate-900">{a.owner}</div>
          {a.tools.length > 0 && <div className="text-xs text-slate-500">{a.tools.join(', ')}</div>}
        </div>
        {a.email && (
          <button onClick={copy} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${copied ? 'bg-emerald-600 text-white' : 'bg-teal-700 text-white hover:bg-teal-800'}`}>
            {copied ? 'Copied' : 'Copy email'}
          </button>
        )}
      </div>
      <ul className="flex-1 space-y-2 px-4 py-3">
        {a.items.map((i, k) => (
          <li key={k} className="flex gap-2 text-sm text-slate-700">
            <span className="mt-0.5 w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{KIND[i.kind]}</span>
            <span>{i.text}</span>
          </li>
        ))}
      </ul>
      {a.email && (
        <div className="border-t border-slate-100 px-4 py-2">
          <button onClick={() => setOpen(!open)} className="text-xs font-medium text-teal-800 hover:underline">
            {open ? 'Hide email' : 'Preview email'}
          </button>
          {open && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
              <span className="font-semibold">Subject: {a.email.subject}</span>
              {'\n\n'}
              {a.email.body}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
