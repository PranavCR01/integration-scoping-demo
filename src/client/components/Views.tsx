import { useState } from 'react'
import type { Plan } from '../../core/types'
import type { Block } from '../../core/doc'
import { CiteChip, Pill, Rich, Section, Stat, shortLabel, type CiteTarget } from './ui'

export function VerificationView({ plan, labels, onCite }: { plan: Plan; labels: Record<string, string>; onCite: (c: CiteTarget) => void }) {
  const v = plan.verification
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Cited facts in the draft" value={v.facts_total} />
        <Stat label="Verified by code" value={`${v.facts_verified}/${v.facts_total}`} tone="emerald" />
        <Stat label="Drafted items held back" value={v.rows_held_back} tone={v.rows_held_back ? 'amber' : 'emerald'} />
      </div>
      <Section title="How this works">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Code matches tools, sets the order, and decides which items exist and which are Confirm.</li>
          <li>The model ({plan.model ?? 'none'}) drafts wording and attaches a fact for every technical detail: endpoint, parameter, field, scope, header, number.</li>
          <li>Code checks every fact against the indexed spec or the exact line of the doc, and every code-like word in the wording against those facts. A real quote cited to the wrong line has its line number corrected, but only if the quote appears once in the file{v.facts_corrected ? ` (${v.facts_corrected} corrected in this draft)` : ''}.</li>
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
                <div className="mt-1 text-amber-900">{sentence(h.reason)}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Every fact checked" aside={<span className="text-xs text-slate-500">Click a tool, then an item, then a source</span>}>
        <FactTree plan={plan} labels={labels} onCite={onCite} />
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

// Reasons are built without a closing full stop; add one for display.
const sentence = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`)

// Every checked fact, grouped tool > item > fact. Collapsed by default; tools with a
// held-back item start open so it is one click away.
type Log = Plan['verification']['log'][number]
interface ItemGroup { row: string; label: string; facts: Log[]; held: boolean }
interface ToolGroup { tool: string; name: string; items: ItemGroup[] }

function groupFacts(plan: Plan): ToolGroup[] {
  const nameOf = (tool: string) => plan.access.find((a) => a.tool === tool)?.input ?? tool
  const labelOf = (row: string): { tool: string; label: string } => {
    const [section, a, ...rest] = row.split('/')
    if (section === 'question') {
      const q = plan.questions.find((x) => x.key === a)
      return { tool: q?.tool ?? 'Questions', label: `Open question: ${(q?.text ?? a).slice(0, 70)}${(q?.text?.length ?? 0) > 70 ? '...' : ''}` }
    }
    const item = rest.join('/')
    const pr = [...plan.access.flatMap((x) => x.rows), ...plan.custom_sheets.flatMap((x) => x.rows), ...plan.data_notes].find((r) => r.section === section && r.tool === a && r.item === item)
    const where = section === 'custom_sheet' ? 'Scoping sheet: ' : section === 'data_note' ? 'Data note: ' : ''
    return { tool: a, label: `${where}${pr?.label ?? item}` }
  }
  const held = new Set(plan.verification.held.map((h) => h.row))
  const tools = new Map<string, ToolGroup>()
  for (const l of plan.verification.log) {
    const { tool, label } = labelOf(l.row)
    if (!tools.has(tool)) tools.set(tool, { tool, name: tool === 'Questions' ? 'Questions' : nameOf(tool), items: [] })
    const t = tools.get(tool)!
    let it = t.items.find((x) => x.row === l.row)
    if (!it) t.items.push((it = { row: l.row, label, facts: [], held: held.has(l.row) }))
    it.facts.push(l)
  }
  return [...tools.values()]
}

function FactTree({ plan, labels, onCite }: { plan: Plan; labels: Record<string, string>; onCite: (c: CiteTarget) => void }) {
  const groups = groupFacts(plan)
  const [openTools, setOpenTools] = useState<Set<string>>(() => new Set(groups.filter((g) => g.items.some((i) => i.held)).map((g) => g.tool)))
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const flip = (set: Set<string>, k: string, put: (s: Set<string>) => void) => {
    const n = new Set(set)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    put(n)
  }
  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {groups.map((g) => {
        const facts = g.items.flatMap((i) => i.facts)
        const ok = facts.filter((f) => f.verified).length
        const heldN = g.items.filter((i) => i.held).length
        const open = openTools.has(g.tool)
        return (
          <div key={g.tool}>
            <button onClick={() => flip(openTools, g.tool, setOpenTools)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50">
              <span className="w-3 text-slate-400">{open ? '▾' : '▸'}</span>
              <span className="font-semibold text-slate-900">{g.name}</span>
              <span className="text-slate-600">
                {ok} of {facts.length} facts verified{heldN ? `, ${heldN} item${heldN === 1 ? '' : 's'} held back` : ''}
              </span>
            </button>
            {open && (
              <div className="space-y-1 pb-2 pl-8 pr-3">
                {g.items.map((it) => {
                  const iOk = it.facts.filter((f) => f.verified).length
                  const iOpen = openItems.has(it.row)
                  return (
                    <div key={it.row}>
                      <button onClick={() => flip(openItems, it.row, setOpenItems)} className="flex w-full items-center gap-2 py-1 text-left text-sm hover:text-slate-900">
                        <span className="w-3 text-slate-400">{iOpen ? '▾' : '▸'}</span>
                        <span className="text-slate-800">{it.label}</span>
                        <span className="text-xs text-slate-500">
                          {it.facts.length} fact{it.facts.length === 1 ? '' : 's'}
                          {iOk === it.facts.length ? ', verified' : `, ${iOk} verified`}
                        </span>
                        {it.held && <Pill tone="amber">held back</Pill>}
                      </button>
                      {iOpen && (
                        <table className="mb-2 ml-5 w-[calc(100%-1.25rem)] text-sm">
                          <tbody>
                            {it.facts.map((l, k) => (
                              <tr key={k} className="border-b border-slate-100 align-top">
                                <td className="py-1.5 pr-3">
                                  <code>{l.fact.value}</code>
                                </td>
                                <td className="py-1.5 pr-3 text-slate-600">{l.fact.kind}</td>
                                <td className="py-1.5">
                                  {l.verified && l.file && l.line ? (
                                    <div className="flex flex-wrap items-center gap-1">
                                      <CiteChip c={{ file: l.file, line: l.line, kind: l.fact.kind, value: l.fact.value, corrected_from: l.corrected_from }} label={shortLabel(l.file, labels)} onOpen={onCite} />
                                      {l.corrected_from ? <Pill>line fixed</Pill> : null}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-rose-700">{sentence(l.detail)}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
