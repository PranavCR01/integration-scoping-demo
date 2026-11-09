// Plan assembly. Code decides which rows exist, what is Confirm, and whether each drafted
// row survives verification. The model's draft only ever fills wording into these slots.
import type {
  AppConfig,
  CoverageResult,
  Draft,
  DraftRow,
  DraftSection,
  FactCheck,
  OrderStep,
  PlanQuestion,
  PlanRow,
  RowCheck,
  TemplateItem,
  VerificationSummary,
} from './types.js'
import { roleFor } from './ordering.js'
import { checkRow, type VerifyContext } from './verify.js'

export interface ExpectedRow {
  section: DraftSection
  tool: string
  item: string
  label: string
  expects: string[]
  confirm: string | null // non-null: code already knows this is Confirm, and why
}

export function docsFor(c: CoverageResult, cfg: AppConfig) {
  if (c.bucket === 'confirm_with_safe') return null // exact product unknown: no doc applies yet
  return cfg.tool_profiles.profiles[c.tool_key]?.docs ?? null
}

export function allowedFiles(c: CoverageResult, cfg: AppConfig): string[] {
  const d = docsFor(c, cfg)
  if (!d) return []
  return [...(d.spec ? [d.spec] : []), ...d.files.map((f) => f.file)]
}

export function expectedRows(coverage: CoverageResult[], cfg: AppConfig): ExpectedRow[] {
  const out: ExpectedRow[] = []
  const t = cfg.scoping_template
  for (const c of coverage) {
    const docs = docsFor(c, cfg)
    const noDocs =
      c.bucket === 'confirm_with_safe'
        ? 'Waiting on the exact product the customer licenses.'
        : 'No vendor docs on file for this tool, so nothing is guessed.'
    for (const it of t.access_items) {
      out.push({ section: 'access', tool: c.tool_key, item: it.key, label: it.label, expects: it.expects ?? [], confirm: docs ? null : noDocs })
    }
    if (c.bucket === 'custom_work') {
      for (const it of t.custom_sheet_items as TemplateItem[]) {
        out.push({
          section: 'custom_sheet',
          tool: c.tool_key,
          item: it.key,
          label: it.label,
          expects: it.expects ?? [],
          confirm: it.always_confirm ? `Needs input from the ${it.always_confirm}.` : docs ? null : noDocs,
        })
      }
    }
  }
  return out
}

export interface QuestionSeed {
  key: string
  tool: string | null
  text: string // code-written default wording, always safe to show
  allow: string[] // names the wording may mention
}

export function questionSeeds(coverage: CoverageResult[], cfg: AppConfig, goalKey = 'default'): QuestionSeed[] {
  const seeds: QuestionSeed[] = []
  for (const c of coverage) {
    if (c.bucket === 'confirm_with_safe') {
      seeds.push({
        key: `which_product:${c.input}`,
        tool: c.tool_key,
        text: `Which ${c.input} product do you license? SAFE lists: ${c.candidates.join(', ')}.`,
        allow: [c.input, ...c.candidates],
      })
    }
    if (c.bucket === 'out_of_box') {
      const distinct = c.variants.filter((v) => !/via m365$/i.test(v))
      for (const v of distinct) {
        seeds.push({ key: `variant:${v}`, tool: c.tool_key, text: `SAFE also lists "${v}". Do you use it as well as ${c.input}?`, allow: [v, c.input, c.tool_key] })
      }
    }
  }
  // Questions that only matter for this goal come first, then the ones every plan asks.
  const goal = cfg.connection_order.goal_profiles[goalKey] ?? cfg.connection_order.goal_profiles.default
  for (const q of goal?.questions ?? []) seeds.push({ key: q.key, tool: null, text: q.text, allow: [] })
  for (const q of cfg.scoping_template.standard_questions) seeds.push({ key: q.key, tool: null, text: q.text, allow: [] })
  return seeds
}

