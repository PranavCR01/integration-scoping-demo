// Writes the customer plan and internal handoff for a customer to docs/sample/ (no model call).
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildPlan } from '../src/server/plan.js'
import { runData } from '../src/server/data.js'
import { loadConfig, loadCustomer, readJson } from '../src/server/store.js'
import { handoffBlocks, planBlocks, toMarkdown } from '../src/core/doc.js'
const customer = loadCustomer(process.argv[2] ?? 'halden')
const cfg = loadConfig()
const labels = readJson<{ files: Record<string, string> }>('config/sources.json').files
const plan = await buildPlan({ customer })
const data = runData({ customer })
const d = cfg.scoping_template.document
mkdirSync('docs/sample', { recursive: true })
writeFileSync(`docs/sample/${customer.id}-scoping-plan.md`, toMarkdown(planBlocks(plan, labels, d.oob_access_note, d.footer, d.title_prefix, d.status, data)))
writeFileSync(`docs/sample/${customer.id}-internal-handoff.md`, toMarkdown(handoffBlocks(plan, data, labels)))
console.log('wrote docs/sample/')
