// The at-a-glance summary and the "who owes what" view. Both are counted and assembled by
// code from the verified plan (and the data report, if it has been run). Emails contain only
// verified rows and code-written or verified questions; nothing here is new model output.
import type { Plan, PlanRow } from './types.js'
import type { DataReport } from './data.js'

export interface Summary {
  tools_total: number // tools this goal needs
  ready_now: number
  later_total: number // tools the customer runs that this goal does not need
  safe_items: number // every line in the list that SAFE has to confirm
  customer_questions: number
  people_to_contact: number
  data: { status: 'not_run' | 'ready' | 'blocked'; blockers: number; warnings: number }
  headline: string
  blockers: { who: 'SAFE' | 'Customer' | 'Us'; text: string }[]
}

export type Party = 'customer' | 'safe' | 'us'

export interface ActionItem {
  kind: 'access' | 'question' | 'decision' | 'data'
  text: string
  tool: string | null
}

export interface OwnerActions {
  owner: string
  party: Party
  tools: string[]
  items: ActionItem[]
  email: { subject: string; body: string } | null
}

// A tool is in scope when the goal needs its role. Out-of-scope tools are listed in the plan
// but left out of the counts, the requests and the blockers.
const inScope = (plan: Plan, toolKey: string | null) => !toolKey || !plan.scope || plan.scope.needed.includes(toolKey)

const plain = (s: string) => s.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function buildSummary(plan: Plan, data: DataReport | null): Summary {
  const needed = plan.coverage.filter((c) => inScope(plan, c.tool_key))
  const ready = needed.filter((c) => c.bucket === 'out_of_box').length
  const later = plan.coverage.length - needed.length
  const decisions = needed.filter((c) => c.bucket !== 'out_of_box')
  const actions = buildActions(plan, data)
  const customerOwners = actions.filter((a) => a.party === 'customer')
  const customerQuestions = customerOwners.reduce((n, a) => n + a.items.filter((i) => i.kind === 'question' || i.kind === 'data').length, 0)
  const dataBlocks = data ? data.checks.filter((c) => c.level === 'block') : []
  const dataWarns = data ? data.checks.filter((c) => c.level === 'warn') : []
  const dataStatus: Summary['data']['status'] = !data ? 'not_run' : data.ready ? 'ready' : 'blocked'

  const blockers: Summary['blockers'] = []
  for (const c of decisions) {
    blockers.push({
      who: 'SAFE',
      text: c.bucket === 'confirm_with_safe' ? `${c.input}: confirm which of the listed products this is` : `${c.input}: confirm whether a connector exists`,
    })
  }
  const noDocs = plan.access.filter((a) => inScope(plan, a.tool) && a.bucket === 'out_of_box' && a.rows.every((r) => r.status === 'confirm'))
  // One line per tool, so the number on the tile matches the lines in the list.
  for (const a of noDocs) blockers.push({ who: 'SAFE', text: `${a.input}: confirm the access SAFE's connector needs (no vendor docs on file here)` })
  const safeItems = blockers.filter((b) => b.who === 'SAFE').length
  for (const c of dataBlocks) {
    if (c.check === 'counts' && data) {
      for (const x of data.sources.filter((y) => y.mismatch && y.in_scope !== false)) blockers.push({ who: 'Customer', text: `Data: ${x.short} console shows ${x.console} ${x.entity}s, our export returned ${x.records}` })
    } else blockers.push({ who: 'Us', text: `Data: ${c.detail}` })
  }

  const parts = [
    safeItems ? plural(safeItems, 'item') + ' for SAFE to confirm' : '',
    customerQuestions ? plural(customerQuestions, 'answer') + ` from ${plan.customer.name}` : '',
    dataStatus === 'blocked' ? plural(dataBlocks.length, 'data issue') + ' to clear' : dataStatus === 'not_run' ? 'the data checks to run' : '',
  ].filter(Boolean)
  const headline =
    (later
      ? `${ready} of ${plural(needed.length, 'tool')} this goal needs can be connected now; ${plural(later, 'other tool')} can wait.`
      : `${ready} of ${plural(plan.coverage.length, 'tool')} can be connected now.`) +
    (parts.length ? ` Before ${plan.goal.outcome}: ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]}.` : ` Nothing stands between ${plan.customer.name} and ${plan.goal.short}.`)

  return {
    tools_total: needed.length,
    ready_now: ready,
    later_total: later,
    safe_items: safeItems,
    customer_questions: customerQuestions,
    people_to_contact: customerOwners.length,
    data: { status: dataStatus, blockers: dataBlocks.length, warnings: dataWarns.length },
    headline,
    blockers,
  }
}

function rowLine(r: PlanRow): string {
  return `${r.label}: ${plain(r.text)}`
}

