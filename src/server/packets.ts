// Evidence packets: the small, line-numbered slices of each tool's docs that the model may
// cite. Large specs are never pasted; code retrieves a handful of endpoints from the index.
import type { AppConfig, CoverageResult } from '../core/types.js'
import { docsFor } from '../core/plan.js'
import { lineFor, ptr, retrieveEndpoints } from '../core/openapi.js'
import { store } from './store.js'

const MAX_DOC_CHARS = 20000

function numbered(file: string, ranges?: [number, number][]): string {
  const lines = store.lines(file) ?? []
  const take = ranges?.length ? ranges : [[1, lines.length] as [number, number]]
  const out: string[] = []
  for (const [a, b] of take) {
    for (let i = a; i <= Math.min(b, lines.length); i++) out.push(`${i}: ${lines[i - 1]}`)
  }
  const s = out.join('\n')
  return s.length > MAX_DOC_CHARS ? s.slice(0, MAX_DOC_CHARS) + '\n[... truncated ...]' : s
}

export function toolPacket(c: CoverageResult, cfg: AppConfig): string | null {
  const docs = docsFor(c, cfg)
  if (!docs) return null
  const parts: string[] = [`### Sources for ${c.tool_key} (${docs.label})`]
  for (const f of docs.files) {
    parts.push(`#### FILE ${f.file}${f.include_lines ? ` (excerpt: lines ${f.include_lines.map((r) => r.join('-')).join(', ')})` : ''}\n${numbered(f.file, f.include_lines)}`)
  }
  if (docs.spec) {
    const idx = store.spec(docs.spec)
    if (idx) {
      const schemes = Object.entries<any>(idx.spec.components?.securitySchemes ?? {}).map(([name, s]) => {
        const scopes = Object.values<any>(s.flows ?? {}).flatMap((f: any) => Object.keys(f.scopes ?? {}))
        return { name, line: lineFor(idx, ptr('components', 'securitySchemes', name)), type: s.type, scheme: s.scheme, in: s.in, header_name: s.name, description: String(s.description ?? '').slice(0, 300), flow_scopes_count: scopes.length }
      })
      const servers = (idx.spec.servers ?? []).map((s: any, i: number) => ({ url: s.url, line: lineFor(idx, ptr('servers', i)) }))
      const keywords = docs.retrieval_keywords?.length ? docs.retrieval_keywords : cfg.scoping_template.retrieval_default_keywords
      const endpoints = retrieveEndpoints(idx, keywords)
      parts.push(
        `#### SPEC ${docs.spec} (indexed; retrieved by code, not the full spec)\n` +
          JSON.stringify({ info_version: idx.spec.info?.version, servers, security_schemes: schemes, retrieved_endpoints: endpoints }, null, 1),
      )
    }
  }
  return parts.join('\n\n')
}
