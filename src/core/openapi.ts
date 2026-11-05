// Minimal OpenAPI walking: operations, parameters, response fields, scopes, security schemes.
// Every lookup returns a JSON pointer so the caller can turn it into a cited line.

export interface SpecIndex {
  file: string
  spec: any
  lines: Record<string, number>
}

export const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

const esc = (s: string | number) => String(s).replace(/~/g, '~0').replace(/\//g, '~1')
export const ptr = (...segs: (string | number)[]) => '/' + segs.map(esc).join('/')

export function lineFor(idx: SpecIndex, pointer: string): number | null {
  let p = pointer
  while (p) {
    if (idx.lines[p] !== undefined) return idx.lines[p]
    const i = p.lastIndexOf('/')
    if (i <= 0) break
    p = p.slice(0, i)
  }
  return null
}

function deref(spec: any, node: any, pointer: string): { node: any; pointer: string } {
  let guard = 0
  while (node && typeof node === 'object' && typeof node.$ref === 'string' && guard++ < 20) {
    const ref: string = node.$ref
    if (!ref.startsWith('#/')) break
    const segs = ref.slice(2).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
    let cur = spec
    for (const s of segs) cur = cur?.[s]
    pointer = '/' + ref.slice(2)
    node = cur
  }
  return { node, pointer }
}

// Normalize "/orgs/{orgId}/issues" vs "/orgs/{org_id}/issues": path templates compare by shape.
const shape = (p: string) => p.replace(/\{[^}]+\}/g, '{}').replace(/\/+$/, '')

export function findPath(idx: SpecIndex, path: string): string | null {
  const paths = idx.spec.paths ?? {}
  if (paths[path]) return path
  const want = shape(path)
  const hits = Object.keys(paths).filter((p) => shape(p) === want)
  return hits.length === 1 ? hits[0] : null
}

export type OpError = { error: 'PATH_NOT_IN_SPEC' | 'METHOD_NOT_IN_SPEC' }
export type Op = { error: null; op: any; item: any; realPath: string; method: string; pointer: string }

export function getOperation(idx: SpecIndex, path: string, method: string): OpError | Op {
  const real = findPath(idx, path)
  if (!real) return { error: 'PATH_NOT_IN_SPEC' }
  const m = method.toLowerCase()
  const item = idx.spec.paths[real]
  if (!item[m]) return { error: 'METHOD_NOT_IN_SPEC' }
  return { error: null, op: item[m], item, realPath: real, method: m, pointer: ptr('paths', real, m) }
}

export type Param = { name: string; in: string; required: boolean; pointer: string }

export function operationParams(idx: SpecIndex, path: string, method: string): OpError | { error: null; params: Param[]; op: Op } {
  const r = getOperation(idx, path, method)
  if (r.error) return r
  const out: Param[] = []
  const add = (list: any[] | undefined, base: string) => {
    ;(list ?? []).forEach((p, i) => {
      const d = deref(idx.spec, p, `${base}/${i}`)
      // cite the parameter where it is used in this operation, unless that line is unknown
      const usePtr = `${base}/${i}`
      if (d.node?.name) out.push({ name: d.node.name, in: d.node.in, required: !!d.node.required, pointer: idx.lines[usePtr] ? usePtr : d.pointer })
    })
  }
  add(r.item.parameters, ptr('paths', r.realPath, 'parameters'))
  add(r.op.parameters, ptr('paths', r.realPath, r.method, 'parameters'))
  return { error: null, params: out, op: r }
}

