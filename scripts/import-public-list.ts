// One-time import: turns SAFE's public integrations page capture (sources/01_...) into
// config/integrations.json. Re-run only if the capture changes. The JSON file is the config
// the app reads; SAFE's internal list would replace it in the same format.
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'sources/01_safe_integrations_public_list.md'
const lines = readFileSync(SRC, 'utf8').split('\n')
const start = lines.findIndex((l) => l.startsWith('## All 105 cards'))
const end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
const cards = []
for (let i = start + 1; i < end; i++) {
  const name = lines[i].trim()
  if (name) cards.push({ name, source: { file: SRC, line: i + 1 } })
}
const out = {
  label: 'SAFE public integrations page (captured Nov 4, 2026)',
  source_note:
    'Public page lists 105 cards; SAFE claims 150+. A tool missing here is NOT proof SAFE lacks a connector: it lands in Custom work, confirm with SAFE.',
  integrations: cards,
}
writeFileSync('config/integrations.json', JSON.stringify(out, null, 2) + '\n')
console.log(`wrote ${cards.length} integrations`)
