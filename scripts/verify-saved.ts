// Re-verify the saved draft against current config and sources (no model call).
import { buildPlan } from '../src/server/plan.js'
import { loadCustomer } from '../src/server/store.js'
const plan = await buildPlan({ customer: loadCustomer(process.argv[2] ?? 'halden') })
const v = plan.verification
console.log(plan.draft_note)
console.log(`verification: ${v.facts_verified}/${v.facts_total} facts verified (${v.facts_corrected} line corrections), ${v.rows_held_back}/${v.rows_total} rows held back`)
for (const h of v.held) console.log(`  HELD ${h.row}: ${h.reason}\n       draft: ${h.draft_text}`)
if (process.argv.includes('--log')) for (const l of v.log) console.log(l.verified ? (l.corrected_from ? 'CORR' : 'OK  ') : 'FAIL', l.row, l.fact.kind, l.fact.value, l.fact.cite_line, '->', l.line, l.verified ? '' : l.detail)
