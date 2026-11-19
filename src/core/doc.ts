// Builds the customer-facing plan and the internal handoff as simple blocks, rendered to
// Markdown here and to PDF in the browser (src/client/pdf.ts). Same content either way.
import type { Plan, PlanRow } from './types.js'
import { BUCKET_LABEL } from './types.js'
import type { DataReport } from './data.js'
import { buildActions, buildSummary, customerDataAsks } from './summary.js'

export type Block =
  | { t: 'h1' | 'h2' | 'h3' | 'p' | 'note'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'list'; items: string[]; ordered?: boolean }
  | { t: 'hr' }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })

export function sourceLabel(file: string, labels: Record<string, string>) {
  return labels[file] ?? file.split('/').pop() ?? file
}

export function citeText(row: PlanRow, labels: Record<string, string>): string {
  if (!row.citations.length) return ''
  const byFile = new Map<string, number[]>()
  for (const c of row.citations) {
    if (!byFile.has(c.file)) byFile.set(c.file, [])
    if (!byFile.get(c.file)!.includes(c.line)) byFile.get(c.file)!.push(c.line)
  }
  return [...byFile.entries()]
    .map(([f, lines]) => `${sourceLabel(f, labels)}, line${lines.length > 1 ? 's' : ''} ${lines.sort((a, b) => a - b).join(', ')}`)
    .join('; ')
}

export const LATER_ACCESS = 'Not needed for this goal. Access details appear when the goal needs it.'

// What the access checklist shows for one tool: nothing per row for a tool the goal does not
// need, and one line instead of several when every row is Confirm for the same reason.
export function accessLines(plan: Plan, a: Plan['access'][number]): { later: boolean; lines: { label: string; row: PlanRow }[] } {
  if (plan.scope && !plan.scope.needed.includes(a.tool)) return { later: true, lines: [] }
  const same = a.rows.length > 1 && a.rows.every((r) => r.status === 'confirm' && r.confirm_reason === a.rows[0].confirm_reason)
  if (same) return { later: false, lines: [{ label: a.rows.map((r) => r.label).join(' and '), row: a.rows[0] }] }
  return { later: false, lines: a.rows.map((r) => ({ label: r.label, row: r })) }
}

const rowText = (r: PlanRow) => (r.status === 'verified' ? r.text : `**Confirm.** ${r.confirm_reason ?? ''}`.trim())

