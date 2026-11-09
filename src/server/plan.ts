// Builds a full plan: code steps first, then the model draft (live or saved), then verification.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppConfig, Customer, Draft, Plan } from '../core/types.js'
import { excerptKey } from '../core/types.js'
import { checkCoverage } from '../core/coverage.js'
import { chooseGoal, connectionOrder, goalScope } from '../core/ordering.js'
import { allowedFiles, assemble } from '../core/plan.js'
import { draftWithModel, MODEL } from './draft.js'
import { excerpt, loadConfig, ROOT, store, type ConfigOverrides } from './store.js'

export interface SavedDraft {
  created_at: string
  model: string
  prompt_file: string
  customer_id: string
  tools: string[]
  draft: Draft
}

export const savedDraftPath = (customerId: string) => `fixtures/drafts/${customerId}.json`

export function loadSavedDraft(customer: Customer): SavedDraft | null {
  const p = join(ROOT, savedDraftPath(customer.id))
  if (!existsSync(p)) return null
  // The draft is reused even when the tool list changes: its items are keyed by tool, so
  // tools it covers keep their (re-verified) items and new tools simply have none.
  return JSON.parse(readFileSync(p, 'utf8')) as SavedDraft
}

export interface BuildOptions {
  customer: Customer
  overrides?: ConfigOverrides
  mode?: 'saved' | 'live'
  draftOverride?: Draft // tests: inject a draft directly
}

export async function buildPlan(opts: BuildOptions): Promise<Plan> {
  const cfg: AppConfig = loadConfig(opts.overrides)
  const { customer } = opts
  const coverage = checkCoverage(customer.tools, cfg)
  const goal = chooseGoal(customer.goal, cfg)
  const goalProfile = goal.key
  const order = connectionOrder(coverage, goalProfile, cfg)

  let draft: Draft | null = null
  let source: Plan['draft_source'] = 'none'
  let note = ''
  let model: string | null = null
  if (opts.draftOverride) {
    draft = opts.draftOverride
    source = 'cached'
    note = 'Injected draft (test).'
  } else if (opts.mode === 'live') {
    try {
      const r = await draftWithModel(customer, coverage, order, cfg, goalProfile)
      draft = r.draft
      source = 'live'
      model = r.model
      note = `Drafted just now by ${r.model}.`
    } catch (e) {
      note = `Live draft failed (${(e as Error).message}). `
    }
  }
  if (!draft) {
    const saved = loadSavedDraft(customer)
    if (saved) {
      draft = saved.draft
      source = 'cached'
      model = saved.model
      note += `Saved model draft from ${saved.created_at.slice(0, 10)} (${saved.model}). Verified again just now against the current config and sources.`
      // Be exact about tools the saved draft has never seen: a new draft only helps if the
      // tool has vendor docs on file; otherwise its access details stay Confirm regardless.
      const fresh = coverage.filter((c) => !saved.tools.includes(c.input))
      const needDraft = fresh.filter((c) => allowedFiles(c, cfg).length > 0).map((c) => c.input)
      const noDocs = fresh.filter((c) => allowedFiles(c, cfg).length === 0).map((c) => c.input)
      if (needDraft.length) note += ` ${needDraft.join(', ')} ${needDraft.length === 1 ? 'was' : 'were'} added after the draft was written, so ${needDraft.length === 1 ? 'its' : 'their'} drafted items show Confirm until a new draft is run.`
      if (noDocs.length) note += ` ${noDocs.join(', ')} ${noDocs.length === 1 ? 'has' : 'have'} no vendor docs on file, so ${noDocs.length === 1 ? 'its' : 'their'} access details show Confirm.`
    } else {
      note += 'No model draft available, so every drafted item shows as Confirm.'
    }
  }

  const canonicalFile = 'config/canonical_schema.json'
  const asm = assemble({
    cfg,
    coverage,
    order,
    draft,
    goalKey: goalProfile,
    ctxFor: (c) => ({ store, allowedFiles: allowedFiles(c, cfg), canonical: cfg.canonical_schema, canonicalFile }),
  })

  const excerpts: Plan['excerpts'] = {}
  const addEx = (file: string, line: number) => {
    const k = excerptKey(file, line)
    if (!excerpts[k]) {
      const e = excerpt(file, line)
      if (e) excerpts[k] = e
    }
  }
  for (const a of asm.access) for (const r of a.rows) r.citations.forEach((c) => addEx(c.file, c.line))
  for (const s of asm.custom_sheets) for (const r of s.rows) r.citations.forEach((c) => addEx(c.file, c.line))
  for (const r of asm.data_notes) r.citations.forEach((c) => addEx(c.file, c.line))
  for (const c of coverage) c.evidence.forEach((e) => addEx(e.file, e.line))

  return {
    document: cfg.scoping_template.document,
    goal,
    scope: goalScope(coverage, goalProfile, cfg),
    project_owner: cfg.tool_profiles.project_owner ?? 'Customer project lead',
    customer,
    generated_at: new Date().toISOString(),
    config_label: cfg.integrations.label,
    goal_profile: goalProfile,
    draft_source: source,
    draft_note: note.trim(),
    model: model ?? (source === 'none' ? null : MODEL),
    coverage,
    order: asm.order,
    access: asm.access,
    custom_sheets: asm.custom_sheets,
    data_checks: cfg.scoping_template.data_checks,
    data_notes: asm.data_notes,
    questions: asm.questions,
    verification: asm.verification,
    excerpts,
    effort: {
      label: cfg.effort_placeholders.label,
      rows: coverage.map((c) => ({ tool: c.tool_key, bucket: c.bucket, value: cfg.effort_placeholders.by_bucket[c.bucket] })),
    },
  }
}
