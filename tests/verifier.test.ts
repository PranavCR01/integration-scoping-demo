import { describe, expect, it } from 'vitest'
import { buildPlan } from '../src/server/plan'
import { loadCustomer, readJson } from '../src/server/store'
import type { Draft, Plan } from '../src/core/types'
import { PLANTED, caughtBy, plant } from './planted'

const customer = loadCustomer('halden')
const saved = readJson<{ draft: Draft }>('fixtures/drafts/halden.json').draft

const shown = (p: Plan) =>
  JSON.stringify([
    p.access.flatMap((a) => a.rows.map((r) => r.text)),
    p.custom_sheets.flatMap((s) => s.rows.map((r) => r.text)),
    p.data_notes.map((r) => r.text),
    p.questions.map((q) => q.text),
    p.order.map((o) => o.unlocks),
  ])

describe('verifier', () => {
  it('the saved model draft is mostly verified; any hold has a reason (listed in docs/EVAL.md)', async () => {
    const p = await buildPlan({ customer, draftOverride: saved })
    expect(p.verification.facts_verified / p.verification.facts_total).toBeGreaterThan(0.95)
    expect(p.verification.rows_held_back).toBeLessThanOrEqual(2)
    for (const h of p.verification.held) expect(h.reason.length).toBeGreaterThan(10)
  })

  for (const e of PLANTED) {
    it(`catches planted error: ${e.description} (${e.id})`, async () => {
      const p = await buildPlan({ customer, draftOverride: plant(saved, e) })
      const rowName = `${e.row.section}/${e.row.tool}/${e.row.item}`
      expect(p.verification.held.map((h) => h.row)).toContain(rowName)
      expect(caughtBy(p, e), 'the planted fact or token itself must be what failed').toBeTruthy()
      expect(shown(p)).not.toContain(e.bad)
    })
  }

  it('every cited line in the final plan has an excerpt the UI can open', async () => {
    const p = await buildPlan({ customer, draftOverride: saved })
    const cites = [...p.access.flatMap((a) => a.rows), ...p.custom_sheets.flatMap((s) => s.rows), ...p.data_notes].flatMap((r) => r.citations)
    expect(cites.length).toBeGreaterThan(20)
    for (const c of cites) expect(p.excerpts[`${c.file}#L${c.line}`], `${c.file}:${c.line}`).toBeTruthy()
  })

  it('tools with no vendor docs on file show Confirm, never a guess', async () => {
    const p = await buildPlan({ customer, draftOverride: saved })
    for (const tool of ['CrowdStrike Falcon', 'ServiceNow ITSM', 'Microsoft Defender']) {
      const a = p.access.find((x) => x.tool === tool)!
      expect(a.rows.every((r) => r.status === 'confirm' && r.text === ''), tool).toBe(true)
    }
  })

  it('with no draft at all, every drafted item is Confirm', async () => {
    const p = await buildPlan({ customer, draftOverride: { rows: [] } })
    const rows = [...p.access.flatMap((a) => a.rows), ...p.custom_sheets.flatMap((s) => s.rows)]
    expect(rows.every((r) => r.status === 'confirm')).toBe(true)
  })
})

describe('day-one config swap', () => {
  it('loading an internal integrations list that includes Snyk moves it to out of the box and drops its custom sheet', async () => {
    const internal = readJson<any>('config/variants/integrations.safe-internal-example.json')
    const before = await buildPlan({ customer, draftOverride: saved })
    const after = await buildPlan({ customer, draftOverride: saved, overrides: { integrations: internal } })
    expect(before.coverage.find((c) => c.input === 'Snyk')!.bucket).toBe('custom_work')
    expect(after.coverage.find((c) => c.input === 'Snyk')!.bucket).toBe('out_of_box')
    expect(before.custom_sheets.map((s) => s.tool)).toContain('Snyk')
    expect(after.custom_sheets).toEqual([])
    expect(after.config_label).toMatch(/SIMULATED/)
  })
})
