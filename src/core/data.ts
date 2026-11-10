// Data normalization, duplicate detection and pre-risk checks. Pure code, driven entirely
// by config/source_mappings.json, config/match_rules.json and config/data_rules.json.

export interface MappingField {
  canonical: string
  from: string
  transform?: 'first' | 'list'
  verify?: { kind: string; cite_file: string; cite_line?: number; quote?: string; path?: string; value: string }
}
export interface SourceMapping {
  label: string
  short?: string
  tool: string
  entity: 'asset' | 'finding'
  file: string
  fields: MappingField[]
}
export interface MatchRule {
  key: string
  label: string
  match: [string, string][]
  confidence: number
}
export interface MatchRules {
  merge_threshold: number
  rules: MatchRule[]
  conflict_keys: string[]
}
export interface DataRules {
  hostname: { strip_domain: boolean; lowercase: boolean }
  stale_after_days: { value: number; placeholder: boolean; note: string }
  scan_recent_days: { value: number; placeholder: boolean; note: string }
  coverage: { population_sources: string[]; edr_sources: string[]; scan_sources: string[]; note: string }
  readiness: { check: string; level: 'block' | 'warn'; text: string; ok_text?: string; below?: number; placeholder?: boolean }[]
}

export interface AssetRecord {
  key: string
  source: string
  source_id: string
  hostname: string | null
  fqdn: string | null
  display_name: string | null
  ipv4: string[]
  mac: string[]
  cloud_instance_id: string | null
  serial_number: string | null
  os: string | null
  last_seen: string | null
  raw: Record<string, unknown>
}

export interface FindingRecord {
  key: string
  source: string
  finding_id: string
  asset_ref: string
  title: string | null
  severity: string | null
  status: string | null
}

export interface MatchEdge {
  a: string
  b: string
  rule: string
  label: string
  confidence: number
  shared: string
  override?: string // a person merged these although this evidence says they differ
}

export interface MergedAsset {
  asset_id: string
  records: AssetRecord[]
  sources: string[]
  hostname: string | null
  names: string[]
  last_seen: string | null
  confidence: number
  reasons: MatchEdge[]
  same_tool_duplicates: string[]
  findings: number
  overrides: string[] // conflicting evidence a person chose to merge past
}

export interface ReviewItem {
  pair: [string, string]
  a: { asset_id: string; label: string }
  b: { asset_id: string; label: string }
  rule: string
  label: string
  confidence: number
  shared: string
  why: string
  conflict: string | null // evidence that says these are different machines; merging needs a second confirmation
}

export interface CheckResult {
  check: string
  level: 'block' | 'warn' | 'ok'
  text: string
  detail: string
}

export interface DataReport {
  excerpts?: Record<string, { file: string; start: number; lines: string[]; highlight: number }>
  as_of: string
  synthetic: boolean
  sources: { key: string; label: string; short: string; entity: 'asset' | 'finding'; tool: string; records: number; console: number | null; mismatch: boolean; uploaded: boolean; in_scope: boolean }[]
  mapping: { source: string; canonical: string; from: string; status: 'verified' | 'placeholder' | 'failed'; citation: { file: string; line: number } | null; detail: string }[]
  decisions_applied: number
  totals: { asset_records: number; merged_assets: number; cross_tool_merges: number; same_tool_duplicates: number; review: number; stale: number; identity_only: number; orphans: number; findings: number }
  assets: MergedAsset[]
  review: ReviewItem[]
  stale: { asset_id: string; hostname: string | null; last_seen: string | null; days: number; sources: string[] }[]
  coverage: { population: number; with_edr: number; scanned_recently: number; no_edr: { asset_id: string; hostname: string | null; sources: string[] }[]; no_edr_pending: { asset_id: string; hostname: string | null; sources: string[] }[]; not_scanned: { asset_id: string; hostname: string | null; sources: string[] }[]; identity_only: { asset_id: string; label: string }[] }
  orphans: { finding_id: string; asset_ref: string; source: string }[]
  checks: CheckResult[]
  ready: boolean
  settings: { stale_after_days: number; scan_recent_days: number; merge_threshold: number; placeholders: string[] }
}

// ---------- mapping ----------