// Find a field inside the success response schema. Field paths use dots; array levels are
// implicit ("data.attributes.title" and "data.[].attributes.title" are the same).
export function findResponseField(idx: SpecIndex, path: string, method: string, field: string): { pointer: string } | { error: string } {
  const r = getOperation(idx, path, method)
  if (r.error) return { error: r.error }
  const responses = r.op.responses ?? {}
  const code = Object.keys(responses).find((c) => /^2\d\d$/.test(c))
  if (!code) return { error: 'FIELD_NOT_IN_SPEC' }
  const resp = deref(idx.spec, responses[code], ptr('paths', r.realPath, r.method, 'responses', code))
  const content = resp.node?.content ?? {}
  const media = Object.keys(content)[0]
  if (!media) return { error: 'FIELD_NOT_IN_SPEC' }
  const root = { node: content[media].schema, pointer: `${resp.pointer}/content/${esc(media)}/schema` }
  const segs = field.split('.').filter((s) => s && s !== '[]')

  const descend = (n: { node: any; pointer: string }, depth = 0): { node: any; pointer: string }[] => {
    // expand refs, compositions and arrays into the set of object schemas to look in
    if (depth > 12) return []
    const d = deref(idx.spec, n.node, n.pointer)
    if (!d.node || typeof d.node !== 'object') return []
    const out: { node: any; pointer: string }[] = [d]
    for (const k of ['allOf', 'oneOf', 'anyOf'] as const) {
      ;(d.node[k] ?? []).forEach((c: any, i: number) => out.push(...descend({ node: c, pointer: `${d.pointer}/${k}/${i}` }, depth + 1)))
    }
    if (d.node.items) out.push(...descend({ node: d.node.items, pointer: `${d.pointer}/items` }, depth + 1))
    return out
  }

  const walk = (start: { node: any; pointer: string }, rest: string[]): string | null => {
    if (rest.length === 0) return start.pointer
    for (const cand of descend(start)) {
      const props = cand.node.properties
      if (props && props[rest[0]] !== undefined) {
        const next = { node: props[rest[0]], pointer: `${cand.pointer}/properties/${esc(rest[0])}` }
        if (rest.length === 1) return next.pointer
        const hit = walk(next, rest.slice(1))
        if (hit) return hit
      }
    }
    return null
  }

  // Try the schema root, then JSON:API style "data" wrapper (so "attributes.title" works).
  const hit = walk(root, segs) ?? (segs[0] !== 'data' ? walk(root, ['data', ...segs]) : null)
  return hit ? { pointer: hit } : { error: 'FIELD_NOT_IN_SPEC' }
}

export function operationScopes(idx: SpecIndex, path: string, method: string): OpError | { error: null; scopes: string[]; pointer: string; op: Op } {
  const r = getOperation(idx, path, method)
  if (r.error) return r
  const sec = r.op.security ?? idx.spec.security ?? []
  const scopes: string[] = []
  for (const req of sec) for (const v of Object.values<any>(req)) if (Array.isArray(v)) scopes.push(...v)
  return { error: null, scopes, pointer: ptr('paths', r.realPath, r.method, 'security'), op: r }
}

export function findScopeAnywhere(idx: SpecIndex, scope: string): string | null {
  const schemes = idx.spec.components?.securitySchemes ?? {}
  for (const [name, s] of Object.entries<any>(schemes)) {
    for (const [flow, f] of Object.entries<any>(s.flows ?? {})) {
      if (f?.scopes && scope in f.scopes) return ptr('components', 'securitySchemes', name, 'flows', flow, 'scopes', scope)
    }
  }
  for (const [p, item] of Object.entries<any>(idx.spec.paths ?? {})) {
    for (const m of METHODS) {
      const op = item?.[m]
      if (!op?.security) continue
      for (const req of op.security) for (const v of Object.values<any>(req)) if (Array.isArray(v) && v.includes(scope)) return ptr('paths', p, m, 'security')
    }
  }
  return null
}

