import type { Plan, PlanRow } from '../../core/types'
import { BucketBadge, CiteChip, ConfirmTag, Pill, Rich, Section, shortLabel, type CiteTarget } from './ui'

interface Props {
  plan: Plan
  labels: Record<string, string>
  onCite: (c: CiteTarget) => void
  changed: Record<string, string>
}

function Cites({ row, labels, onCite }: { row: PlanRow; labels: Record<string, string>; onCite: (c: CiteTarget) => void }) {
  if (!row.citations.length) return null
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

function RowBody({ row, labels, onCite }: { row: PlanRow; labels: Record<string, string>; onCite: (c: CiteTarget) => void }) {
  if (row.status === 'confirm') return <ConfirmTag reason={row.confirm_reason} />
  return (
    <div>
      <div className="text-sm leading-relaxed text-slate-700">
        <Rich text={row.text} />
      </div>
      <Cites row={row} labels={labels} onCite={onCite} />
    </div>
  )
}

export function PlanView({ plan, labels, onCite, changed }: Props) {
  const customN = plan.custom_sheets.length ? 1 : 0
  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="amber">Fictional customer</Pill>
          <Pill>{plan.document.status}</Pill>
        </div>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          {plan.document.title_prefix}: {plan.customer.name}
        </h1>
        <dl className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-[7rem_1fr]">
          <dt className="font-medium text-slate-500">Goal</dt>
          <dd>{plan.customer.goal}</dd>
          <dt className="font-medium text-slate-500">Integrations list</dt>
          <dd>{plan.config_label}</dd>
          <dt className="font-medium text-slate-500">Draft</dt>
          <dd>{plan.draft_note}</dd>
        </dl>
        <p className="mt-3 text-sm text-slate-500">Anything not found in the attached sources is marked Confirm. Every technical detail shown was checked by code against the vendor docs; click a source to see the exact line.</p>
      </header>

      <Section n={1} title="Coverage check" aside={<span className="text-xs text-slate-500">Matched in code against the integrations config</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Customer tool</th>
                <th className="py-2 pr-3 font-medium">Bucket</th>
                <th className="py-2 font-medium">Why</th>
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
                    {c.why}
                    {c.evidence.length > 0 && (
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

      <Section n={2} title="Connection order" aside={<span className="text-xs text-slate-500">Order from config/connection_order.json; wording drafted by the model</span>}>
        <ol className="space-y-2.5">
          {plan.order.map((s) => (
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
      </Section>

      <Section n={3} title="Access checklist" aside={<span className="text-xs text-slate-500">Ready to paste into an email</span>}>
        <div className="divide-y divide-slate-100">
          {plan.access.map((a) => (
            <div key={a.tool} className="grid gap-3 py-3 first:pt-0 md:grid-cols-[13rem_1fr]">
              <div>
                <div className="font-semibold text-slate-900">{a.input}</div>
                {a.input !== a.tool && <div className="text-xs text-slate-500">{a.tool}</div>}
                <div className="mt-1">
                  <BucketBadge bucket={a.bucket} />
                </div>
                <div className="mt-2 text-xs text-slate-500">Customer owner</div>
                <div className="text-sm text-slate-800">{a.owner}</div>
              </div>
              <div className="space-y-3">
                {a.rows.map((r) => (
                  <div key={r.item}>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{r.label}</div>
                    <RowBody row={r} labels={labels} onCite={onCite} />
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
                <RowBody row={r} labels={labels} onCite={onCite} />
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Section n={4 + customN} title="Data checks before anything feeds a risk number">
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
                <Cites row={r} labels={labels} onCite={onCite} />
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