export function buildActions(plan: Plan, data: DataReport | null): OwnerActions[] {
  const groups = new Map<string, OwnerActions>()
  const get = (owner: string, party: Party) => {
    const k = `${party}|${owner}`
    if (!groups.has(k)) groups.set(k, { owner, party, tools: [], items: [], email: null })
    return groups.get(k)!
  }
  const ownerOf = (tool: string | null) => (tool ? plan.access.find((a) => a.tool === tool)?.owner : null) ?? plan.project_owner
  const inputOf = (tool: string | null) => (tool ? plan.access.find((a) => a.tool === tool)?.input ?? tool : null)

  // Customer side: one group per tool owner, with the verified access details for their tool.
  for (const a of plan.access) {
    if (!inScope(plan, a.tool)) continue // not needed for this goal: no request yet
    const g = get(a.owner, 'customer')
    if (!g.tools.includes(a.input)) g.tools.push(a.input)
    const verified = a.rows.filter((r) => r.status === 'verified')
    if (a.bucket === 'confirm_with_safe') continue // nothing to request until the product is known
    if (verified.length) for (const r of verified) g.items.push({ kind: 'access', text: rowLine(r), tool: a.input })
    else g.items.push({ kind: 'access', text: `We will confirm the exact access ${a.input} needs and follow up. Please confirm you are the right person to set it up.`, tool: a.input })
  }
  for (const q of plan.questions) {
    if (!inScope(plan, q.tool)) continue
    const g = get(ownerOf(q.tool), 'customer')
    const name = inputOf(q.tool)
    if (name && !g.tools.includes(name)) g.tools.push(name)
    g.items.push({ kind: 'question', text: plain(q.text), tool: name })
  }

  // SAFE side: coverage decisions and access that only SAFE's connector docs can settle.
  const safe = get('SAFE platform team', 'safe')
  for (const c of plan.coverage) {
    if (!inScope(plan, c.tool_key)) continue
    if (c.bucket === 'confirm_with_safe') safe.items.push({ kind: 'decision', text: `${c.input}: which listed product does the connector cover? Candidates: ${c.candidates.join(', ')}.`, tool: c.input })
    if (c.bucket === 'custom_work') safe.items.push({ kind: 'decision', text: `${c.input}: is there a connector beyond the public list? If not, review the custom scoping sheet.`, tool: c.input })
  }
  for (const a of plan.access) {
    if (inScope(plan, a.tool) && a.bucket === 'out_of_box' && a.rows.every((r) => r.status === 'confirm')) safe.items.push({ kind: 'decision', text: `${a.input}: what access does SAFE's connector need? No vendor docs on file here.`, tool: a.input })
  }
  if (plan.access.some((a) => inScope(plan, a.tool) && a.bucket === 'out_of_box' && a.rows.some((r) => r.status === 'verified'))) {
    safe.items.push({ kind: 'decision', text: 'For connectors with vendor docs on file: confirm the exact scopes and roles SAFE\'s connector needs (the plan lists what each vendor documents).', tool: null })
  }

  // Data checks: count mismatches go to the tool owner; the rest is work on our side.
  if (data) {
    const us = get('Forward deployed engineer (us)', 'us')
    for (const s of data.sources.filter((x) => x.mismatch && x.in_scope !== false)) {
      const access = plan.access.find((a) => a.tool === s.tool)
      const g = get(access?.owner ?? plan.project_owner, 'customer')
      g.items.push({ kind: 'data', text: `Your ${access?.input ?? s.tool} console shows ${s.console} ${s.entity}s, but our export returned ${s.records}. Can you help us find which ones are missing?`, tool: access?.input ?? s.tool })
    }
    if (data.stale.length) {
      get(plan.project_owner, 'customer').items.push({ kind: 'data', text: `${plural(data.stale.length, 'asset')} not seen in over ${data.settings.stale_after_days} days (${data.stale.map((s) => s.hostname).join(', ')}): keep, exclude, or investigate?`, tool: null })
    }
    for (const r of data.review) us.items.push({ kind: 'data', text: `Decide whether ${r.a.label} and ${r.b.label} are the same machine. Evidence: ${r.label.replace(/\s*\(.*\)$/, '').replace(/^./, (ch) => ch.toLowerCase())}.`, tool: null })
    if (data.orphans.length) us.items.push({ kind: 'data', text: `Trace ${plural(data.orphans.length, 'finding')} that point to assets no export contains (${data.orphans.map((o) => o.asset_ref).join(', ')}).`, tool: null })
    if (data.coverage.no_edr.length) us.items.push({ kind: 'data', text: `Raise the ${plural(data.coverage.no_edr.length, 'asset')} with no endpoint agent with the customer: ${data.coverage.no_edr.map((a) => a.hostname).join(', ')}.`, tool: null })
    if (!us.items.length) groups.delete('us|Forward deployed engineer (us)')
  }

  const out = [...groups.values()].filter((g) => g.items.length)
  for (const g of out) if (g.party === 'customer') g.email = buildEmail(plan, g)
  const rank: Record<Party, number> = { customer: 0, safe: 1, us: 2 }
  return out.sort((a, b) => rank[a.party] - rank[b.party] || (a.owner === plan.project_owner ? 1 : 0) - (b.owner === plan.project_owner ? 1 : 0))
}

function buildEmail(plan: Plan, g: OwnerActions): { subject: string; body: string } {
  const tools = g.tools.length ? g.tools.join(' and ') : 'the SAFE rollout'
  const access = g.items.filter((i) => i.kind === 'access')
  const asks = g.items.filter((i) => i.kind !== 'access')
  const lines: string[] = [`Hi,`, '']
  if (access.length) {
    lines.push(`As part of connecting ${tools} to SAFE, here is what we need from you:`, '')
    for (const i of access) lines.push(`- ${i.text}`)
    lines.push('')
  } else {
    lines.push(`As part of the SAFE rollout${g.tools.length ? ` (${tools})` : ''}, we have a few questions for you:`, '')
  }
  if (asks.length) {
    if (access.length) lines.push('A few questions:', '')
    for (const i of asks) lines.push(`- ${i.text}`)
    lines.push('')
  }
  if (access.some((i) => !i.text.startsWith('We will confirm'))) {
    lines.push('These details come from the vendor\'s public API documentation. We will confirm the exact access SAFE\'s connector needs before you set anything up.', '')
  }
  lines.push('Thanks,', '[Your name]')
  return { subject: `${plan.customer.name} and SAFE: ${access.length ? `access for ${tools}` : 'a few questions'}`, body: lines.join('\n') }
}

