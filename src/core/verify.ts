// The verifier. Every fact the model writes is checked here against the indexed specs and
// the attached docs. A fact that cannot be found is never shown; its row is held back and
// rendered as "Confirm". Same pattern as Supplier Command Center's citation check.
import type { CanonicalSchema, Fact, FactCheck, FactKind, RowCheck } from './types.js'
import {
  type SpecIndex,
  findPath,
  findResponseField,
  findScopeAnywhere,
  findSecurityScheme,
  findServer,
  getOperation,
  lineFor,
  operationParams,
  operationScopes,
  ptr,
} from './openapi.js'

export interface SourceStore {
  // Lines of any file on record (1-based access via index + 1). Null if not on file.
  lines(file: string): string[] | null
  // Parsed spec + pointer->line map, if the file is an indexed OpenAPI spec.
  spec(file: string): SpecIndex | null
}

export interface VerifyContext {
  store: SourceStore
  // Files registered for this tool in config/tool_profiles.json (spec + docs).
  allowedFiles: string[]
  canonical: CanonicalSchema
  canonicalFile: string
}

// Normalization used for every text comparison: case, whitespace, markdown emphasis,
// backticks, and thousands separators in numbers do not matter. Nothing else is forgiven.
export function norm(s: string): string {
  return s
    .replace(/\*\*|__|`/g, '')
    .replace(/(\d),(\d{3})\b/g, '$1$2')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const NEAR = 3 // a cited line within this distance of the real one counts as correct

function ok(fact: Fact, file: string, line: number | null, detail: string): FactCheck {
  const corrected = line !== null && fact.cite_line !== null && Math.abs(fact.cite_line - line) > NEAR ? fact.cite_line : null
  return { fact, verified: true, failure: null, detail: corrected ? `${detail} (cited line ${fact.cite_line} corrected to ${line})` : detail, file, line, corrected_from: corrected }
}
function fail(fact: Fact, failure: FactCheck['failure'], detail: string): FactCheck {
  return { fact, verified: false, failure, detail, file: null, line: null, corrected_from: null }
}

// Find a quote in a file. Single lines first, then windows of up to 3 joined lines.
export function locateQuote(lines: string[], quote: string, citedLine: number | null): { line: number | null; count: number } {
  const q = norm(quote)
  if (!q) return { line: null, count: 0 }
  const hits: number[] = []
  lines.forEach((l, i) => {
    if (norm(l).includes(q)) hits.push(i + 1)
  })
  if (hits.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      for (const w of [2, 3]) {
        const joined = norm(lines.slice(i, i + w).join(' '))
        if (joined.includes(q)) {
          hits.push(i + 1)
          break
        }
      }
    }
  }
  if (hits.length === 0) return { line: null, count: 0 }
  if (citedLine !== null) {
    const near = hits.find((h) => Math.abs(h - citedLine) <= NEAR)
    if (near) return { line: near, count: hits.length }
  }
  // A real quote cited to the wrong line is bookkeeping, not invention, but only an
  // unambiguous single occurrence can be relocated.
  return { line: hits.length === 1 ? hits[0] : null, count: hits.length }
}

function checkQuote(fact: Fact, lines: string[]): FactCheck {
  if (!fact.quote || !norm(fact.quote)) return fail(fact, 'QUOTE_MISSING', `No quote given for a ${fact.kind} cited to ${fact.cite_file}`)
  const loc = locateQuote(lines, fact.quote, fact.cite_line)
  if (loc.line === null) {
    return fail(
      fact,
      'QUOTE_NOT_IN_SOURCE',
      loc.count > 1 ? `Quote appears ${loc.count} times in ${fact.cite_file} and none is near the cited line` : `Quote not found in ${fact.cite_file}`,
    )
  }
  if (!norm(fact.quote).includes(norm(fact.value))) {
    return fail(fact, 'VALUE_NOT_IN_QUOTE', `"${fact.value}" does not appear in the quoted text`)
  }
  return ok(fact, fact.cite_file, loc.line, `Quoted text found in ${fact.cite_file} line ${loc.line}`)
}

const FORMAT: Partial<Record<FactKind, RegExp>> = {
  version: /\d{4}-\d{2}-\d{2}|YYYY-MM-DD/,
  rate_limit: /\d/,
}

function splitMethodPath(fact: Fact): { method: string; path: string } {
  const m = fact.value.trim().match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)$/i)
  if (m) return { method: m[1].toLowerCase(), path: m[2] }
  return { method: (fact.method ?? 'get').toLowerCase(), path: fact.value.trim() }
}

function checkSpec(fact: Fact, idx: SpecIndex): FactCheck | null {
  const L = (p: string) => lineFor(idx, p)
  const method = (fact.method ?? 'get').toLowerCase()
  switch (fact.kind) {
    case 'endpoint': {
      const { method: m, path } = splitMethodPath(fact)
      const r = getOperation(idx, path, m)
      if (r.error) return fail(fact, r.error, r.error === 'PATH_NOT_IN_SPEC' ? `Path ${path} is not in the spec` : `${m.toUpperCase()} is not defined for ${path}`)
      return ok(fact, idx.file, L(r.pointer), `${m.toUpperCase()} ${r.realPath} found in spec paths`)
    }
    case 'param':
    case 'pagination': {
      if (!fact.path) return fail(fact, 'BAD_FORMAT', 'A parameter must name the endpoint it belongs to')
      const r = operationParams(idx, fact.path, method)
      if (r.error) return fail(fact, r.error, `Endpoint ${method.toUpperCase()} ${fact.path} is not in the spec`)
      const p = r.params.find((x) => x.name === fact.value.trim())
      if (!p) return fail(fact, 'PARAM_NOT_IN_SPEC', `Parameter "${fact.value}" is not defined on ${method.toUpperCase()} ${r.op.realPath}`)
      return ok(fact, idx.file, L(p.pointer), `Parameter ${p.name} (${p.in}) defined on ${method.toUpperCase()} ${r.op.realPath}`)
    }
    case 'field': {
      if (!fact.path) return fail(fact, 'BAD_FORMAT', 'A field must name the endpoint whose response contains it')
      const r = findResponseField(idx, fact.path, method, fact.value.trim())
      if ('error' in r) {
        return fail(fact, r.error as FactCheck['failure'], r.error === 'FIELD_NOT_IN_SPEC' ? `Field "${fact.value}" is not in the ${method.toUpperCase()} ${fact.path} response schema` : `Endpoint ${fact.path} is not in the spec`)
      }
      return ok(fact, idx.file, L(r.pointer), `Field ${fact.value} found in the response schema`)
    }
    case 'scope': {
      if (fact.path) {
        const r = operationScopes(idx, fact.path, method)
        if (r.error) return fail(fact, r.error, `Endpoint ${method.toUpperCase()} ${fact.path} is not in the spec`)
        if (!r.scopes.includes(fact.value.trim())) {
          const anywhere = findScopeAnywhere(idx, fact.value.trim())
          return fail(fact, anywhere ? 'SCOPE_NOT_ON_ENDPOINT' : 'SCOPE_NOT_IN_SPEC', anywhere ? `Scope ${fact.value} exists, but not on ${method.toUpperCase()} ${fact.path} (that endpoint lists: ${Array.from(new Set(r.scopes)).join(', ') || 'none'})` : `Scope ${fact.value} is not in the spec`)
        }
        return ok(fact, idx.file, L(r.pointer), `Scope listed in the security block of ${method.toUpperCase()} ${r.op.realPath}`)
      }
      const p = findScopeAnywhere(idx, fact.value.trim())
      if (!p) return fail(fact, 'SCOPE_NOT_IN_SPEC', `Scope ${fact.value} is not in the spec`)
      return ok(fact, idx.file, L(p), 'Scope found in the spec')
    }
    case 'auth': {
      const p = findSecurityScheme(idx, fact.value, norm)
      if (!p) return fail(fact, 'AUTH_NOT_IN_SPEC', `"${fact.value}" does not match any security scheme in the spec`)
      return ok(fact, idx.file, L(p), 'Matches a security scheme in the spec')
    }
    case 'base_url': {
      const p = findServer(idx, fact.value.trim())
      if (!p) return fail(fact, 'BASE_URL_NOT_IN_SPEC', `${fact.value} is not in the spec servers list`)
      return ok(fact, idx.file, L(p), 'Listed in the spec servers')
    }
    default:
      return null // other kinds need a quote, checked against the file's text
  }
}

export function verifyFact(fact: Fact, ctx: VerifyContext): FactCheck {
  if (FORMAT[fact.kind] && !FORMAT[fact.kind]!.test(fact.value)) {
    return fail(fact, 'BAD_FORMAT', `A ${fact.kind} must look like ${FORMAT[fact.kind]}`)
  }
  if (fact.kind === 'canonical_field') {
    const v = fact.value.replace(/^(asset|finding)\./, '')
    const inAsset = v in ctx.canonical.asset
    const inFinding = v in ctx.canonical.finding
    if (!inAsset && !inFinding) return fail(fact, 'NOT_IN_CANONICAL_SCHEMA', `"${fact.value}" is not a field in ${ctx.canonicalFile}`)
    const lines = ctx.store.lines(ctx.canonicalFile)
    const line = lines ? lines.findIndex((l) => l.includes(`"${v}"`)) + 1 || null : null
    return ok({ ...fact, cite_file: ctx.canonicalFile }, ctx.canonicalFile, line, `Field in our common format (${inAsset ? 'asset' : 'finding'})`)
  }
  const lines = ctx.store.lines(fact.cite_file)
  if (!lines) return fail(fact, 'SOURCE_NOT_ON_FILE', `${fact.cite_file} is not one of the attached sources`)
  if (!ctx.allowedFiles.includes(fact.cite_file)) return fail(fact, 'SOURCE_NOT_FOR_TOOL', `${fact.cite_file} is not registered as documentation for this tool`)

  const idx = ctx.store.spec(fact.cite_file)
  if (idx) {
    const r = checkSpec(fact, idx)
    if (r) return r
  }
  // Prose docs (and spec facts that need prose, like rate limits): the literal must be in the
  // quoted text, and the quoted text must be in the cited file.
  return checkQuote(fact, lines)
}

// ---------- Row-level check: facts plus every code-like token in the wording ----------

// Pull out anything that reads like a technical claim: code spans, URL paths, scopes,
// snake_case names, header names, URLs, dates and numbers.
export function technicalTokens(text: string): string[] {
  const out = new Set<string>()
  const code = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim())
  code.forEach((c) => out.add(c))
  const plain = text.replace(/`[^`]+`/g, ' ')
  const patterns = [
    /https?:\/\/[^\s)]+/g,
    /(?<![\w/])\/[A-Za-z0-9_{}\-.]+(?:\/[A-Za-z0-9_{}\-.]+)*/g,
    /\b[a-z][a-z0-9]*(?:\.[a-z0-9_]+){2,}\b/g,
    /\b[a-z]+_[a-z0-9_]+\b/g,
    /\bX-[A-Za-z-]+\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,3}(?:,\d{3})+\b|\b\d{2,}\b/g,
  ]
  for (const re of patterns) for (const m of plain.matchAll(re)) out.add(m[0].replace(/[.,;:]+$/, ''))
  return [...out].filter(Boolean)
}

export function checkRow(text: string, facts: Fact[], ctx: VerifyContext, allow: string[]): RowCheck {
  const checks = facts.map((f) => verifyFact(f, ctx))
  const failed = checks.filter((c) => !c.verified)
  const support = checks.filter((c) => c.verified).flatMap((c) => [norm(c.fact.value), c.fact.quote ? norm(c.fact.quote) : '', c.fact.path ? norm(c.fact.path) : ''])
  const allowN = allow.map(norm)
  const unsupported = technicalTokens(text).filter((t) => {
    const n = norm(t)
    if (!n) return false
    if (allowN.some((a) => a === n || a.includes(n))) return false
    return !support.some((s) => s && (s === n || s.includes(n)))
  })
  let reason: string | null = null
  if (failed.length) reason = failed.map((f) => f.detail).join('; ')
  else if (unsupported.length) reason = `The wording mentions ${unsupported.map((t) => `"${t}"`).join(', ')}, which no verified source in this row supports`
  return { ok: !reason, facts: checks, unsupported_tokens: unsupported, reason }
}

export { ptr, findPath }
