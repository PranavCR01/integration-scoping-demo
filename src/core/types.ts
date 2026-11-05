// Shared types. Everything in src/core is pure (no file system), so the browser can use it too.

export type Bucket = 'out_of_box' | 'confirm_with_safe' | 'custom_work'

export const BUCKET_LABEL: Record<Bucket, string> = {
  out_of_box: 'Out of the box',
  confirm_with_safe: 'Confirm with SAFE',
  custom_work: 'Custom work',
}

export interface IntegrationCard {
  name: string
  source?: { file: string; line: number }
}

export interface IntegrationsConfig {
  label: string
  source_note?: string
  integrations: IntegrationCard[]
}

export interface MatchingConfig {
  stopwords: string[]
  ignore_variant_suffixes: string[]
  bare_name_max_tokens: number
}

export interface AliasesConfig {
  aliases: { say: string; means: string }[]
}

export interface ToolDocs {
  spec: string | null
  files: { file: string; include_lines?: [number, number][] }[]
  retrieval_keywords?: string[]
  label: string
}

export interface ToolProfile {
  role: string
  owner: string
  docs?: ToolDocs
}

export interface ToolProfilesConfig {
  default_owner: string
  profiles: Record<string, ToolProfile>
  family_profiles: Record<string, { role: string; owner: string } | string>
}

export interface OrderStepRule {
  step: number
  roles: string[]
  unlocks: string
}

export interface ConnectionOrderConfig {
  goal_profiles: Record<string, { label: string; match_keywords: string[]; steps: OrderStepRule[] }>
  gates: Record<Bucket, string | null>
  role_labels: Record<string, string>
}

export interface TemplateItem {
  key: string
  label: string
  expects?: FactKind[]
  always_confirm?: string
}

export interface ScopingTemplate {
  document: { title_prefix: string; status: string; footer: string; oob_access_note: string }
  access_items: TemplateItem[]
  custom_sheet_items: TemplateItem[]
  data_checks: { key: string; label: string; text: string }[]
  retrieval_default_keywords: string[]
  standard_questions: { key: string; text: string }[]
}

export type CanonicalSchema = { asset: Record<string, string>; finding: Record<string, string> }

export interface EffortPlaceholders {
  label: string
  by_bucket: Record<Bucket, string>
}

export interface Customer {
  id: string
  name: string
  fictional: true
  goal: string
  tools: string[]
  data_dir?: string
}

export interface AppConfig {
  integrations: IntegrationsConfig
  matching: MatchingConfig
  aliases: AliasesConfig
  tool_profiles: ToolProfilesConfig
  connection_order: ConnectionOrderConfig
  scoping_template: ScopingTemplate
  canonical_schema: CanonicalSchema
  effort_placeholders: EffortPlaceholders
}

// ---------- Coverage ----------

export interface CoverageResult {
  input: string
  bucket: Bucket
  matched_card: string | null
  // canonical name used for profile lookup (card name, or the customer's name for custom work)
  tool_key: string
  rule: 'exact' | 'alias' | 'bare_vendor_name' | 'partial' | 'no_match'
  why: string
  candidates: string[]
  variants: string[]
  evidence: { file: string; line: number }[]
}

// ---------- Facts and verification ----------

export type FactKind =
  | 'endpoint'
  | 'param'
  | 'field'
  | 'scope'
  | 'auth'
  | 'base_url'
  | 'version'
  | 'pagination'
  | 'rate_limit'
  | 'permission'
  | 'canonical_field'
  | 'doc'

export const FACT_KINDS: FactKind[] = [
  'endpoint', 'param', 'field', 'scope', 'auth', 'base_url', 'version', 'pagination', 'rate_limit', 'permission', 'canonical_field', 'doc',
]

// What the model claims. Every fact names a literal value and where it comes from.
export interface Fact {
  kind: FactKind
  value: string
  method: string | null
  path: string | null
  cite_file: string
  cite_line: number | null
  quote: string | null
}

export type FactFailure =
  | 'SOURCE_NOT_ON_FILE'
  | 'SOURCE_NOT_FOR_TOOL'
  | 'PATH_NOT_IN_SPEC'
  | 'METHOD_NOT_IN_SPEC'
  | 'PARAM_NOT_IN_SPEC'
  | 'FIELD_NOT_IN_SPEC'
  | 'SCOPE_NOT_IN_SPEC'
  | 'SCOPE_NOT_ON_ENDPOINT'
  | 'AUTH_NOT_IN_SPEC'
  | 'BASE_URL_NOT_IN_SPEC'
  | 'QUOTE_MISSING'
  | 'QUOTE_NOT_IN_SOURCE'
  | 'VALUE_NOT_IN_QUOTE'
  | 'NOT_IN_CANONICAL_SCHEMA'
  | 'BAD_FORMAT'

export interface FactCheck {
  fact: Fact
  verified: boolean
  failure: FactFailure | null
  detail: string
  // where the code found it (may differ from the claimed line: "location corrected")
  file: string | null
  line: number | null
  corrected_from: number | null
}

export interface RowCheck {
  ok: boolean
  facts: FactCheck[]
  unsupported_tokens: string[]
  reason: string | null
}

// ---------- Draft (what the model returns) ----------

export type DraftSection = 'access' | 'custom_sheet' | 'order' | 'data_note' | 'question'

export interface DraftRow {
  section: DraftSection
  tool: string | null
  item: string
  text: string
  facts: Fact[]
}

export interface Draft {
  rows: DraftRow[]
}

// ---------- Plan output ----------

export interface Excerpt {
  file: string
  start: number
  lines: string[]
  highlight: number
}

export interface PlanRow {
  section: DraftSection
  tool: string | null
  item: string
  label: string
  status: 'verified' | 'confirm'
  text: string
  confirm_reason: string | null
  held_back: { draft_text: string; reason: string } | null
  citations: { file: string; line: number; kind: FactKind; value: string; corrected_from: number | null }[]
}

export interface OrderStep {
  step: number
  tools: { input: string; tool_key: string; bucket: Bucket; role: string }[]
  unlocks: string
  gate: string | null
}

export interface PlanQuestion {
  key: string
  text: string
  status: 'verified' | 'confirm'
  held_back: { draft_text: string; reason: string } | null
}

export interface VerificationSummary {
  facts_total: number
  facts_verified: number
  facts_corrected: number
  facts_failed: number
  rows_total: number
  rows_held_back: number
  log: (FactCheck & { row: string })[]
  held: { row: string; draft_text: string; reason: string }[]
}

export interface Plan {
  document: ScopingTemplate['document']
  customer: Customer
  generated_at: string
  config_label: string
  goal_profile: string
  draft_source: 'live' | 'cached' | 'none'
  draft_note: string
  model: string | null
  coverage: CoverageResult[]
  order: OrderStep[]
  access: { tool: string; input: string; bucket: Bucket; owner: string; docs_label: string | null; rows: PlanRow[] }[]
  custom_sheets: { tool: string; rows: PlanRow[] }[]
  data_checks: { key: string; label: string; text: string }[]
  data_notes: PlanRow[]
  questions: PlanQuestion[]
  verification: VerificationSummary
  excerpts: Record<string, Excerpt>
  effort: { label: string; rows: { tool: string; bucket: Bucket; value: string }[] }
}

export const excerptKey = (file: string, line: number) => `${file}#L${line}`
