// Calls the model once for a customer and saves the draft as the offline fallback, so the
// demo never depends on a live API call. Usage: npm run draft -- halden
import { mkdirSync, writeFileSync } from 'node:fs'
import { checkCoverage } from '../src/core/coverage.js'
import { connectionOrder, pickGoalProfile } from '../src/core/ordering.js'
import { draftWithModel, PROMPT_FILE } from '../src/server/draft.js'
import { savedDraftPath, buildPlan } from '../src/server/plan.js'
import { loadConfig, loadCustomer } from '../src/server/store.js'

const id = process.argv[2] ?? 'halden'
const customer = loadCustomer(id)
const cfg = loadConfig()
const coverage = checkCoverage(customer.tools, cfg)
const order = connectionOrder(coverage, pickGoalProfile(customer.goal, cfg), cfg)
const t0 = Date.now()
const { draft, model, usage } = await draftWithModel(customer, coverage, order, cfg)
console.log(`draft: ${draft.rows.length} rows from ${model} in ${((Date.now() - t0) / 1000).toFixed(0)} s`, usage)
mkdirSync('fixtures/drafts', { recursive: true })
writeFileSync(
  savedDraftPath(id),
  JSON.stringify({ created_at: new Date().toISOString(), model, prompt_file: PROMPT_FILE, customer_id: id, tools: customer.tools, draft }, null, 2) + '\n',
)
const plan = await buildPlan({ customer, draftOverride: draft })
const v = plan.verification
console.log(`verification: ${v.facts_verified}/${v.facts_total} facts verified (${v.facts_corrected} line corrections), ${v.rows_held_back}/${v.rows_total} rows held back`)
for (const h of v.held) console.log(`  HELD ${h.row}: ${h.reason}\n       draft: ${h.draft_text}`)