export function getPath(obj: any, path: string): unknown {
  if (obj == null) return undefined
  if (path in obj) return obj[path]
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

const asList = (v: unknown): string[] => {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return v.map(String).filter(Boolean)
  return String(v)
    .split(/[;,|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}
const asOne = (v: unknown): string | null => {
  const l = asList(v)
  return l.length ? l[0] : null
}

export function normHost(h: string | null, rules: DataRules): string | null {
  if (!h) return null
  let s = h.trim()
  if (rules.hostname.lowercase) s = s.toLowerCase()
  if (rules.hostname.strip_domain && !/^\d+\.\d+\.\d+\.\d+$/.test(s)) s = s.split('.')[0]
  return s || null
}
const normMac = (m: string) => m.toLowerCase().replace(/[^0-9a-f]/g, '').replace(/(..)(?!$)/g, '$1:')

export function mapAsset(source: string, m: SourceMapping, row: Record<string, unknown>, rules: DataRules): AssetRecord {
  const got: Record<string, unknown> = {}
  for (const f of m.fields) {
    const v = getPath(row, f.from)
    got[f.canonical] = f.transform === 'list' ? asList(v) : f.transform === 'first' ? asOne(v) : v ?? null
  }
  const fqdn = (got.fqdn as string) ?? null
  const host = (got.hostname as string) ?? fqdn
  const id = String(got.source_id ?? '')
  return {
    key: `${source}:${id}`,
    source,
    source_id: id,
    hostname: normHost(host, rules),
    fqdn,
    display_name: got.display_name ? String(got.display_name).trim().toLowerCase() : null,
    ipv4: asList(got.ipv4),
    mac: asList(got.mac).map(normMac),
    cloud_instance_id: got.cloud_instance_id ? String(got.cloud_instance_id) : null,
    serial_number: got.serial_number ? String(got.serial_number).toUpperCase() : null,
    os: got.os ? String(got.os) : null,
    last_seen: got.last_seen ? String(got.last_seen) : null,
    raw: row,
  }
}

export function mapFinding(source: string, m: SourceMapping, row: Record<string, unknown>): FindingRecord {
  const g = (c: string) => {
    const f = m.fields.find((x) => x.canonical === c)
    const v = f ? getPath(row, f.from) : undefined
    return v == null ? null : String(v)
  }
  const id = g('finding_id') ?? ''
  return { key: `${source}:${id}`, source, finding_id: id, asset_ref: g('asset_ref') ?? '', title: g('title'), severity: g('severity'), status: g('status') }
}

// ---------- matching ----------

const values = (r: AssetRecord, field: string): string[] => {
  const v = (r as any)[field]
  if (Array.isArray(v)) return v
  return v ? [String(v)] : []
}

function bestRule(a: AssetRecord, b: AssetRecord, rules: MatchRules): { rule: MatchRule; shared: string } | null {
  for (const rule of [...rules.rules].sort((x, y) => y.confidence - x.confidence)) {
    const sharedParts: string[] = []
    const holds = (x: AssetRecord, y: AssetRecord) =>
      rule.match.every(([fa, fb]) => {
        const hit = values(x, fa).find((v) => values(y, fb).includes(v))
        if (hit) sharedParts.push(`${fa}=${hit}`)
        return !!hit
      })
    if (holds(a, b) || (sharedParts.splice(0), holds(b, a))) return { rule, shared: sharedParts.join(', ') }
  }
  return null
}

const KEY_LABEL: Record<string, string> = { cloud_instance_id: 'cloud instance IDs', serial_number: 'serial numbers', mac: 'MAC addresses' }

function conflictBetween(ka: Map<string, Set<string>>, kb: Map<string, Set<string>>, keys: string[]): string | null {
  for (const k of keys) {
    const A = ka.get(k)
    const B = kb.get(k)
    if (A?.size && B?.size && ![...A].some((v) => B.has(v))) return `different ${KEY_LABEL[k] ?? k.replace(/_/g, ' ') + 's'} (${[...A].join(' / ')} vs ${[...B].join(' / ')})`
  }
  return null
}

export interface DataInput {
  as_of: string
  synthetic: boolean
  mappings: Record<string, SourceMapping>
  rows: Record<string, Record<string, unknown>[]>
  console_counts: Record<string, number>
  uploaded?: string[]
  match: MatchRules
  rules: DataRules
  mapping_checks?: DataReport['mapping']
  // A person's decisions on review items, keyed by the two record keys "a|b" (sorted).
  decisions?: Record<string, 'same' | 'different'>
  // Sources whose tool the customer's goal needs. Problems in other sources are shown as
  // warnings, not blockers. Undefined: every source counts.
  in_scope_sources?: string[]
}

export function analyze(input: DataInput): DataReport {
  const { mappings, rows, match, rules } = input
  const records: AssetRecord[] = []
  const findings: FindingRecord[] = []
  for (const [src, m] of Object.entries(mappings)) {
    for (const row of rows[src] ?? []) {
      if (m.entity === 'asset') records.push(mapAsset(src, m, row, rules))
      else findings.push(mapFinding(src, m, row))
    }
  }

  // Candidate pairs: any two records sharing a value in any field a rule looks at.
  const fields = new Set(match.rules.flatMap((r) => r.match.flat()))
  const block = new Map<string, number[]>()
  records.forEach((r, i) => {
    for (const f of fields) for (const v of values(r, f)) {
      const k = `${v}`
      if (!block.has(k)) block.set(k, [])
      block.get(k)!.push(i)
    }
  })
  const seen = new Set<string>()
  const edges: (MatchEdge & { i: number; j: number })[] = []
  for (const idxs of block.values()) {
    for (let x = 0; x < idxs.length; x++) for (let y = x + 1; y < idxs.length; y++) {
      const [i, j] = idxs[x] < idxs[y] ? [idxs[x], idxs[y]] : [idxs[y], idxs[x]]
      if (i === j || seen.has(`${i}|${j}`)) continue
      seen.add(`${i}|${j}`)
      const best = bestRule(records[i], records[j], match)
      if (best) edges.push({ i, j, a: records[i].key, b: records[j].key, rule: best.rule.key, label: best.rule.label, confidence: best.rule.confidence, shared: best.shared })
    }
  }
  edges.sort((p, q) => q.confidence - p.confidence || p.a.localeCompare(q.a) || p.b.localeCompare(q.b))

  // A person's "same machine" decision becomes a merge edge that outranks every rule.
  const indexOf = new Map(records.map((r, i) => [r.key, i]))
  const decisions = Object.entries(input.decisions ?? {})
  for (const [k, d] of decisions) {
    if (d !== 'same') continue
    const [a, b] = k.split('|')
    const i = indexOf.get(a)
    const j = indexOf.get(b)
    if (i === undefined || j === undefined) continue
    edges.unshift({ i, j, a, b, rule: 'person', label: 'A person confirmed: same machine', confidence: 1, shared: 'reviewed' })
  }
  const different = decisions.filter(([, d]) => d === 'different').map(([k]) => k.split('|') as [string, string])

  // Union-find with cluster-level conflict keys (e.g. two different instance IDs never merge).
  const parent = records.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const keysOf = new Map<number, Map<string, Set<string>>>()
  records.forEach((r, i) => {
    const m = new Map<string, Set<string>>()
    for (const k of match.conflict_keys) m.set(k, new Set(values(r, k)))
    keysOf.set(i, m)
  })
  const used: typeof edges = []
  const blocked: { e: (typeof edges)[number]; why: string }[] = []
  const weak: typeof edges = []
  for (const e of edges) {
    const ri = find(e.i)
    const rj = find(e.j)
    if (ri === rj) continue
    if (e.rule !== 'person' && e.confidence < match.merge_threshold) {
      weak.push(e)
      continue
    }
    const c = conflictBetween(keysOf.get(ri)!, keysOf.get(rj)!, match.conflict_keys)
    if (c && e.rule === 'person') {
      // The person's decision stands, but the merge keeps a visible record of what it overrode.
      e.override = c
      e.label = `A person merged these despite ${c}`
    } else if (c) {
      blocked.push({ e, why: `Not merged: ${c}` })
      continue
    }
    parent[rj] = ri
    const merged = keysOf.get(ri)!
    for (const [k, s] of keysOf.get(rj)!) for (const v of s) merged.get(k)!.add(v)
    used.push(e)
  }

  // Build merged assets
  const groups = new Map<number, number[]>()
  records.forEach((_, i) => {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(i)
  })
  const findingCount = new Map<string, number>()
  for (const f of findings) findingCount.set(f.asset_ref, (findingCount.get(f.asset_ref) ?? 0) + 1)
  const sorted = [...groups.values()].sort((a, b) => {
    const ha = records[a[0]].hostname ?? records[a[0]].display_name ?? ''
    const hb = records[b[0]].hostname ?? records[b[0]].display_name ?? ''
    return ha.localeCompare(hb)
  })
  const assetOf = new Map<string, string>()
  const assets: MergedAsset[] = sorted.map((g, n) => {
    const recs = g.map((i) => records[i])
    const id = `A${String(n + 1).padStart(3, '0')}`
    recs.forEach((r) => assetOf.set(r.key, id))
    const reasons = used.filter((e) => g.includes(e.i)).map(({ i, j, ...e }) => e)
    const bySource = new Map<string, number>()
    recs.forEach((r) => bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1))
    const hosts = recs.map((r) => r.hostname).filter(Boolean) as string[]
    const last = recs.map((r) => r.last_seen).filter(Boolean).sort().pop() ?? null
    return {
      asset_id: id,
      records: recs,
      sources: [...bySource.keys()].sort(),
      hostname: hosts[0] ?? recs.find((r) => r.display_name)?.display_name ?? null,
      names: Array.from(new Set([...hosts, ...(recs.map((r) => r.display_name).filter(Boolean) as string[])])),
      last_seen: last,
      confidence: reasons.length ? Math.min(...reasons.map((r) => r.confidence)) : 1,
      reasons,
      same_tool_duplicates: [...bySource.entries()].filter(([, c]) => c > 1).map(([s]) => s),
      overrides: reasons.filter((r) => r.override).map((r) => r.override!),
      findings: recs.reduce((s, r) => s + (findingCount.get(r.source_id) ?? 0), 0),
    }
  })
  const assetById = new Map(assets.map((a) => [a.asset_id, a]))
  const label = (id: string) => {
    const a = assetById.get(id)!
    return `${a.names.join(' / ') || a.asset_id} (${a.sources.map((s) => mappings[s]?.short ?? s).join(', ')})`
  }

  // Review queue: weak matches and blocked conflicts between assets that remain separate.
  const reviewMap = new Map<string, ReviewItem>()
  const addReview = (e: MatchEdge, why: string, conflict: string | null) => {
    const A = assetOf.get(e.a)!
    const B = assetOf.get(e.b)!
    if (A === B) return
    const k = [A, B].sort().join('|')
    // A person already said these are different machines.
    const inA = (key: string) => assetOf.get(key) === A
    const inB = (key: string) => assetOf.get(key) === B
    if (different.some(([x, y]) => (inA(x) && inB(y)) || (inA(y) && inB(x)))) return
    const prev = reviewMap.get(k)
    if (prev && prev.confidence >= e.confidence) return
    reviewMap.set(k, { pair: [e.a, e.b].sort() as [string, string], a: { asset_id: A, label: label(A) }, b: { asset_id: B, label: label(B) }, rule: e.rule, label: e.label, confidence: e.confidence, shared: e.shared, why, conflict })
  }
  for (const w of weak) {
    const c = conflictBetween(keysOf.get(find(w.i))!, keysOf.get(find(w.j))!, match.conflict_keys)
    addReview(w, c ? `Weak match, and the records have ${c}: likely different machines. A person decides.` : `Below the merge threshold (${match.merge_threshold}). A person decides.`, c)
  }
  for (const b of blocked) addReview(b.e, b.why, b.why.replace(/^Not merged: /, ''))
  const review = [...reviewMap.values()].sort((a, b) => b.confidence - a.confidence)

  // Staleness and coverage
  const asOf = Date.parse(input.as_of)
  const daysSince = (t: string | null) => (t ? Math.floor((asOf - Date.parse(t)) / 86400000) : Infinity)
  const staleDays = rules.stale_after_days.value
  const stale = assets
    .filter((a) => daysSince(a.last_seen) > staleDays)
    .map((a) => ({ asset_id: a.asset_id, hostname: a.hostname, last_seen: a.last_seen, days: daysSince(a.last_seen), sources: a.sources }))
  const staleIds = new Set(stale.map((s) => s.asset_id))
  const cov = rules.coverage
  const population = assets.filter((a) => a.sources.some((s) => cov.population_sources.includes(s)) && !staleIds.has(a.asset_id))
  const hasEdr = (a: MergedAsset) => a.records.some((r) => cov.edr_sources.includes(r.source))
  const scannedRecently = (a: MergedAsset) => a.records.some((r) => cov.scan_sources.includes(r.source) && daysSince(r.last_seen) <= rules.scan_recent_days.value)
  const identityOnly = assets.filter((a) => !a.sources.some((s) => cov.population_sources.includes(s)))

  // Orphan findings: point to an asset id that no asset export contains.
  const knownIds = new Set(records.map((r) => r.source_id))
  const orphans = findings.filter((f) => !knownIds.has(f.asset_ref)).map((f) => ({ finding_id: f.finding_id, asset_ref: f.asset_ref, source: f.source }))

  const inScopeSrc = (src: string) => !input.in_scope_sources || input.in_scope_sources.includes(src)
  const sources = Object.entries(mappings).map(([key, m]) => {
    const n = (rows[key] ?? []).length
    const c = input.console_counts[key]
    return { key, label: m.label, short: m.short ?? m.tool, entity: m.entity, tool: m.tool, records: n, console: c ?? null, mismatch: c !== undefined && c !== n, uploaded: (input.uploaded ?? []).includes(key), in_scope: inScopeSrc(key) }
  })

  const inReview = new Set(review.flatMap((x) => [x.a.asset_id, x.b.asset_id]))
  const edrShare = population.length ? population.filter(hasEdr).length / population.length : 1
  const checks: CheckResult[] = rules.readiness.map((r) => {
    const mk = (fail: boolean, detail: string): CheckResult => ({ check: r.check, level: fail ? r.level : 'ok', text: fail ? r.text : r.ok_text ?? r.text, detail })
    // A problem that only involves tools this goal does not need is shown, but as a warning.
    const scoped = (inScope: number, outOfScope: number, detail: string): CheckResult =>
      inScope > 0
        ? mk(true, detail)
        : outOfScope > 0
          ? { check: r.check, level: r.level === 'block' ? 'warn' : r.level, text: r.text, detail: `${detail} (only in tools this goal does not need)` }
          : mk(false, detail)
    switch (r.check) {
      case 'counts': {
        const bad = sources.filter((s) => s.mismatch)
        return scoped(bad.filter((s) => s.in_scope).length, bad.filter((s) => !s.in_scope).length, bad.length ? bad.map((s) => `${s.label}: export ${s.records}, console ${s.console}`).join('; ') : 'All export counts match the console counts provided')
      }
      case 'review_queue':
        {
          const touches = (r2: ReviewItem) => r2.pair.some((k) => inScopeSrc(k.split(':')[0]))
          return scoped(review.filter(touches).length, review.filter((x) => !touches(x)).length, `${review.length} possible duplicate${review.length === 1 ? '' : 's'} waiting for review`)
        }
      case 'orphans':
        return scoped(orphans.filter((o) => inScopeSrc(o.source)).length, orphans.filter((o) => !inScopeSrc(o.source)).length, `${orphans.length} finding${orphans.length === 1 ? '' : 's'} with no matching asset`)
      case 'stale':
        return mk(stale.length > 0, `${stale.length} asset${stale.length === 1 ? '' : 's'} not seen in over ${staleDays} days`)
      case 'edr_coverage':
        {
        const pending = population.filter((a) => !hasEdr(a) && inReview.has(a.asset_id)).length
        return mk(edrShare < (r.below ?? 1), `${Math.round(edrShare * 100)}% of ${population.length} active assets have an endpoint agent${pending ? ` (${pending} without one ${pending === 1 ? 'is' : 'are'} waiting on a duplicate decision and may have one)` : ''}`)
      }
      default:
        return mk(false, 'Unknown check in config')
    }
  })

  const placeholders = [
    rules.stale_after_days.placeholder ? `Stale after ${staleDays} days` : '',
    rules.scan_recent_days.placeholder ? `Scanned within ${rules.scan_recent_days.value} days` : '',
    ...rules.readiness.filter((r) => r.placeholder && r.check === 'edr_coverage' && r.below !== undefined).map((r) => `Endpoint agent coverage target ${Math.round(r.below! * 100)}%`),
  ].filter(Boolean)

  return {
    as_of: input.as_of,
    synthetic: input.synthetic,
    sources,
    mapping: input.mapping_checks ?? [],
    decisions_applied: decisions.length,
    totals: {
      asset_records: records.length,
      merged_assets: assets.length,
      cross_tool_merges: assets.filter((a) => a.sources.length > 1).length,
      same_tool_duplicates: assets.filter((a) => a.same_tool_duplicates.length > 0).length,
      review: review.length,
      stale: stale.length,
      identity_only: identityOnly.length,
      orphans: orphans.length,
      findings: findings.length,
    },
    assets,
    review,
    stale,
    coverage: {
      population: population.length,
      with_edr: population.filter(hasEdr).length,
      scanned_recently: population.filter(scannedRecently).length,
      // An asset in an open duplicate pair may gain an agent once the pair is decided, so it is
      // listed apart and not raised with the customer yet.
      no_edr: population.filter((a) => !hasEdr(a) && !inReview.has(a.asset_id)).map((a) => ({ asset_id: a.asset_id, hostname: a.hostname, sources: a.sources })),
      no_edr_pending: population.filter((a) => !hasEdr(a) && inReview.has(a.asset_id)).map((a) => ({ asset_id: a.asset_id, hostname: a.hostname, sources: a.sources })),
      not_scanned: population.filter((a) => !scannedRecently(a)).map((a) => ({ asset_id: a.asset_id, hostname: a.hostname, sources: a.sources })),
      identity_only: identityOnly.map((a) => ({ asset_id: a.asset_id, label: a.hostname ?? a.asset_id })),
    },
    orphans,
    checks,
    ready: !checks.some((c) => c.level === 'block'),
    settings: { stale_after_days: staleDays, scan_recent_days: rules.scan_recent_days.value, merge_threshold: match.merge_threshold, placeholders },
  }
}

// ---------- scoring against planted truth ----------

export function scoreAgainstTruth(report: DataReport, truth: Record<string, string>) {
  const assetOf = new Map<string, string>()
  for (const a of report.assets) for (const r of a.records) assetOf.set(r.key, a.asset_id)
  const keys = Object.keys(truth).filter((k) => assetOf.has(k))
  let truePairs = 0
  let mergedPairs = 0
  let correctMerged = 0
  let wrongMerged = 0
  let missedButInReview = 0
  const reviewPairs = new Set(report.review.map((r) => [r.a.asset_id, r.b.asset_id].sort().join('|')))
  const wrong: string[] = []
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const same = truth[keys[i]] === truth[keys[j]]
    const merged = assetOf.get(keys[i]) === assetOf.get(keys[j])
    if (same) truePairs++
    if (merged) mergedPairs++
    if (same && merged) correctMerged++
    if (!same && merged) {
      wrongMerged++
      wrong.push(`${keys[i]} + ${keys[j]}`)
    }
    if (same && !merged && reviewPairs.has([assetOf.get(keys[i]), assetOf.get(keys[j])].sort().join('|'))) missedButInReview++
  }
  const reviewSame = report.review.filter((r) => {
    const ka = report.assets.find((a) => a.asset_id === r.a.asset_id)!.records[0].key
    const kb = report.assets.find((a) => a.asset_id === r.b.asset_id)!.records[0].key
    return truth[ka] === truth[kb]
  }).length
  return {
    true_same_machine_pairs: truePairs,
    merged_pairs: mergedPairs,
    correct_merges: correctMerged,
    wrong_merges: wrongMerged,
    wrong,
    missed_pairs: truePairs - correctMerged,
    missed_pairs_sent_to_review: missedButInReview,
    review_items: report.review.length,
    review_items_truly_same: reviewSame,
    review_items_truly_different: report.review.length - reviewSame,
  }
}
