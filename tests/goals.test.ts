import { describe, expect, it } from 'vitest'
import { buildPlan } from '../src/server/plan'
import { loadConfig, loadCustomer } from '../src/server/store'
import { chooseGoal } from '../src/core/ordering'
import { buildActions, buildSummary } from '../src/core/summary'
import { runData } from '../src/server/data'

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

describe('each goal only asks for the tools it needs', () => {
  const identityGoal = cfg.connection_order.goal_profiles.identity_access.example_goal

  it('identity goal: needs Okta and the endpoint tools; Tenable, ServiceNow and Snyk can wait', async () => {
    const p = await plan(identityGoal)
    expect(p.scope.needed.sort()).toEqual(['CrowdStrike Falcon', 'Microsoft Defender', 'Okta'])
    expect(p.scope.later.sort()).toEqual(['ServiceNow ITSM', 'Snyk', 'Tenable Vulnerability Management'])
    const numbered = p.order.filter((s) => !s.later).flatMap((s) => s.tools.map((t) => t.input))
    expect(numbered).not.toContain('Tenable VM')
    expect(p.order.filter((s) => s.later).map((s) => s.tools[0].input).sort()).toEqual(['ServiceNow ITSM', 'Snyk', 'Tenable VM'])
  })

  it('identity goal: the summary and the requests count only the needed tools', async () => {
    const p = await plan(identityGoal)
    const s = buildSummary(p, null)
    expect(s.tools_total).toBe(3)
    expect(s.ready_now).toBe(2) // Okta, CrowdStrike; Defender still needs its product confirmed
    expect(s.later_total).toBe(3)
    expect(s.blockers.some((b) => b.text.startsWith('Snyk'))).toBe(false)
    expect(s.blockers.some((b) => b.text.startsWith('ServiceNow'))).toBe(false)
    const owners = buildActions(p, null).map((a) => a.owner)
    expect(owners).not.toContain('Vulnerability management lead')
    expect(owners).not.toContain('Application security lead')
    expect(owners).toContain('Okta administrator')
  })

  it('identity goal: data problems only in tools it does not need become warnings, not blockers', async () => {
    const id = runData({ customer: { ...base, goal: identityGoal } })
    const level = (r: typeof id, check: string) => r.checks.find((c) => c.check === check)!.level
    expect(level(id, 'counts')).toBe('warn') // the Tenable gap: Tenable is not needed for this goal
    expect(level(id, 'orphans')).toBe('warn') // orphan findings are Tenable findings
    expect(level(id, 'review_queue')).toBe('block') // possible duplicates involve Okta and CrowdStrike
    const board = runData({ customer: base })
    expect(level(board, 'counts')).toBe('block')
    expect(level(board, 'orphans')).toBe('block')
  })

  it('board goal needs every tool, so nothing changes for the main demo', async () => {
    const p = await plan(base.goal)
    expect(p.scope.later).toEqual([])
    expect(p.order.some((s) => s.later)).toBe(false)
    expect(buildSummary(p, null).tools_total).toBe(6)
  })
})
