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
      const need = a.rows.map((r) => `${r.label}: ${rowText(r)}`).join(' ')
      const src = a.rows.map((r) => citeText(r, labels)).filter(Boolean).join('; ') || (a.docs_label ? a.docs_label : 'None (no vendor docs on file)')
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
  b.push({ t: 'p', text: `Verification: ${v.facts_verified}/${v.facts_total} cited facts verified in code (${v.facts_corrected} with a corrected line number). ${v.rows_held_back} drafted item${v.rows_held_back === 1 ? '' : 's'} held back.` })

  b.push({ t: 'h2', text: 'Decisions needed from SAFE' })
  const needs = plan.coverage.filter((c) => c.bucket !== 'out_of_box')
  b.push({ t: 'list', items: needs.length ? needs.map((c) => `**${c.input}** (${BUCKET_LABEL[c.bucket]}): ${c.why}`) : ['None'] })

  b.push({ t: 'h2', text: 'Who owes what' })
  for (const a of buildActions(plan, data)) {
    b.push({ t: 'h3', text: `${a.owner}${a.tools.length ? ` (${a.tools.join(', ')})` : ''}` })
    b.push({ t: 'list', items: a.items.map((i) => `${i.kind}: ${i.text}`) })
  }

  b.push({ t: 'h2', text: 'Every Confirm item' })
  const confirms = [
    ...plan.access.flatMap((a) => a.rows.filter((r) => r.status === 'confirm').map((r) => `${a.tool} / ${r.label}: ${r.confirm_reason}`)),
    ...plan.custom_sheets.flatMap((s) => s.rows.filter((r) => r.status === 'confirm').map((r) => `${s.tool} sheet / ${r.label}: ${r.confirm_reason}`)),
  ]
  b.push({ t: 'list', items: confirms.length ? confirms : ['None'] })

  b.push({ t: 'h2', text: 'Held back by the verifier' })
  b.push(v.held.length ? { t: 'table', head: ['Item', 'What the draft said', 'Why it was held back'], rows: v.held.map((h) => [h.row, h.draft_text, h.reason]) } : { t: 'p', text: 'Nothing held back.' })

  b.push({ t: 'h2', text: 'Effort' })
  b.push({ t: 'note', text: `${plan.effort.label}.` })
  b.push({ t: 'table', head: ['Tool', 'Bucket', 'Effort'], rows: plan.effort.rows.map((r) => [r.tool, BUCKET_LABEL[r.bucket], r.value]) })

  if (data) {
    b.push({ t: 'h2', text: `Data readiness${data.synthetic ? ' (synthetic sample data)' : ''}` })
    b.push({ t: 'p', text: data.ready ? 'Data is ready to use.' : '**Data not ready yet.** Blocking items below.' })
    b.push({ t: 'table', head: ['Check', 'Status', 'Detail'], rows: data.checks.map((c) => [c.text, c.level === 'ok' ? 'OK' : c.level === 'block' ? 'BLOCKING' : 'Warning', c.detail]) })
    b.push({ t: 'p', text: `${data.totals.asset_records} asset records became ${data.totals.merged_assets} assets (${data.totals.cross_tool_merges} merged across tools, ${data.totals.same_tool_duplicates} duplicate${data.totals.same_tool_duplicates === 1 ? "" : "s"} inside one tool). ${data.totals.review} possible duplicate${data.totals.review === 1 ? '' : 's'} ${data.totals.review === 1 ? 'needs' : 'need'} a person.` })
    if (data.review.length) b.push({ t: 'table', head: ['Possible duplicate', 'Evidence', 'Confidence', 'Why it needs a person'], rows: data.review.map((r) => [`${r.a.label} / ${r.b.label}`, `${r.label} (${r.shared})`, r.confidence.toFixed(2), r.why]) })
    const overridden = data.assets.filter((x) => x.overrides.length)
    if (overridden.length) b.push({ t: 'note', text: `Merged by a person against the evidence: ${overridden.map((x) => `${x.names.join(' / ')} (${x.overrides.join('; ')})`).join('; ')}. Check these before the counts are used.` })
    const ph = data.mapping.filter((m) => m.status !== 'verified')
    b.push({ t: 'h3', text: 'Field mappings to confirm' })
    b.push({ t: 'list', items: ph.length ? ph.map((m) => `${m.source}.${m.from} -> ${m.canonical}: ${m.detail}`) : ['All mappings verified'] })
    if (data.settings.placeholders.length) b.push({ t: 'note', text: `Placeholder settings to agree with the customer: ${data.settings.placeholders.join('; ')}.` })
  }

  b.push({ t: 'h2', text: 'Config files in play (swap these for SAFE\'s internal versions)' })
  b.push({ t: 'list', items: ['config/integrations.json', 'config/aliases.json', 'config/matching.json', 'config/tool_profiles.json', 'config/connection_order.json', 'config/scoping_template.json', 'config/canonical_schema.json', 'config/source_mappings.json', 'config/match_rules.json', 'config/data_rules.json', 'config/effort_placeholders.json'] })
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
