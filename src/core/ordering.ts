// Connection order: rules from config/connection_order.json, applied in code.
import type { AppConfig, CoverageResult, OrderStep } from './types.js'
import { normalize } from './coverage.js'

export function pickGoalProfile(goal: string, cfg: AppConfig): string {
  const g = normalize(goal)
  for (const [key, p] of Object.entries(cfg.connection_order.goal_profiles)) {
    if (p.match_keywords.some((k) => g.includes(normalize(k)))) return key
  }
  return 'default'
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

// Tools that are ready to connect go in their role's step. Tools still waiting on a
// decision (Confirm with SAFE, Custom work) come after all ready tools, each with its gate.
export function connectionOrder(coverage: CoverageResult[], goalProfile: string, cfg: AppConfig): OrderStep[] {
  const profile = cfg.connection_order.goal_profiles[goalProfile] ?? cfg.connection_order.goal_profiles.default
  const stepOf = (role: string) => profile.steps.find((s) => s.roles.includes(role)) ?? profile.steps[profile.steps.length - 1]
  const ready = coverage.filter((c) => c.bucket === 'out_of_box')
  const waiting = coverage.filter((c) => c.bucket !== 'out_of_box').sort((a, b) => BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket])

  const steps: OrderStep[] = []
  for (const rule of [...profile.steps].sort((a, b) => a.step - b.step)) {
    const tools = ready.filter((c) => stepOf(roleFor(c, cfg).role).step === rule.step)
    if (tools.length === 0) continue
    steps.push({
      step: steps.length + 1,
      tools: tools.map((c) => ({ input: c.input, tool_key: c.tool_key, bucket: c.bucket, role: roleFor(c, cfg).role })),
      unlocks: rule.unlocks,
      gate: null,
    })
  }
  for (const c of waiting) {
    const role = roleFor(c, cfg).role
    steps.push({
      step: steps.length + 1,
      tools: [{ input: c.input, tool_key: c.tool_key, bucket: c.bucket, role }],
      unlocks: stepOf(role).unlocks,
      gate: cfg.connection_order.gates[c.bucket],
    })
  }
  return steps
}
