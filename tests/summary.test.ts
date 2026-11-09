import { describe, expect, it } from 'vitest'
import { buildPlan } from '../src/server/plan'
import { runData } from '../src/server/data'
import { loadCustomer } from '../src/server/store'
import { buildActions, buildSummary, customerDataAsks } from '../src/core/summary'
import { planBlocks } from '../src/core/doc'

const customer = loadCustomer('halden')
const plain = (s: string) => s.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')

describe('summary and who-owes-what (code-built from the verified plan)', async () => {
  const plan = await buildPlan({ customer })
  const data = runData({ customer })

  it('counts match the plan', () => {
    const s = buildSummary(plan, data)
    expect(s.ready_now).toBe(plan.coverage.filter((c) => c.bucket === 'out_of_box').length)
    // the tile counts exactly the SAFE lines in the list underneath it
    expect(s.safe_items).toBe(s.blockers.filter((b) => b.who === 'SAFE').length)
    expect(s.safe_items).toBe(4) // Defender, Snyk, CrowdStrike access, ServiceNow access
    expect(s.data.status).toBe('blocked')
    expect(s.data.blockers).toBe(data.checks.filter((c) => c.level === 'block').length)
    expect(buildSummary(plan, null).data.status).toBe('not_run')
  })

  it('emails contain only verified access text and the plan\'s own questions', () => {
    const verified = new Set(plan.access.flatMap((a) => a.rows.filter((r) => r.status === 'verified').map((r) => `${r.label}: ${plain(r.text)}`)))
    const questions = new Set(plan.questions.map((q) => plain(q.text)))
    for (const g of buildActions(plan, data)) {
      for (const i of g.items) {
        if (i.kind === 'access' && !i.text.startsWith('We will confirm')) expect(verified.has(i.text), i.text).toBe(true)
        if (i.kind === 'question') expect(questions.has(i.text), i.text).toBe(true)
      }
      if (g.party !== 'customer') expect(g.email).toBeNull()
    }
  })

  it('never puts a Confirm row into a customer email as if it were known', () => {
    const confirmText = plan.access.flatMap((a) => a.rows.filter((r) => r.status === 'confirm').map((r) => r.confirm_reason!))
    for (const g of buildActions(plan, data)) if (g.email) for (const c of confirmText) expect(g.email.body).not.toContain(c)
  })

  it('every customer tool owner gets a card, and every question lands with someone', () => {
    const acts = buildActions(plan, data)
    for (const a of plan.access) expect(acts.some((g) => g.owner === a.owner)).toBe(true)
    const asked = acts.flatMap((g) => g.items.filter((i) => i.kind === 'question')).length
    expect(asked).toBe(plan.questions.length)
  })
})

describe('the customer plan asks the same things as the emails', () => {
  it('every question and data request in the emails also appears in the plan, and the counts match the summary', async () => {
    const p = await buildPlan({ customer })
    const d = runData({ customer })
    const blocks = planBlocks(p, {}, '', '', 'Plan', 'Draft', d)
    const listed = blocks.flatMap((b) => (b.t === 'list' ? b.items : []))
    const asked = buildActions(p, d).filter((a) => a.party === 'customer').flatMap((a) => a.items.filter((i) => i.kind === 'question' || i.kind === 'data'))
    for (const i of asked.filter((i) => i.kind === 'data')) expect(listed).toContain(i.text)
    expect(customerDataAsks(p, d).length).toBe(2)
    expect(p.questions.length + customerDataAsks(p, d).length).toBe(buildSummary(p, d).customer_questions)
    const glance = blocks.find((b) => b.t === 'p' && b.text.startsWith('**At a glance:**'))
    expect(glance && 'text' in glance && glance.text).toContain(buildSummary(p, d).headline)
  })
})
