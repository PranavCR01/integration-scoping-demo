import { describe, expect, it } from 'vitest'
import { buildPlan } from '../src/server/plan'
import { runData } from '../src/server/data'
import { loadCustomer } from '../src/server/store'
import { buildActions, buildSummary, customerDataAsks, goalQuestions } from '../src/core/summary'
import { handoffBlocks, planBlocks } from '../src/core/doc'

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
    expect(s.safe_items).toBe(2) // Snyk connector, CrowdStrike access
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

  it('owners with verified access get a card; a tool with nothing verified stays a SAFE decision; every question lands', () => {
    const acts = buildActions(plan, data)
    for (const a of plan.access) {
      const hasVerified = a.rows.some((r) => r.status === 'verified')
      if (hasVerified) expect(acts.some((g) => g.owner === a.owner), a.tool).toBe(true)
    }
    // CrowdStrike has no docs on file: no customer card, and SAFE is asked about its access instead
    expect(acts.some((g) => g.party === 'customer' && g.tools.includes('CrowdStrike Falcon'))).toBe(false)
    expect(acts.find((g) => g.party === 'safe')!.items.some((i) => i.text.startsWith('CrowdStrike Falcon:'))).toBe(true)
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
    expect(goalQuestions(p).length + customerDataAsks(p, d).length).toBe(buildSummary(p, d).customer_questions)
    const glance = blocks.find((b) => b.t === 'p' && b.text.startsWith('**At a glance:**'))
    expect(glance && 'text' in glance && glance.text).toContain(buildSummary(p, d).headline)
  })
})

describe('every verified fact can be opened in the source drawer', () => {
  it('has an excerpt for each verified fact, including ones on held-back rows', async () => {
    const p = await buildPlan({ customer })
    const missing = p.verification.log.filter((l) => l.verified && l.file && l.line && !p.excerpts[`${l.file}#L${l.line}`])
    expect(missing.map((l) => `${l.row} ${l.fact.value} ${l.file}#L${l.line}`)).toEqual([])
  })
})

describe('internal handoff layout', () => {
  it('every Confirm item has an owner, SAFE decisions appear once, no effort section, mappings one line per source', async () => {
    const p = await buildPlan({ customer })
    const d = runData({ customer })
    const blocks = handoffBlocks(p, d, {})
    const headings = blocks.filter((b) => b.t === 'h2' || b.t === 'h3').map((b) => ('text' in b ? b.text : ''))
    expect(headings).not.toContain('Decisions needed from SAFE')
    expect(headings).not.toContain('Effort')
    const after = (h: string) => blocks[blocks.findIndex((b) => 'text' in b && b.text === h) + 1]
    const confirm = after('Every Confirm item')
    expect(confirm.t).toBe('table')
    if (confirm.t === 'table') {
      expect(confirm.rows.every((r) => r[3].length > 0)).toBe(true)
      // every plan row marked Confirm is listed, plus one row per coverage decision
      const total = p.access.flatMap((a) => a.rows).concat(p.custom_sheets.flatMap((s) => s.rows)).filter((r) => r.status === 'confirm').length
      const coverage = p.coverage.filter((c) => c.bucket !== 'out_of_box').length
      expect(confirm.rows.reduce((n, r) => n + r[1].split(', ').length, 0)).toBe(total + coverage)
      expect(confirm.rows.some((r) => r[0] === 'Snyk' && r[1] === 'Whether a connector exists' && /public list/.test(r[2]))).toBe(true)
    }
    const mapIdx = blocks.findIndex((b) => 'text' in b && b.text === 'Field mappings to confirm')
    expect(blocks[mapIdx + 2]).toMatchObject({ t: 'list' })
    const lists = blocks.filter((b) => b.t === 'list').flatMap((b) => (b.t === 'list' ? b.items : []))
    // access lines are short (verified values only), not the full drafted sentence
    expect(lists.some((x) => x.startsWith('access: How we connect: X-APIKeys, accessKey (+'))).toBe(true)
  })
})

describe('summary sentence and card lines (code-written)', () => {
  it('the headline is short and its count matches the tiles', async () => {
    const p = await buildPlan({ customer })
    const d = runData({ customer })
    const s = buildSummary(p, d)
    expect(s.headline).toBe(`${s.ready_now} tools ready to connect. ${s.safe_items + s.customer_questions + s.data.blockers} items to clear before ${p.goal.outcome}.`)
  })

  it('card lines use only verified values; emails keep the full verified text', async () => {
    const p = await buildPlan({ customer })
    const verifiedValues = new Set(p.access.flatMap((a) => a.rows).flatMap((r) => r.citations.map((c) => c.value)))
    const items = buildActions(p, null).flatMap((a) => a.items).filter((i) => i.kind === 'access' && i.short)
    expect(items.length).toBeGreaterThan(0)
    for (const i of items) {
      const values = i.short!.split(': ').slice(1).join(': ').replace(/ \(\+\d+ more in the email\)$/, '').split(', ').filter(Boolean)
      expect(values.length).toBeLessThanOrEqual(2)
      for (const v of values) expect(verifiedValues.has(v), v).toBe(true)
      expect(i.text.length).toBeGreaterThan(i.short!.length)
    }
  })

  it('our side lists open duplicates as one line', async () => {
    const p = await buildPlan({ customer })
    const d = runData({ customer })
    const us = buildActions(p, d).find((a) => a.party === 'us')!
    expect(us.items.filter((i) => /possible duplicate/.test(i.text))).toHaveLength(1)
  })
})
