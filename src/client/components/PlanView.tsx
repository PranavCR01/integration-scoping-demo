import type { Plan, PlanRow } from '../../core/types'
import { BucketBadge, CiteChip, ConfirmTag, Rich, Section, shortLabel, type CiteTarget } from './ui'

interface Props {
  plan: Plan
  labels: Record<string, string>
  onCite: (c: CiteTarget) => void
  changed: Record<string, string>
  evidence: boolean
}

function Cites({ row, labels, onCite, evidence }: { row: PlanRow; labels: Record<string, string>; onCite: (c: CiteTarget) => void; evidence: boolean }) {
  if (!row.citations.length || !evidence) return null
  const seen = new Set<string>()
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {row.citations
        .filter((c) => {
          const k = `${c.file}#${c.line}`
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        .map((c) => (
          <CiteChip key={`${c.file}#${c.line}`} c={c} label={shortLabel(c.file, labels)} onOpen={onCite} />
        ))}
    </div>
  )
}

function Checked() {
  return (
    <span title="Every technical detail here was checked against the vendor's docs. Turn on Show evidence to see the exact lines." className="ml-1.5 inline-flex translate-y-0.5 items-center text-teal-600">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  )
}

function RowBody({ row, labels, onCite, evidence }: { row: PlanRow; labels: Record<string, string>; onCite: (c: CiteTarget) => void; evidence: boolean }) {
  if (row.status === 'confirm') return <ConfirmTag reason={row.confirm_reason} />
  return (
    <div>
      <div className="text-sm leading-relaxed text-slate-700">
        <Rich text={row.text} />
        {!evidence && row.citations.length > 0 && <Checked />}
      </div>
      <Cites row={row} labels={labels} onCite={onCite} evidence={evidence} />
    </div>
  )
}

export function PlanView({ plan, labels, onCite, changed, evidence }: Props) {
  const customN = plan.custom_sheets.length ? 1 : 0
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{plan.document.title_prefix}</span>
        <span>{plan.document.status}</span>
        <span>Integrations list: {plan.config_label}</span>
        {evidence && <span>Draft: {plan.draft_note}</span>}
      </div>

      <Section n={1} title="Coverage check" aside={evidence ? <span className="text-xs text-slate-500">Matched in code against the integrations config</span> : undefined}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Customer tool</th>
                <th className="py-2 pr-3 font-medium">Bucket</th>
                <th className="py-2 font-medium">{evidence ? 'Why (full reasoning)' : 'Why'}</th>
              </tr>
            </thead>
            <tbody>
              {plan.coverage.map((c) => (
                <tr key={c.input} className={`border-b border-slate-100 align-top ${changed[c.input] ? 'bg-teal-50/70' : ''}`}>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">{c.input}</td>
                  <td className="py-2.5 pr-3">
                    <BucketBadge bucket={c.bucket} />
                    {changed[c.input] && <div className="mt-1 text-xs font-medium text-teal-700">was {changed[c.input]}</div>}
                  </td>
                  <td className="py-2.5 text-slate-700">
                    {evidence ? c.why : c.short}
                    {evidence && c.evidence.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.evidence.slice(0, 6).map((e) => (
                          <CiteChip key={`${e.file}#${e.line}`} c={e} label={shortLabel(e.file, labels).replace('SAFE public integrations page', 'SAFE list').replace('Simulated SAFE internal list', 'Internal list')} onOpen={onCite} />
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        n={2}
        title="Connection order"
        aside={
          <span className="text-xs text-slate-500">
            Rules for: <span className="font-medium text-slate-700">{plan.goal.label}</span>
            {evidence && (plan.goal.matched.length ? ` (goal mentions "${plan.goal.matched.join('", "')}")` : ' (no goal keyword matched, so general rules)')}
            {evidence && ' · config/connection_order.json'}
          </span>
        }
      >
        <ol className="space-y-2.5">
          {plan.order.filter((s) => !s.later).map((s) => (
            <li key={s.step} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">{s.step}</span>
              <div className="text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-900">{s.tools.map((t) => t.input).join(' and ')}</span>
                  {s.tools[0].bucket !== 'out_of_box' && <BucketBadge bucket={s.tools[0].bucket} />}
                </div>
                <div className="text-slate-700">{s.unlocks}</div>
                {s.gate && <div className="mt-0.5 text-amber-800">{s.gate}</div>}
              </div>
            </li>
          ))}
        </ol>
        {plan.order.some((s) => s.later) && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Not needed for this goal (connect later)</div>
            <ul className="mt-2 space-y-1.5">
              {plan.order
                .filter((s) => s.later)
                .map((s) => (
                  <li key={s.tools[0].tool_key} className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">{s.tools[0].input}</span>
                    {s.tools[0].bucket !== 'out_of_box' && <BucketBadge bucket={s.tools[0].bucket} />}
                    <span>{s.unlocks}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Section>

      <Section n={3} title="Access checklist" aside={<span className="text-xs text-slate-500">Ready to paste into an email</span>}>
        <div className="divide-y divide-slate-100">
          {plan.access.map((a) => (
            <div key={a.tool} className="grid gap-3 py-3 first:pt-0 md:grid-cols-[13rem_1fr]">
              <div>
                <div className="font-semibold text-slate-900">{a.input}</div>
                {a.input !== a.tool && <div className="text-xs text-slate-500">{a.tool}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  <BucketBadge bucket={a.bucket} />
                  {plan.scope && !plan.scope.needed.includes(a.tool) && <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">Not needed for this goal</span>}
                </div>
                <div className="mt-2 text-xs text-slate-500">Customer owner</div>
                <div className="text-sm text-slate-800">{a.owner}</div>
              </div>
              <div className="space-y-3">
                {a.rows.map((r) => (
                  <div key={r.item}>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{r.label}</div>
                    <RowBody row={r} labels={labels} onCite={onCite} evidence={evidence} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{plan.document.oob_access_note}</p>
      </Section>

      {plan.custom_sheets.map((s) => (
        <Section key={s.tool} n={4} title={`Custom work scoping sheet: ${s.tool}`} aside={<BucketBadge bucket="custom_work" />}>
          <p className="mb-3 text-sm text-amber-900">
            {s.tool} is not on SAFE's public list. <strong>Confirm</strong> with SAFE whether a connector exists before building one.
          </p>
          <div className="divide-y divide-slate-100">
            {s.rows.map((r) => (
              <div key={r.item} className="grid gap-2 py-2.5 md:grid-cols-[11rem_1fr]">
                <div className="text-sm font-medium text-slate-900">{r.label}</div>
                <RowBody row={r} labels={labels} onCite={onCite} evidence={evidence} />
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Section n={4 + customN} title="Data checks before the data is used">
        <ul className="space-y-1.5 text-sm text-slate-700">
          {plan.data_checks.map((d) => (
            <li key={d.key}>
              <strong className="text-slate-900">{d.label}:</strong> {d.text}
            </li>
          ))}
        </ul>
        {plan.data_notes.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">From the vendor docs</div>
            {plan.data_notes.map((r) => (
              <div key={`${r.tool}-${r.item}`} className="text-sm">
                <span className="font-medium text-slate-900">{r.tool}: </span>
                <Rich text={r.text} />
                <Cites row={r} labels={labels} onCite={onCite} evidence={evidence} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section n={5 + customN} title={`Open questions for ${plan.customer.name}`}>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
          {plan.questions.map((q) => (
            <li key={q.key}>{q.text}</li>
          ))}
        </ol>
      </Section>

      <p className="px-1 text-xs text-slate-500">{plan.document.footer}</p>
    </div>
  )
}
