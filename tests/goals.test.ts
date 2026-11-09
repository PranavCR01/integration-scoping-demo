import { describe, expect, it } from 'vitest'
import { buildPlan } from '../src/server/plan'
import { loadConfig, loadCustomer } from '../src/server/store'
import { chooseGoal } from '../src/core/ordering'
import { buildSummary } from '../src/core/summary'

const base = loadCustomer('halden')
const cfg = loadConfig()
const plan = (goal: string, tools = base.tools) => buildPlan({ customer: { ...base, goal, tools } })
const firstStep = (p: Awaited<ReturnType<typeof plan>>) => p.order[0].tools.map((t) => t.input)
const stepOf = (p: Awaited<ReturnType<typeof plan>>, tool: string) => p.order.find((s) => s.tools.some((t) => t.input === tool))!.step

describe('the goal changes the plan (code and config, not the model)', () => {
  it('each preset goal picks its own rule set, and says which words matched', () => {
    for (const [key, p] of Object.entries(cfg.connection_order.goal_profiles)) {
      const c = chooseGoal(p.example_goal, cfg)
      expect(c.key, p.example_goal).toBe(key)
      if (key !== 'default') expect(c.matched.length).toBeGreaterThan(0)
    }
    expect(chooseGoal('Get our tools connected to SAFE.', cfg).key).toBe('default')
  })

  it('a goal with more keywords for one rule set wins over a single stray keyword', () => {
    expect(chooseGoal('Fix and patch our most exploitable exposures before the board sees them.', cfg).key).toBe('exposure_remediation')
  })

  it('the connection order follows the goal', async () => {
    const board = await plan(cfg.connection_order.goal_profiles.board_ready_risk_figure.example_goal)
    const fix = await plan(cfg.connection_order.goal_profiles.exposure_remediation.example_goal)
    const access = await plan(cfg.connection_order.goal_profiles.identity_access.example_goal)
    const audit = await plan(cfg.connection_order.goal_profiles.audit_evidence.example_goal)
    expect(stepOf(board, 'ServiceNow ITSM')).toBe(3)
    expect(stepOf(fix, 'ServiceNow ITSM')).toBe(2) // fixes need the ticketing tool early
    expect(firstStep(access)).toEqual(['Okta']) // identity first
    expect(firstStep(audit).sort()).toEqual(['CrowdStrike Falcon', 'Okta'])
    // and the wording of each step comes from that goal's rules
    expect(fix.order[0].unlocks).not.toBe(board.order[0].unlocks)
  })

  it('the summary sentence and the questions follow the goal', async () => {
    const fix = await plan(cfg.connection_order.goal_profiles.exposure_remediation.example_goal)
    const audit = await plan(cfg.connection_order.goal_profiles.audit_evidence.example_goal)
    expect(buildSummary(fix, null).headline).toMatch(/Before fixes can be prioritized and tracked/)
    expect(buildSummary(audit, null).headline).toMatch(/Before the evidence is complete/)
    expect(fix.questions.map((q) => q.key)).toContain('goal:fix_deadlines')
    expect(fix.questions.map((q) => q.key)).not.toContain('goal:framework')
    expect(audit.questions.map((q) => q.key)).toContain('goal:framework')
  })

  it('changing the goal does not change what is verified', async () => {
    const a = await plan(cfg.connection_order.goal_profiles.board_ready_risk_figure.example_goal)
    const b = await plan(cfg.connection_order.goal_profiles.identity_access.example_goal)
    expect(b.verification.facts_verified).toBe(a.verification.facts_verified)
  })
})

describe('changing the tool list reuses the verified items it already has', () => {
  const goal = base.goal
  it('adding a tool keeps every verified item for the other tools; the new tool shows Confirm', async () => {
    const before = await plan(goal)
    const after = await plan(goal, [...base.tools, 'Wiz'])
    const verified = (p: typeof before) => p.access.flatMap((a) => a.rows).filter((r) => r.status === 'verified').length
    expect(verified(after)).toBe(verified(before))
    const wiz = after.access.find((a) => a.input === 'Wiz')!
    expect(wiz.rows.every((r) => r.status === 'confirm')).toBe(true)
    expect(after.draft_note).toMatch(/Wiz has no vendor docs on file/)
  })

  it('removing a tool removes its sheet and its questions', async () => {
    const after = await plan(goal, base.tools.filter((t) => t !== 'Snyk'))
    expect(after.custom_sheets).toEqual([])
    expect(after.questions.some((q) => q.tool === 'Snyk')).toBe(false)
    expect(after.access.find((a) => a.input === 'Okta')!.rows.every((r) => r.status === 'verified')).toBe(true)
  })
})