export interface AssembleInput {
  cfg: AppConfig
  coverage: CoverageResult[]
  order: OrderStep[]
  draft: Draft | null
  ctxFor: (c: CoverageResult) => VerifyContext
  goalKey: string
}

export interface Assembled {
  access: { tool: string; input: string; bucket: CoverageResult['bucket']; owner: string; docs_label: string | null; rows: PlanRow[] }[]
  custom_sheets: { tool: string; rows: PlanRow[] }[]
  order: OrderStep[]
  data_notes: PlanRow[]
  questions: PlanQuestion[]
  verification: VerificationSummary
}

const rowKey = (r: { section: string; tool: string | null; item: string }) => `${r.section}|${r.tool ?? ''}|${r.item}`

export function assemble({ cfg, coverage, order, draft, ctxFor, goalKey }: AssembleInput): Assembled {
  const drafts = new Map<string, DraftRow>()
  for (const r of draft?.rows ?? []) drafts.set(rowKey(r), r)
  const log: VerificationSummary['log'] = []
  const held: VerificationSummary['held'] = []
  let rowsTotal = 0

  const byTool = new Map(coverage.map((c) => [c.tool_key, c]))
  const toolNames = coverage.flatMap((c) => [c.input, c.tool_key, ...c.candidates, ...c.variants])

  const finish = (exp: { section: DraftSection; tool: string | null; item: string; label: string; expects: string[] }, d: DraftRow | undefined, check: RowCheck | null, confirm: string | null): PlanRow => {
    rowsTotal++
    const name = `${exp.section}/${exp.tool ?? '-'}/${exp.item}`
    if (check) for (const f of check.facts) log.push({ ...f, row: name })
    const citations = (check?.facts ?? [])
      .filter((f): f is FactCheck & { file: string; line: number } => f.verified && !!f.file && f.line !== null)
      .map((f) => ({ file: f.file, line: f.line, kind: f.fact.kind, value: f.fact.value, corrected_from: f.corrected_from }))
    if (confirm) {
      return { section: exp.section, tool: exp.tool, item: exp.item, label: exp.label, status: 'confirm', text: '', confirm_reason: confirm, held_back: null, citations: [] }
    }
    if (d && check && d.facts.length === 0 && /^confirm\.?$/i.test(d.text.trim())) {
      // The model followed the rule: the sources don't state this, so it said Confirm.
      return { section: exp.section, tool: exp.tool, item: exp.item, label: exp.label, status: 'confirm', text: '', confirm_reason: 'The attached sources do not state this.', held_back: null, citations: [] }
    }
    if (!d || !check) {
      return { section: exp.section, tool: exp.tool, item: exp.item, label: exp.label, status: 'confirm', text: '', confirm_reason: 'Not drafted yet for this tool. A new model draft would fill this in, and it would be checked like everything else.', held_back: null, citations: [] }
    }
    let reason = check.reason
    if (!reason && exp.expects.length) {
      const has = check.facts.some((f) => f.verified && exp.expects.includes(f.fact.kind))
      if (!has) reason = `No verified ${exp.expects.join(' or ')} fact supports this item`
    }
    if (reason) {
      held.push({ row: name, draft_text: d.text, reason })
      return { section: exp.section, tool: exp.tool, item: exp.item, label: exp.label, status: 'confirm', text: '', confirm_reason: 'The draft for this item could not be verified against the sources, so it was held back.', held_back: { draft_text: d.text, reason }, citations: [] }
    }
    return { section: exp.section, tool: exp.tool, item: exp.item, label: exp.label, status: 'verified', text: d.text, confirm_reason: null, held_back: null, citations }
  }

  const access: Assembled['access'] = []
  const sheets = new Map<string, PlanRow[]>()
  for (const exp of expectedRows(coverage, cfg)) {
    const c = byTool.get(exp.tool)!
    const d = drafts.get(rowKey(exp))
    const check = !exp.confirm && d ? checkRow(d.text, d.facts, ctxFor(c), toolNames) : null
    const row = finish(exp, d, check, exp.confirm)
    if (exp.section === 'access') {
      let entry = access.find((a) => a.tool === exp.tool)
      if (!entry) {
        const docs = docsFor(c, cfg)
        entry = { tool: exp.tool, input: c.input, bucket: c.bucket, owner: roleFor(c, cfg).owner, docs_label: docs?.label ?? null, rows: [] }
        access.push(entry)
      }
      entry.rows.push(row)
    } else {
      if (!sheets.has(exp.tool)) sheets.set(exp.tool, [])
      sheets.get(exp.tool)!.push(row)
    }
  }

  // Order wording comes straight from the chosen goal's rule set in config, so a different
  // goal gives a different plan. (Older saved drafts reworded it per step number; that
  // wording is ignored because it would not follow the goal.)
  const orderOut = order

  // Data notes: optional, model-proposed, only shown if every fact verifies.
  const dataNotes: PlanRow[] = []
  for (const d of draft?.rows ?? []) {
    if (d.section !== 'data_note' || !d.tool) continue
    const c = byTool.get(d.tool)
    if (!c) continue
    const check = checkRow(d.text, d.facts, ctxFor(c), toolNames)
    const row = finish({ section: 'data_note', tool: d.tool, item: d.item, label: d.item, expects: d.facts.length ? [] : ['doc'] }, d, check, null)
    if (row.status === 'verified') dataNotes.push(row)
  }

  // Questions: code writes a safe default for each; the model may reword. Extra questions
  // the model proposes must verify like any other row.
  const questions: PlanQuestion[] = []
  for (const seed of questionSeeds(coverage, cfg, goalKey)) {
    const d = drafts.get(rowKey({ section: 'question', tool: null, item: seed.key }))
    if (!d) {
      questions.push({ key: seed.key, tool: seed.tool, text: seed.text, status: 'verified', held_back: null })
      continue
    }
    rowsTotal++
    const c = coverage.find((x) => seed.allow.includes(x.input)) ?? coverage[0]
    const check = checkRow(d.text, d.facts, ctxFor(c), [...toolNames, ...seed.allow])
    for (const f of check.facts) log.push({ ...f, row: `question/${seed.key}` })
    if (check.ok) questions.push({ key: seed.key, tool: seed.tool, text: d.text, status: 'verified', held_back: null })
    else {
      held.push({ row: `question/${seed.key}`, draft_text: d.text, reason: check.reason! })
      questions.push({ key: seed.key, tool: seed.tool, text: seed.text, status: 'verified', held_back: { draft_text: d.text, reason: check.reason! } })
    }
  }
  for (const d of draft?.rows ?? []) {
    if (d.section !== 'question' || !d.item.startsWith('extra')) continue
    // A question about a tool that is not in this plan does not belong in it.
    if (d.tool && !byTool.has(d.tool)) continue
    rowsTotal++
    const c = (d.tool && byTool.get(d.tool)) || coverage[0]
    const check = checkRow(d.text, d.facts, ctxFor(c), toolNames)
    for (const f of check.facts) log.push({ ...f, row: `question/${d.item}` })
    if (check.ok) questions.push({ key: d.item, tool: d.tool && byTool.has(d.tool) ? d.tool : null, text: d.text, status: 'verified', held_back: null })
    else held.push({ row: `question/${d.item}`, draft_text: d.text, reason: check.reason! })
  }

  const verified = log.filter((l) => l.verified).length
  return {
    access,
    custom_sheets: [...sheets.entries()].map(([tool, rows]) => ({ tool, rows })),
    order: orderOut,
    data_notes: dataNotes,
    questions,
    verification: {
      facts_total: log.length,
      facts_verified: verified,
      facts_corrected: log.filter((l) => l.verified && l.corrected_from !== null).length,
      facts_failed: log.length - verified,
      rows_total: rowsTotal,
      rows_held_back: held.length,
      log,
      held,
    },
  }
}
