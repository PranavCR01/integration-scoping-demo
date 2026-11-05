import type { ReactNode } from 'react'
import type { Bucket, FactKind } from '../../core/types'
import { BUCKET_LABEL } from '../../core/types'

// Renders `code` and **bold** inside plain text.
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  )
}

const BUCKET_STYLE: Record<Bucket, string> = {
  out_of_box: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  confirm_with_safe: 'bg-amber-50 text-amber-800 ring-amber-200',
  custom_work: 'bg-violet-50 text-violet-800 ring-violet-200',
}

export function BucketBadge({ bucket }: { bucket: Bucket }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BUCKET_STYLE[bucket]}`}>{BUCKET_LABEL[bucket]}</span>
}

export function Pill({ tone = 'slate', children }: { tone?: 'slate' | 'amber' | 'emerald' | 'rose' | 'teal' | 'violet'; children: ReactNode }) {
  const t = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    rose: 'bg-rose-50 text-rose-800 ring-rose-200',
    teal: 'bg-teal-50 text-teal-800 ring-teal-200',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  }[tone]
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${t}`}>{children}</span>
}

export function ConfirmTag({ reason }: { reason: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">Confirm</span>
      {reason && <span className="text-sm text-amber-900/80">{reason}</span>}
    </span>
  )
}

export interface CiteTarget {
  file: string
  line: number
  kind?: FactKind | string
  value?: string
  corrected_from?: number | null
}

export function CiteChip({ c, label, onOpen }: { c: CiteTarget; label: string; onOpen: (c: CiteTarget) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c)}
      title={`${label}, line ${c.line}${c.value ? ` (${c.kind}: ${c.value})` : ''}`}
      className="inline-flex items-center gap-1 rounded border border-teal-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-teal-800 hover:border-teal-400 hover:bg-teal-50"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 2h6l3 3v9H4z" /><path d="M6 8h5M6 11h5" /></svg>
      {label} L{c.line}
    </button>
  )
}

export function Section({ n, title, children, aside }: { n?: number | string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          {n !== undefined && <span className="mr-2 text-teal-700">{n}.</span>}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'rose' | 'amber' | 'emerald' }) {
  const c = tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900'
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className={`text-xl font-semibold tabular-nums ${c}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

export const shortLabel = (file: string, labels: Record<string, string>) => {
  const full = labels[file] ?? file.split('/').pop() ?? file
  return full.replace(/\s*\(.*\)$/, '').replace(/^Snyk docs: /, 'Snyk ').replace('Okta Management OpenAPI', 'Okta spec').replace('Snyk REST OpenAPI spec', 'Snyk spec').replace('Tenable VM API notes', 'Tenable notes')
}
