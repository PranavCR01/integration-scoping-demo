// Builds compact, queryable indexes of the large OpenAPI specs so nothing large is ever
// pasted into a model prompt. For each spec we keep:
//   - the parsed spec (JSON), used by the verifier to walk paths, parameters and schemas
//   - a map from JSON pointer to source line, so every verified fact cites a real line
// Output: generated/index/<basename>.json. Run: npm run index
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { parseDocument, LineCounter, isMap, isSeq, isScalar, type Node } from 'yaml'
import { visit } from 'jsonc-parser'

const OUT_DIR = 'generated/index'

// Subtrees that are large and never cited (examples, prose). Keeping them out keeps the line map small.
const SKIP_KEYS = new Set(['examples', 'example', 'description', 'x-codeSamples', 'summary'])
const MAX_DEPTH = 9

export function escapePtr(seg: string | number): string {
  return String(seg).replace(/~/g, '~0').replace(/\//g, '~1')
}

function keep(path: (string | number)[]): boolean {
  if (path.length > MAX_DEPTH) return false
  if (path.some((p) => typeof p === 'string' && SKIP_KEYS.has(p))) return false
  // Inside operations we only need the operation, its parameters, and its security block.
  // Response and request schemas are cited at their component definition instead.
  if (path[0] === 'paths' && path.length >= 4) {
    const k = path[3]
    if (k !== 'parameters' && k !== 'security' && path[2] !== 'parameters') return false
  }
  if (path[0] === 'components' && path[1] === 'examples') return false
  return true
}

function indexYaml(file: string) {
  const text = readFileSync(file, 'utf8')
  const lc = new LineCounter()
  const doc = parseDocument(text, { lineCounter: lc, keepSourceTokens: false, uniqueKeys: false })
  const lines: Record<string, number> = {}
  const walk = (node: Node | null | undefined, path: (string | number)[]) => {
    if (!node) return
    if (isMap(node)) {
      for (const pair of node.items) {
        const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key)
        const p = [...path, key]
        if (!keep(p)) continue
        const off = (pair.key as Node)?.range?.[0]
        if (off !== undefined) lines['/' + p.map(escapePtr).join('/')] = lc.linePos(off).line
        walk(pair.value as Node, p)
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, i) => {
        const p = [...path, i]
        if (!keep(p)) return
        const off = (item as Node)?.range?.[0]
        if (off !== undefined) lines['/' + p.map(escapePtr).join('/')] = lc.linePos(off).line
        walk(item as Node, p)
      })
    }
  }
  walk(doc.contents as Node, [])
  return { spec: doc.toJS({ maxAliasCount: -1 }), lines }
}

function indexJson(file: string) {
  const text = readFileSync(file, 'utf8')
  const lines: Record<string, number> = {}
  const record = (path: (string | number)[], startLine: number) => {
    if (keep(path)) lines['/' + path.map(escapePtr).join('/')] = startLine + 1
  }
  visit(text, {
    onObjectProperty: (property, _o, _l, startLine, _c, pathSupplier) => {
      record([...pathSupplier(), property], startLine)
    },
    onObjectBegin: (_o, _l, startLine, _c, pathSupplier) => {
      const p = pathSupplier()
      // array items: cite the first line inside the object (the "{" line says nothing)
      if (typeof p[p.length - 1] === 'number') record(p, startLine + 1)
      return undefined
    },
    onLiteralValue: (_v, _o, _l, startLine, _c, pathSupplier) => {
      const p = pathSupplier()
      if (typeof p[p.length - 1] === 'number') record(p, startLine)
    },
  })
  return { spec: JSON.parse(text), lines }
}

export function buildIndex(file: string) {
  const out = `${OUT_DIR}/${basename(file)}.json`
  if (existsSync(out) && statSync(out).mtimeMs > statSync(file).mtimeMs && statSync(out).mtimeMs > statSync('scripts/build-index.ts').mtimeMs) {
    return { out, skipped: true }
  }
  const t0 = Date.now()
  const { spec, lines } = file.endsWith('.json') ? indexJson(file) : indexYaml(file)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(out, JSON.stringify({ file, built_from_bytes: statSync(file).size, lines, spec }))
  return { out, skipped: false, ms: Date.now() - t0, pointers: Object.keys(lines).length }
}

const specs = new Set<string>()
const profiles = JSON.parse(readFileSync('config/tool_profiles.json', 'utf8')).profiles
for (const p of Object.values<any>(profiles)) if (p.docs?.spec) specs.add(p.docs.spec)
for (const s of specs) {
  const r = buildIndex(s)
  console.log(r.skipped ? `index up to date: ${r.out}` : `indexed ${s} -> ${r.out} (${r.pointers} pointers, ${r.ms} ms)`)
}