export function planBlocks(plan: Plan, labels: Record<string, string>, oobNote: string, footer: string, titlePrefix: string, status: string, data: DataReport | null = null): Block[] {
  const b: Block[] = []
  b.push({ t: 'h1', text: `${titlePrefix}: ${plan.customer.name} (FICTIONAL CUSTOMER)` })
  b.push({ t: 'p', text: `**Goal:** ${plan.customer.goal}` })
  b.push({ t: 'p', text: `**Plan built for:** ${plan.goal.label}` })
  b.push({ t: 'p', text: `**Prepared:** ${fmtDate(plan.generated_at)} · **Status:** ${status}` })
  b.push({ t: 'p', text: `**Sources:** ${plan.config_label}; vendor API docs listed under each tool. Anything not found in those sources is marked **Confirm**.` })
  b.push({ t: 'p', text: `**At a glance:** ${buildSummary(plan, data).headline}` })
  b.push({ t: 'hr' })

  b.push({ t: 'h2', text: '1. Coverage check' })
  b.push({ t: 'table', head: ['Customer tool', 'Bucket', 'Why'], rows: plan.coverage.map((c) => [c.input, BUCKET_LABEL[c.bucket], c.why]) })

  b.push({ t: 'h2', text: '2. Connection order (draft rules, editable)' })
  b.push({
    t: 'list',
    ordered: true,
    items: plan.order
      .filter((s) => !s.later)
      .map((s) => {
        const names = s.tools.map((t) => t.input).join(' and ')
        return `**${names}:** ${s.unlocks}${s.gate ? ` ${s.gate}` : ''}`
      }),
  })
  const later = plan.order.filter((s) => s.later)
  if (later.length) {
    b.push({ t: 'p', text: '**Not needed for this goal (connect later):**' })
    b.push({ t: 'list', items: later.map((s) => `${s.tools[0].input}: ${s.unlocks}`) })
  }
  b.push({ t: 'note', text: 'Ordering rules come from a config file, not the model. **Confirm** against SAFE\'s onboarding playbook.' })

  b.push({ t: 'h2', text: '3. Access checklist' })
  b.push({
    t: 'table',
    head: ['Tool', 'What we need', 'Customer owner', 'Source'],
    rows: plan.access.map((a) => {
      const al = accessLines(plan, a)
      const need = al.later ? LATER_ACCESS : al.lines.map((l) => `${l.label}: ${rowText(l.row)}`).join(' ')
      const src = al.later ? '' : a.rows.map((r) => citeText(r, labels)).filter(Boolean).join('; ') || (a.docs_label ? a.docs_label : 'None (no vendor docs on file)')
      return [a.input === a.tool ? a.tool : `${a.input} (${a.tool})`, need, a.owner, src]
    }),
  })
  if (plan.access.some((a) => a.bucket === 'out_of_box')) b.push({ t: 'note', text: oobNote })

  for (const s of plan.custom_sheets) {
    b.push({ t: 'h2', text: `4. Custom work scoping sheet: ${s.tool}` })
    b.push({ t: 'note', text: `${s.tool} is not on SAFE's public list. **Confirm** with SAFE whether a connector exists before building one.` })
    b.push({ t: 'table', head: ['Item', 'Detail', 'Source'], rows: s.rows.map((r) => [r.label, rowText(r), citeText(r, labels) || (r.status === 'confirm' ? 'None' : '')]) })
  }
  const n = plan.custom_sheets.length ? 5 : 4
  b.push({ t: 'h2', text: `${n}. Data checks before the data is used` })
  b.push({ t: 'list', items: [...plan.data_checks.map((d) => `**${d.label}:** ${d.text}`), ...plan.data_notes.map((r) => `**${r.tool}:** ${r.text} (${citeText(r, labels)})`)] })

  b.push({ t: 'h2', text: `${n + 1}. Open questions for ${plan.customer.name}` })
  b.push({ t: 'list', ordered: true, items: plan.questions.map((q) => q.text) })
  const asks = customerDataAsks(plan, data)
  if (asks.length) {
    b.push({ t: 'p', text: '**From the data checks on the sample exports:**' })
    b.push({ t: 'list', items: asks })
  }
  b.push({ t: 'hr' })
  b.push({ t: 'note', text: footer })
  return b
}

