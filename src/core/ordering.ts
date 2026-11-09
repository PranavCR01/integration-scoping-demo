// Connection order: rules from config/connection_order.json, applied in code.
import type { AppConfig, CoverageResult, GoalChoice, GoalScope, OrderStep } from './types.js'
import { normalize } from './coverage.js'

// Pick the rule set whose keywords appear most often in the goal. Ties go to the rule set
// listed first in config. No keyword at all: the general "default" rules.
export function chooseGoal(goal: string, cfg: AppConfig): GoalChoice {
  const g = normalize(goal)
  let best: { key: string; matched: string[] } = { key: 'default', matched: [] }
  for (const [key, p] of Object.entries(cfg.connection_order.goal_profiles)) {
    const matched = p.match_keywords.filter((k) => g.includes(normalize(k)))
    if (matched.length > best.matched.length) best = { key, matched }
  }
  const p = cfg.connection_order.goal_profiles[best.key] ?? cfg.connection_order.goal_profiles.default
  return { key: best.key, label: p.label, outcome: p.outcome, short: p.short, matched: best.matched }
}

export function pickGoalProfile(goal: string, cfg: AppConfig): string {
  return chooseGoal(goal, cfg).key
}

export function roleFor(c: CoverageResult, cfg: AppConfig): { role: string; owner: string } {
  const tp = cfg.tool_profiles
  const exact = tp.profiles[c.tool_key] ?? tp.profiles[c.input]
  if (exact) return { role: exact.role, owner: exact.owner }
  const words = normalize(c.input).split(' ')
  for (const [fam, p] of Object.entries(tp.family_profiles)) {
    if (fam.startsWith('_') || typeof p === 'string') continue
    if (words.includes(fam)) return p
  }
  return { role: 'other', owner: tp.default_owner }
}

const BUCKET_RANK = { out_of_box: 0, confirm_with_safe: 1, custom_work: 2 } as const

// Which tools this goal needs, by role. A tool whose role the goal does not list can wait.
export function goalScope(coverage: CoverageResult[], goalProfile: string, cfg: AppConfig): GoalScope {
  const profile = cfg.connection_order.goal_profiles[goalProfile] ?? cfg.connection_order.goal_profiles.default
  const needs = new Set(profile.needed_roles ?? Object.keys(cfg.connection_order.role_labels))
  const needed: string[] = []
  const later: string[] = []
  for (const c of coverage) (needs.has(roleFor(c, cfg).role) ? needed : later).push(c.tool_key)
  return { needed, later }
}

// Tools the goal needs and that are ready to connect go in their role's step. Needed tools
// still waiting on a decision (Confirm with SAFE, Custom work) come next, each with its gate.
// Tools the goal does not need come last, marked 'later' and left unnumbered.
export function connectionOrder(coverage: CoverageResult[], goalProfile: string, cfg: AppConfig): OrderStep[] {
  const profile = cfg.connection_order.goal_profiles[goalProfile] ?? cfg.connection_order.goal_profiles.default
  const stepOf = (role: string) => profile.steps.find((s) => s.roles.includes(role)) ?? profile.steps[profile.steps.length - 1]
  const scope = goalScope(coverage, goalProfile, cfg)
  const isNeeded = (c: CoverageResult) => scope.needed.includes(c.tool_key)
  const ready = coverage.filter((c) => isNeeded(c) && c.bucket === 'out_of_box')
  const waiting = coverage.filter((c) => isNeeded(c) && c.bucket !== 'out_of_box').sort((a, b) => BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket])
  const later = coverage.filter((c) => !isNeeded(c))
  const tool = (c: CoverageResult) => ({ input: c.input, tool_key: c.tool_key, bucket: c.bucket, role: roleFor(c, cfg).role })

  const steps: OrderStep[] = []
  for (const rule of [...profile.steps].sort((a, b) => a.step - b.step)) {
    const tools = ready.filter((c) => stepOf(roleFor(c, cfg).role).step === rule.step)
    if (tools.length === 0) continue
    steps.push({ step: steps.length + 1, tools: tools.map(tool), unlocks: rule.unlocks, gate: null })
  }
  for (const c of waiting) {
    steps.push({ step: steps.length + 1, tools: [tool(c)], unlocks: stepOf(roleFor(c, cfg).role).unlocks, gate: cfg.connection_order.gates[c.bucket] })
  }
  for (const c of later) {
    steps.push({ step: 0, tools: [tool(c)], unlocks: stepOf(roleFor(c, cfg).role).unlocks, gate: cfg.connection_order.gates.later, later: true })
  }
  return steps
}
