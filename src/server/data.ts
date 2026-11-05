// Loads a customer's exports (synthetic for Halden, or uploaded), checks the field mappings
// against the docs, and runs the data checks.
import type { Customer } from '../core/types.js'
import { analyze, type DataReport, type DataRules, type MatchRules, type SourceMapping } from '../core/data.js'
import { verifyFact } from '../core/verify.js'
import { allowedFiles } from '../core/plan.js'
import { matchTool } from '../core/coverage.js'
import { excerpt, loadConfig, readJson, store, type ConfigOverrides } from './store.js'

export interface DataOptions {
  customer: Customer
  uploads?: Record<string, Record<string, unknown>[]>
  decisions?: Record<string, 'same' | 'different'>
  overrides?: ConfigOverrides & { source_mappings?: { sources: Record<string, SourceMapping> }; match_rules?: MatchRules; data_rules?: DataRules }
}

export function mappingChecks(mappings: Record<string, SourceMapping>, overrides?: ConfigOverrides): DataReport['mapping'] {
  const cfg = loadConfig(overrides)
  const out: DataReport['mapping'] = []
  for (const [src, m] of Object.entries(mappings)) {
    const cov = matchTool(m.tool, cfg)
    const ctx = { store, allowedFiles: allowedFiles(cov, cfg), canonical: cfg.canonical_schema, canonicalFile: 'config/canonical_schema.json' }
    for (const f of m.fields) {
      if (!f.verify) {
        out.push({ source: src, canonical: f.canonical, from: f.from, status: 'placeholder', citation: null, detail: 'Confirm: placeholder field name. The attached docs do not document this export field.' })
        continue
      }
      const r = verifyFact(
        { kind: f.verify.kind as any, value: f.verify.value, method: 'get', path: f.verify.path ?? null, cite_file: f.verify.cite_file, cite_line: f.verify.cite_line ?? null, quote: f.verify.quote ?? null },
        ctx,
      )
      out.push({
        source: src,
        canonical: f.canonical,
        from: f.from,
        status: r.verified ? 'verified' : 'failed',
        citation: r.verified && r.file && r.line ? { file: r.file, line: r.line } : null,
        detail: r.detail,
      })
    }
  }
  return out
}

export function runData(opts: DataOptions): DataReport {
  const dir = opts.customer.data_dir
  const mappings = (opts.overrides?.source_mappings ?? readJson<{ sources: Record<string, SourceMapping> }>('config/source_mappings.json')).sources
  const match = opts.overrides?.match_rules ?? readJson<MatchRules>('config/match_rules.json')
  const rules = opts.overrides?.data_rules ?? readJson<DataRules>('config/data_rules.json')
  const meta = dir ? readJson<{ as_of: string; synthetic: boolean }>(`${dir}/meta.json`) : { as_of: new Date().toISOString(), synthetic: false }
  const rows: Record<string, Record<string, unknown>[]> = {}
  for (const [src, m] of Object.entries(mappings)) {
    if (opts.uploads?.[src]) rows[src] = opts.uploads[src]
    else if (dir) {
      try {
        rows[src] = readJson(`${dir}/${m.file}`)
      } catch {
        rows[src] = []
      }
    }
  }
  const consoleCounts = dir ? readJson<Record<string, number>>(`${dir}/console_counts.json`) : {}
  // Console counts describe the synthetic exports; an uploaded file has no console figure yet.
  for (const k of Object.keys(opts.uploads ?? {})) delete consoleCounts[k]
  const report = analyze({
    as_of: meta.as_of,
    synthetic: meta.synthetic && !Object.keys(opts.uploads ?? {}).length,
    mappings,
    rows,
    console_counts: consoleCounts,
    uploaded: Object.keys(opts.uploads ?? {}),
    match,
    rules,
    mapping_checks: mappingChecks(mappings, opts.overrides),
    decisions: opts.decisions,
  })
  report.excerpts = {}
  for (const m of report.mapping) {
    if (!m.citation) continue
    const e = excerpt(m.citation.file, m.citation.line)
    if (e) report.excerpts[`${m.citation.file}#L${m.citation.line}`] = e
  }
  return report
}