export function handoffBlocks(plan: Plan, data: DataReport | null, labels: Record<string, string>): Block[] {
  const v = plan.verification
  const b: Block[] = []
  b.push({ t: 'h1', text: `Internal handoff: ${plan.customer.name} (FICTIONAL)` })
  b.push({ t: 'p', text: `Prepared ${fmtDate(plan.generated_at)}. Integrations config: ${plan.config_label}. Draft: ${plan.draft_note}` })
  b.push({ t: 'p', text: `Verification: ${v.facts_verified}/${v.facts_total} cited facts verified in code${v.facts_corrected ? ` (${v.facts_corrected} with a corrected line number)` : ''}. ${v.rows_held_back} drafted item${v.rows_held_back === 1 ? '' : 's'} held back.` })

  b.push({ t: 'h2', text: 'Who owes what' })
  for (const a of buildActions(plan, data)) {
    b.push({ t: 'h3', text: `${a.owner}${a.tools.length ? ` (${a.tools.join(', ')})` : ''}` })
    b.push({ t: 'list', items: a.items.map((i) => `${i.kind}: ${i.short ?? i.text}`) })
  }
  b.push({ t: 'note', text: 'Access lines are short here. The full verified wording is in the customer plan, section 3, and in each email.' })

  b.push({ t: 'h2', text: 'Every Confirm item' })
  // One line per tool and reason, with who can settle it, so nothing open lacks an owner.
  const open = new Map<string, { tool: string; items: string[]; why: string; who: string }>()
  // Coverage decisions are open items too, though no plan row holds them.
  for (const c of plan.coverage) {
    if (c.bucket === 'custom_work') open.set(`${c.input}|coverage`, { tool: c.input, items: ['Whether a connector exists'], why: c.why.replace(/\.$/, ''), who: 'SAFE' })
    if (c.bucket === 'confirm_with_safe') open.set(`${c.input}|coverage`, { tool: c.input, items: ['Which product this is'], why: c.why.replace(/\.$/, ''), who: 'Customer (which product), then SAFE' })
  }
  const addOpen = (tool: string, item: string, r: PlanRow, custom: boolean) => {
    const why = r.confirm_reason ?? ''
    const k = `${tool}|${why}`
    if (!open.has(k)) open.set(k, { tool, items: [], why: why.replace(/\.$/, ''), who: resolverFor(r, custom) })
    open.get(k)!.items.push(item)
  }
  for (const a of plan.access) for (const r of a.rows) if (r.status === 'confirm') addOpen(a.input, r.label, r, a.bucket === 'custom_work')
  for (const sh of plan.custom_sheets) for (const r of sh.rows) if (r.status === 'confirm') addOpen(sh.tool, `Scoping sheet: ${r.label}`, r, true)
  b.push(open.size ? { t: 'table', head: ['Tool', "What's open", 'Why', 'Who resolves it'], rows: [...open.values()].map((o) => [o.tool, o.items.join(', '), o.why, o.who]) } : { t: 'p', text: 'None.' })

  b.push({ t: 'h2', text: 'Held back by the verifier' })
  b.push(v.held.length ? { t: 'table', head: ['Item', 'What the draft said', 'Why it was held back'], rows: v.held.map((h) => [h.row, h.draft_text, h.reason]) } : { t: 'p', text: 'Nothing held back.' })

  if (data) {
    b.push({ t: 'h2', text: `Data readiness${data.synthetic ? ' (synthetic sample data)' : ''}` })
    b.push({ t: 'p', text: data.ready ? 'Data is ready to use.' : '**Data not ready yet.** Blocking items below.' })
    b.push({ t: 'table', head: ['Check', 'Status', 'Detail'], rows: data.checks.map((c) => [c.text, c.level === 'ok' ? 'OK' : c.level === 'block' ? 'BLOCKING' : 'Warning', c.detail]) })
    b.push({ t: 'p', text: `${data.totals.asset_records} asset records became ${data.totals.merged_assets} assets (${data.totals.cross_tool_merges} merged across tools, ${data.totals.same_tool_duplicates} duplicate${data.totals.same_tool_duplicates === 1 ? "" : "s"} inside one tool). ${data.totals.review} possible duplicate${data.totals.review === 1 ? '' : 's'} ${data.totals.review === 1 ? 'needs' : 'need'} a person.` })
    if (data.review.length) b.push({ t: 'table', head: ['Possible duplicate', 'Evidence', 'Why it needs a person'], rows: data.review.map((r) => [`${r.a.label} / ${r.b.label}`, `${r.label} (${r.shared})`, r.why]) })
    const overridden = data.assets.filter((x) => x.overrides.length)
    if (overridden.length) b.push({ t: 'note', text: `Merged by a person against the evidence: ${overridden.map((x) => `${x.names.join(' / ')} (${x.overrides.join('; ')})`).join('; ')}. Check these before the counts are used.` })
    const ph = data.mapping.filter((m) => m.status !== 'verified')
    const srcLabel = (k: string) => data.sources.find((x) => x.key === k)?.label ?? k
    b.push({ t: 'h3', text: 'Field mappings to confirm' })
    if (!ph.length) b.push({ t: 'p', text: 'All mappings verified.' })
    else {
      // One line per source; the full field-by-field table is on the Data readiness tab.
      const bySrc = new Map<string, string[]>()
      for (const m of ph) bySrc.set(m.source, [...(bySrc.get(m.source) ?? []), m.from])
      b.push({ t: 'note', text: ph.every((m) => m.status === 'placeholder') ? 'Placeholder field names: the attached docs do not document these export fields. Confirm each one before the data is used.' : 'Each field needs confirming before the data is used.' })
      b.push({ t: 'list', items: [...bySrc.entries()].map(([src, fields]) => `${srcLabel(src)}: ${fields.map((f) => `\`${f}\``).join(', ')}`) })
    }
    if (data.settings.placeholders.length) b.push({ t: 'note', text: `Placeholder settings to agree with the customer: ${data.settings.placeholders.join('; ')}.` })
  }

  b.push({ t: 'h2', text: 'Config files in play (swap these for SAFE\'s internal versions)' })
  b.push({
    t: 'table',
    head: ['Config file', "SAFE's version needed on day one"],
    rows: [
      ['config/integrations.json', "SAFE's full connector list, including connectors not on the public website"],
      ['config/aliases.json', 'The names customers actually use for each tool, from past onboardings'],
      ['config/matching.json', "SAFE's rules for vague names, such as a bare vendor name that covers several products"],
      ['config/tool_profiles.json', "Each tool's role, who usually owns it on the customer side, and SAFE's connector docs to check against instead of vendor docs"],
      ['config/connection_order.json', "SAFE's onboarding playbook: what to connect first for each kind of customer goal"],
      ['config/scoping_template.json', "SAFE's scoping template: plan sections, what to find out per tool, and standard kickoff questions"],
      ['config/canonical_schema.json', "SAFE's data model for assets and findings"],
      ['config/source_mappings.json', "SAFE's field mappings from each tool's export into that data model"],
      ['config/match_rules.json', "SAFE's rules for deciding two records are the same machine"],
      ['config/data_rules.json', "SAFE's standard thresholds: stale window, scan window, coverage target, and what blocks the data"],
      ['config/effort_placeholders.json', "SAFE's typical effort per integration type, if it tracks one"],
    ],
  })
  void labels
  return b
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function toMarkdown(blocks: Block[]): string {
  const out: string[] = []
  for (const b of blocks) {
    switch (b.t) {
      case 'h1': out.push(`# ${b.text}`); break
      case 'h2': out.push(`## ${b.text}`); break
      case 'h3': out.push(`### ${b.text}`); break
      case 'p': out.push(b.text); break
      case 'note': out.push(`*${b.text.replace(/\*\*/g, '')}*`); break
      case 'hr': out.push('---'); break
      case 'list': out.push(b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${it}`).join('\n')); break
      case 'table':
        out.push([`| ${b.head.map(esc).join(' | ')} |`, `|${b.head.map(() => '---').join('|')}|`, ...b.rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n'))
        break
    }
  }
  return out.join('\n\n') + '\n'
}

// Who can settle a Confirm item, from the reason code wrote for it.
function resolverFor(r: PlanRow, custom: boolean): string {
  const why = r.confirm_reason ?? ''
  if (r.held_back || why.startsWith('Not drafted yet')) return 'Us (a new model draft, checked again)'
  if (why.startsWith('Waiting on the exact product')) return 'Customer (which product), then SAFE'
  const input = why.match(/^Needs input from the (.+?)\.?$/)
  if (input) return input[1].replace(/^./, (c) => c.toUpperCase())
  return custom ? 'SAFE (whether a connector exists, and what it needs)' : "SAFE (what its connector needs)"
}
