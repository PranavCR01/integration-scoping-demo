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
    expect(chooseGoal('Review who has access, which accounts have privileges, and report it to the board.', cfg).key).toBe('identity_access')
  })

  it('two goals and a silent fallback', () => {
    expect(Object.keys(cfg.connection_order.goal_profiles).sort()).toEqual(['board_ready_risk_figure', 'default', 'identity_access'])
  })

  it('the connection order follows the goal', async () => {
    const board = await plan(cfg.connection_order.goal_profiles.board_ready_risk_figure.example_goal)
    const access = await plan(cfg.connection_order.goal_profiles.identity_access.example_goal)
    const numbered = (p: typeof board) => p.order.filter((s) => !s.later).map((s) => s.tools.map((t) => t.input).sort())
    expect(numbered(board)).toEqual([['CrowdStrike Falcon', 'Tenable VM'], ['Okta'], ['Snyk']])
    expect(numbered(access)).toEqual([['Okta'], ['CrowdStrike Falcon']]) // identity first
    // and the wording of each step comes from that goal's rules
    expect(access.order[0].unlocks).not.toBe(board.order[0].unlocks)
  })

  it('the summary sentence and the questions follow the goal', async () => {
    const board = await plan(cfg.connection_order.goal_profiles.board_ready_risk_figure.example_goal)
    const access = await plan(cfg.connection_order.goal_profiles.identity_access.example_goal)
    expect(buildSummary(board, null).headline).toMatch(/before the risk figure can be trusted/)
    expect(buildSummary(access, null).headline).toMatch(/before access risk can be reported/)
    const keys = (p: typeof board) => p.questions.map((q) => q.key)
    expect(keys(board)).toEqual(expect.arrayContaining(['goal:board_audience', 'crown_jewels']))
    expect(keys(access)).toEqual(expect.arrayContaining(['goal:key_apps', 'goal:shared_accounts']))
    // the crown-jewels question talks about the risk figure, so it belongs to the board goal only
    expect(keys(access)).not.toContain('crown_jewels')
    // dropped: product-variant questions and the CMDB question
    for (const p of [board, access]) {
      expect(keys(p).some((k) => k.startsWith('variant:'))).toBe(false)
      expect(keys(p)).not.toContain('source_of_truth')
    }
  })

  it('moving the crown-jewels question keeps the model-drafted wording (same key)', async () => {
    const board = await plan(cfg.connection_order.goal_profiles.board_ready_risk_figure.example_goal)
    const q = board.questions.find((x) => x.key === 'crown_jewels')!
    const drafted = (await import('../fixtures/drafts/halden.json')).draft.rows.find((r: { item: string }) => r.item === 'crown_jewels')!
    expect(q.text).toBe(drafted.text)
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

  it('identity goal: needs Okta and CrowdStrike; Tenable and Snyk can wait', async () => {
    const p = await plan(identityGoal)
    expect(p.scope.needed.sort()).toEqual(['CrowdStrike Falcon', 'Okta'])
    expect(p.scope.later.sort()).toEqual(['Snyk', 'Tenable Vulnerability Management'])
    expect(p.order.filter((s) => s.later).map((s) => s.tools[0].input).sort()).toEqual(['Snyk', 'Tenable VM'])
  })

  it('identity goal: the summary and the requests count only the needed tools', async () => {
    const p = await plan(identityGoal)
    const s = buildSummary(p, null)
    expect(s.tools_total).toBe(2)
    expect(s.ready_now).toBe(2)
    expect(s.later_total).toBe(2)
    expect(s.blockers.some((b) => b.text.startsWith('Snyk'))).toBe(false)
    const owners = buildActions(p, null).map((a) => a.owner)
    expect(owners).not.toContain('Vulnerability management lead')
    expect(owners).not.toContain('Application security lead')
    expect(owners).toContain('Okta administrator')
  })

  it('identity goal: tools it does not need get one line in the access checklist', async () => {
    const { accessLines, LATER_ACCESS } = await import('../src/core/doc')
    const p = await plan(identityGoal)
    expect(accessLines(p, p.access.find((a) => a.tool === 'Snyk')!).later).toBe(true)
    expect(accessLines(p, p.access.find((a) => a.tool === 'Okta')!).later).toBe(false)
    expect(LATER_ACCESS).toMatch(/Not needed for this goal/)
  })

  it('identity goal: data problems only in tools it does not need become warnings, not blockers', async () => {
    const id = runData({ customer: { ...base, goal: identityGoal } })
    const level = (r: typeof id, check: string) => r.checks.find((c) => c.check === check)!.level
    expect(level(id, 'counts')).toBe('warn') // the Tenable gap: Tenable is not needed for this goal
    expect(level(id, 'orphans')).toBe('warn') // orphan findings are Tenable findings
    expect(level(id, 'review_queue')).toBe('block') // possible duplicates involve CrowdStrike, which this goal needs
    const board = runData({ customer: base })
    expect(level(board, 'counts')).toBe('block')
    expect(level(board, 'orphans')).toBe('block')
  })

  it('identity goal: the plan asks only about needed tools, and its count matches the tile', async () => {
    const { planBlocks, LATER_SHEET } = await import('../src/core/doc')
    const { goalQuestions, customerDataAsks } = await import('../src/core/summary')
    const p = await plan(identityGoal)
    const d = runData({ customer: { ...base, goal: identityGoal } })
    const keys = goalQuestions(p).map((q) => q.key)
    expect(keys).not.toContain('extra_1') // Snyk plan and region
    expect(keys).not.toContain('extra_2') // dedicated Tenable user
    expect(keys).not.toContain('lookback') // vulnerability history: board goal only
    expect(goalQuestions(p).length + customerDataAsks(p, d).length).toBe(buildSummary(p, d).customer_questions)
    const blocks = planBlocks(p, {}, '', '', 'Plan', 'Draft', d)
    const sheetAt = blocks.findIndex((b) => 'text' in b && b.text.startsWith('4. Custom work scoping sheet: Snyk'))
    expect(blocks[sheetAt + 1]).toEqual({ t: 'p', text: LATER_SHEET })
    expect(blocks.some((b) => b.t === 'table' && b.head[0] === 'Item')).toBe(false) // no sheet table
  })

  it('board goal asks about vulnerability history; the general fallback does too', async () => {
    const board = await plan(base.goal)
    const general = await plan('Get our tools connected to SAFE.')
    expect(board.questions.map((q) => q.key)).toContain('lookback')
    expect(general.questions.map((q) => q.key)).toContain('lookback')
  })

  it('board goal needs every tool, so nothing waits', async () => {
    const p = await plan(base.goal)
    expect(p.scope.later).toEqual([])
    expect(p.order.some((s) => s.later)).toBe(false)
    expect(buildSummary(p, null).tools_total).toBe(4)
  })
})