export function findSecurityScheme(idx: SpecIndex, value: string, norm: (s: string) => string): string | null {
  const schemes = idx.spec.components?.securitySchemes ?? {}
  const v = norm(value)
  for (const [name, s] of Object.entries<any>(schemes)) {
    const texts = [name, s.name, s.scheme, s.description, s.type ? `${s.type}` : ''].filter(Boolean).map((t: string) => norm(t))
    // exact match, or the value appears as whole words in the scheme's text (e.g. "SSWS")
    const wordRe = new RegExp(`(^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`)
    if (texts.some((t) => t === v || (v.length >= 3 && wordRe.test(t)))) return ptr('components', 'securitySchemes', name)
  }
  return null
}

export function findServer(idx: SpecIndex, url: string): string | null {
  const servers: any[] = idx.spec.servers ?? []
  const u = url.replace(/\/+$/, '')
  const i = servers.findIndex((s) => String(s.url).replace(/\/+$/, '') === u)
  return i >= 0 ? ptr('servers', i) : null
}

// Retrieval for prompts: a few GET endpoints whose last fixed segment matches a keyword,
// with their parameters, scopes and top-level response fields. Small by construction.
export function retrieveEndpoints(idx: SpecIndex, keywords: string[], max = 14) {
  const paths = Object.keys(idx.spec.paths ?? {})
  const scored: { path: string; score: number }[] = []
  for (const p of paths) {
    if (!idx.spec.paths[p].get) continue
    const fixed = p.split('/').filter((s) => s && !s.startsWith('{'))
    const last = fixed[fixed.length - 1] ?? ''
    if (!keywords.some((k) => last.toLowerCase() === k.toLowerCase())) continue
    if (p.endsWith('}')) continue // collection endpoints only
    scored.push({ path: p, score: p.split('/').length })
  }
  scored.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path))
  return scored.slice(0, max).map(({ path }) => {
    const params = operationParams(idx, path, 'get')
    const scopes = operationScopes(idx, path, 'get')
    const pList = params.error ? [] : params.params
    return {
      method: 'GET',
      path,
      line: lineFor(idx, ptr('paths', path, 'get')),
      params: pList.map((p) => ({ name: p.name, in: p.in, required: p.required, line: lineFor(idx, p.pointer) })),
      scopes: scopes.error ? [] : Array.from(new Set(scopes.scopes)),
      scopes_line: scopes.error ? null : lineFor(idx, scopes.pointer),
      fields: listResponseFields(idx, path, 'get', 3, 40),
    }
  })
}

export function listResponseFields(idx: SpecIndex, path: string, method: string, maxDepth: number, max: number) {
  const r = getOperation(idx, path, method)
  if (r.error) return []
  const responses = r.op.responses ?? {}
  const code = Object.keys(responses).find((c) => /^2\d\d$/.test(c))
  if (!code) return []
  const resp = deref(idx.spec, responses[code], '')
  const content = resp.node?.content ?? {}
  const media = Object.keys(content)[0]
  if (!media) return []
  const out: { field: string; line: number | null }[] = []
  const seen = new Set<string>()
  const visit = (node: any, pointer: string, prefix: string, depth: number) => {
    if (out.length >= max || depth > maxDepth) return
    const d = deref(idx.spec, node, pointer)
    if (!d.node || typeof d.node !== 'object') return
    for (const k of ['allOf', 'oneOf', 'anyOf'] as const) (d.node[k] ?? []).forEach((c: any, i: number) => visit(c, `${d.pointer}/${k}/${i}`, prefix, depth))
    if (d.node.items) visit(d.node.items, `${d.pointer}/items`, prefix, depth)
    for (const [k, v] of Object.entries<any>(d.node.properties ?? {})) {
      if (k === 'links' || k === 'jsonapi' || k === '_links') continue
      const f = prefix ? `${prefix}.${k}` : k
      const pp = `${d.pointer}/properties/${esc(k)}`
      if (!seen.has(f)) {
        seen.add(f)
        out.push({ field: f, line: lineFor(idx, pp) })
      }
      visit(v, pp, f, depth + 1)
    }
  }
  visit(content[media].schema, '', '', 0)
  return out
}
