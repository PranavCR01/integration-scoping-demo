import type { Plan } from '../../core/types'
import type { Block } from '../../core/doc'
import { CiteChip, Pill, Rich, Section, Stat, shortLabel, type CiteTarget } from './ui'

export function VerificationView({ plan, labels, onCite }: { plan: Plan; labels: Record<string, string>; onCite: (c: CiteTarget) => void }) {
  const v = plan.verification
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Cited facts in the draft" value={v.facts_total} />
        <Stat label="Verified by code" value={`${v.facts_verified}/${v.facts_total}`} tone="emerald" />
        <Stat label="Line number corrected" value={v.facts_corrected} />
        <Stat label="Drafted items held back" value={v.rows_held_back} tone={v.rows_held_back ? 'amber' : 'emerald'} />
      </div>
      <Section title="How this works">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Code matches tools, sets the order, and decides which items exist and which are Confirm.</li>
          <li>The model ({plan.model ?? 'none'}) drafts wording and attaches a fact for every technical detail: endpoint, parameter, field, scope, header, number.</li>
          <li>Code checks every fact against the indexed spec or the exact line of the doc, and every code-like word in the wording against those facts.</li>
          <li>If anything in an item fails, the whole item is held back and shown as Confirm. Nothing is fixed up by the model.</li>
        </ol>
      </Section>
      <Section title="Held back">
        {v.held.length === 0 ? (
          <p className="text-sm text-emerald-800">Nothing held back in this draft. The test suite plants 18 kinds of errors to prove the checks fire (see docs/EVAL.md).</p>
        ) : (
          <div className="space-y-2">
            {v.held.map((h) => (
              <div key={h.row} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
                <div className="font-mono text-xs text-slate-500">{h.row}</div>
                <div className="mt-1 text-slate-500 line-through">
                  <Rich text={h.draft_text} />
                </div>
                <div className="mt-1 text-amber-900">{/[.!?]$/.test(h.reason) ? h.reason : `${h.reason}.`}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Every fact checked">
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Kind</th>
                <th className="py-2 pr-3 font-medium">Value</th>
                <th className="py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {v.log.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">{l.row}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{l.fact.kind}</td>
                  <td className="py-1.5 pr-3">
                    <code>{l.fact.value}</code>
                  </td>
                  <td className="py-1.5">
                    {l.verified && l.file && l.line ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <CiteChip c={{ file: l.file, line: l.line, kind: l.fact.kind, value: l.fact.value, corrected_from: l.corrected_from }} label={shortLabel(l.file, labels)} onOpen={onCite} />
                        {l.corrected_from ? <Pill>line fixed</Pill> : null}
                      </div>
                    ) : (
                      <span className="text-xs text-rose-700">{l.detail}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

export function DocPreview({ blocks }: { blocks: Block[] }) {
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h1':
            return <h1 key={i} className="text-xl font-semibold text-slate-900">{b.text}</h1>
          case 'h2':
            return <h2 key={i} className="pt-2 text-base font-semibold text-teal-800">{b.text}</h2>
          case 'h3':
            return <h3 key={i} className="text-sm font-semibold text-slate-900">{b.text}</h3>
          case 'p':
            return <p key={i} className="text-sm text-slate-700"><Rich text={b.text} /></p>
          case 'note':
            return <p key={i} className="text-sm italic text-slate-500"><Rich text={b.text} /></p>
          case 'hr':
            return <hr key={i} className="border-slate-200" />
          case 'list': {
            const L = b.ordered ? 'ol' : 'ul'
            return (
              <L key={i} className={`${b.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5 text-sm text-slate-700`}>
                {b.items.map((it, j) => <li key={j}><Rich text={it} /></li>)}
              </L>
            )
          }
          case 'table':
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      {b.head.map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-slate-100 align-top">
                        {r.map((c, k) => <td key={k} className="py-1.5 pr-3 text-slate-700"><Rich text={c} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
    </article>
  )
}
