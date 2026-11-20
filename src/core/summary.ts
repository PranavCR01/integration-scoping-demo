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
  text: string // full text, used in emails
  short?: string // one line for cards: the item label plus its verified values, built by code
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
export const inScope = (plan: Plan, toolKey: string | null) => !toolKey || !plan.scope || plan.scope.needed.includes(toolKey)

// The questions this goal asks: a question about a tool the goal does not need waits, like
// that tool's access request. Every view (plan, PDF, cards, counts) uses this one list.
export const goalQuestions = (plan: Plan) => plan.questions.filter((q) => inScope(plan, q.tool))

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

  // Each open item is counted once. A blocking data issue the customer is already asked about
  // (a count mismatch) is one of their answers, so only the data issues left for us to fix are
  // added on top. The parts are named so the total adds up from what is on screen.
  const ourDataFixes = blockers.filter((b) => b.who === 'Us').length
  const parts = [
    safeItems ? `${safeItems} for SAFE` : '',
    customerQuestions ? `${plural(customerQuestions, 'answer')} from ${plan.customer.name.split(' ')[0]}` : '',
    ourDataFixes ? `${plural(ourDataFixes, 'data fix', 'data fixes')} on our side` : '',
  ].filter(Boolean)
  const toClear = safeItems + customerQuestions + ourDataFixes
  const readyLine = later
    ? `${plural(ready, 'tool')} ready to connect (${later} more can wait).`
    : `${plural(ready, 'tool')} ready to connect.`
  const headline =
    `${readyLine} ` +
    (toClear ? `${plural(toClear, 'item')} to clear before ${plan.goal.outcome}: ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]}.` : `Nothing stands between ${plan.customer.name} and ${plan.goal.short}.`) +
    (dataStatus === 'not_run' ? ' The data checks have not run yet.' : '')

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

// A card line made only from values code verified, so no new technical wording is written.
// It keeps the 2 most useful values (auth schemes and headers first, then scopes and roles,
// then URLs; quoted doc sentences never) and says how many more the email has.
const CARD_VALUES = 2
const KIND_RANK: Partial<Record<string, number>> = { auth: 0, scope: 1, permission: 1, base_url: 2 }
function rowShort(r: PlanRow): string {
  const ranked = r.citations
    .filter((c) => c.kind !== 'doc')
    .map((c, i) => ({ v: c.value, rank: KIND_RANK[c.kind] ?? 3, i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
  const values = [...new Set(ranked.map((x) => x.v))]
  if (!values.length) return r.label
  const more = values.length - CARD_VALUES
  return `${r.label}: ${values.slice(0, CARD_VALUES).join(', ')}${more > 0 ? ` (+${more} more in the email)` : ''}`
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
    // A tool with nothing verified to ask for gets no request: its access stays a SAFE
    // decision, and the project lead's owners question already asks who runs it.
    for (const r of verified) g.items.push({ kind: 'access', text: rowLine(r), short: rowShort(r), tool: a.input })
  }
  for (const q of goalQuestions(plan)) {
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
    // Like the count mismatch: only ask about stale machines from tools this goal needs.
    const inScopeSrc = new Set(data.sources.filter((x) => x.in_scope !== false).map((x) => x.key))
    const stale = data.stale.filter((s) => s.sources.some((src) => inScopeSrc.has(src)))
    if (stale.length) {
      get(plan.project_owner, 'customer').items.push({ kind: 'data', text: `${plural(stale.length, 'asset')} not seen in over ${data.settings.stale_after_days} days (${stale.map((s) => s.hostname).join(', ')}): keep, exclude, or investigate?`, tool: null })
    }
    if (data.review.length) us.items.push({ kind: 'data', text: `Review ${plural(data.review.length, 'possible duplicate')} on the Data readiness tab (${data.review.map((r) => r.a.label.replace(/ \(.*\)$/, '')).filter((x, i, xs) => xs.indexOf(x) === i).join(', ')}).`, tool: null })
    if (data.orphans.length) us.items.push({ kind: 'data', text: `Trace ${data.orphans.length === 1 ? 'the finding that points to an asset' : `${data.orphans.length} findings that point to assets`} no export contains (${data.orphans.map((o) => o.asset_ref).join(', ')}).`, tool: null })
    if (data.coverage.no_edr.length) us.items.push({ kind: 'data', text: `Raise ${data.coverage.no_edr.length === 1 ? 'the asset' : `the ${data.coverage.no_edr.length} assets`} with no endpoint agent with the customer: ${data.coverage.no_edr.map((a) => a.hostname).join(', ')}.`, tool: null })
    if (!us.items.length) groups.delete('us|Forward deployed engineer (us)')
  }

  const out = [...groups.values()].filter((g) => g.items.length)
  for (const g of out) if (g.party === 'customer') g.email = buildEmail(plan, g)
  const rank: Record<Party, number> = { customer: 0, safe: 1, us: 2 }
  return out.sort((a, b) => rank[a.party] - rank[b.party] || (a.owner === plan.project_owner ? 1 : 0) - (b.owner === plan.project_owner ? 1 : 0))
}

// The questions the data checks raise for the customer, worded exactly as in the emails.
// The plan's open questions and the PDF list these too, so every view asks the same things.
export function customerDataAsks(plan: Plan, data: DataReport | null): string[] {
  if (!data) return []
  return buildActions(plan, data)
    .filter((a) => a.party === 'customer')
    .flatMap((a) => a.items.filter((i) => i.kind === 'data').map((i) => i.text))
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

