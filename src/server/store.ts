// File-system side: loads config files, source documents and spec indexes (cached).
import { existsSync, readFileSync } from 'node:fs'
import { join, normalize as normPath } from 'node:path'
import type { AppConfig, Customer, Excerpt } from '../core/types.js'
import type { SourceStore } from '../core/verify.js'
import type { SpecIndex } from '../core/openapi.js'

export const ROOT = process.env.APP_ROOT ?? process.cwd()

const textCache = new Map<string, string[] | null>()
const specCache = new Map<string, SpecIndex | null>()

function safe(rel: string): string | null {
  const n = normPath(rel).replace(/^(\.\.(\/|\\|$))+/, '')
  if (!/^(sources|config|data|fixtures|prompts)\//.test(n)) return null
  return join(ROOT, n)
}

export const store: SourceStore = {
  lines(file) {
    if (textCache.has(file)) return textCache.get(file)!
    const p = safe(file)
    const v = p && existsSync(p) ? readFileSync(p, 'utf8').split('\n') : null
    textCache.set(file, v)
    return v
  },
  spec(file) {
    if (specCache.has(file)) return specCache.get(file)!
    const base = file.split('/').pop()
    const p = join(ROOT, 'generated/index', `${base}.json`)
    let v: SpecIndex | null = null
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf8'))
      if (raw.file === file) v = { file, spec: raw.spec, lines: raw.lines }
    }
    specCache.set(file, v)
    return v
  },
}

export function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T
}

export const CONFIG_FILES = {
  integrations: 'config/integrations.json',
  matching: 'config/matching.json',
  aliases: 'config/aliases.json',
  tool_profiles: 'config/tool_profiles.json',
  connection_order: 'config/connection_order.json',
  scoping_template: 'config/scoping_template.json',
  canonical_schema: 'config/canonical_schema.json',
  effort_placeholders: 'config/effort_placeholders.json',
} as const

export type ConfigOverrides = Partial<{ [K in keyof AppConfig]: AppConfig[K] }>

// Base config from files; any section can be replaced by an uploaded file of the same shape.
export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  const out: Record<string, unknown> = {}
  for (const [k, f] of Object.entries(CONFIG_FILES)) out[k] = (overrides as Record<string, unknown>)[k] ?? readJson(f)
  return out as unknown as AppConfig
}

export function loadCustomer(id: string): Customer {
  return readJson<Customer>(`config/customers/${id.replace(/[^a-z0-9_-]/gi, '')}.json`)
}

export function excerpt(file: string, line: number, radius = 5): Excerpt | null {
  const lines = store.lines(file)
  if (!lines) return null
  const start = Math.max(1, line - radius)
  const end = Math.min(lines.length, line + radius)
  return { file, start, lines: lines.slice(start - 1, end).map((l) => (l.length > 400 ? l.slice(0, 400) + ' …' : l)), highlight: line }
}
