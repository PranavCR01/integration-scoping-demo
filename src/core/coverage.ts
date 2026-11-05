// Coverage check: match each customer tool against the integrations config. Pure code, no model.
import type { AppConfig, CoverageResult } from './types.js'

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(s: string, stop: Set<string>): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t && !stop.has(t))
}

function stripVariant(name: string, suffixes: string[]): string {
  let n = normalize(name)
  for (const s of suffixes) {
    const ns = normalize(s)
    if (n.endsWith(' ' + ns)) n = n.slice(0, -ns.length - 1).trim()
  }
  return n
}

export function matchTool(input: string, cfg: AppConfig): CoverageResult {
  const cards = cfg.integrations.integrations
  const stop = new Set(cfg.matching.stopwords.map(normalize))
  const suffixes = cfg.matching.ignore_variant_suffixes
  const nInput = normalize(input)
  const inTokens = tokens(input, stop)
  const evidenceFor = (names: string[]) =>
    names.flatMap((n) => {
      const c = cards.find((x) => x.name === n)
      return c?.source ? [c.source] : []
    })

  // Cards that contain every word the customer used (product variants of the same name).
  const containing = cards.filter((c) => {
    const ct = new Set(tokens(c.name, stop))
    return inTokens.length > 0 && inTokens.every((t) => ct.has(t))
  })

  const exact = cards.find((c) => normalize(c.name) === nInput)
  const alias = cfg.aliases.aliases.find((a) => normalize(a.say) === nInput)
  const aliasCard = alias ? cards.find((c) => normalize(c.name) === normalize(alias.means)) : undefined
  const target = exact ?? aliasCard

  if (target) {
    const base = stripVariant(target.name, suffixes)
    const others = containing.filter((c) => c.name !== target.name)
    // Different products (not just a "via M365" route to the same one)
    const distinct = others.filter((c) => stripVariant(c.name, suffixes) !== base)
    const sameProductRoutes = others.filter((c) => stripVariant(c.name, suffixes) === base)
    const isBare = inTokens.length <= cfg.matching.bare_name_max_tokens

    if (exact && isBare && distinct.length >= 1) {
      const all = [target.name, ...distinct.map((c) => c.name)]
      return {
        input,
        bucket: 'confirm_with_safe',
        matched_card: null,
        tool_key: input,
        rule: 'bare_vendor_name',
        short: `${all.length} ${input} products listed: which one?`,
        why: `"${input}" matches a card, but SAFE's list has ${all.length} ${input} products (${all.join(', ')}). Need the exact product the customer licenses.`,
        candidates: all,
        variants: sameProductRoutes.map((c) => c.name),
        evidence: evidenceFor(all),
      }
    }
    const variantNote = [
      sameProductRoutes.length ? `"${sameProductRoutes.map((c) => c.name).join('", "')}" is also listed` : '',
      distinct.length ? `related card${distinct.length > 1 ? 's' : ''} also listed: "${distinct.map((c) => c.name).join('", "')}"` : '',
    ]
      .filter(Boolean)
      .join('; ')
    const why = exact
      ? `Exact match: "${target.name}" on SAFE's list${variantNote ? ` (${variantNote})` : ''}`
      : `Alias match: "${input}" is configured as "${target.name}" (config/aliases.json), which is on SAFE's list${variantNote ? ` (${variantNote})` : ''}`
    return {
      input,
      bucket: 'out_of_box',
      matched_card: target.name,
      tool_key: target.name,
      rule: exact ? 'exact' : 'alias',
      short: exact ? "On SAFE's list" : `On SAFE's list as ${target.name}`,
      why,
      candidates: [target.name],
      variants: [...sameProductRoutes, ...distinct].map((c) => c.name),
      evidence: evidenceFor([target.name]),
    }
  }

  // No exact card. If every word the customer used appears on SAFE's list, the tool is probably
  // one of several listed products: list the cards that share the customer's most specific
  // (rarest) word. If any word appears nowhere (a product name SAFE doesn't list), it is custom work.
  const freq = (t: string) => cards.filter((c) => tokens(c.name, stop).includes(t)).length
  const allWordsListed = inTokens.length > 0 && inTokens.every((t) => freq(t) > 0)
  if (allWordsListed) {
    const rarest = [...inTokens].sort((a, b) => freq(a) - freq(b))[0]
    const related = cards.filter((c) => tokens(c.name, stop).includes(rarest))
    const names = Array.from(new Set([...containing, ...related].map((c) => c.name)))
    return {
      input,
      bucket: 'confirm_with_safe',
      matched_card: null,
      tool_key: input,
      rule: 'partial',
      short: `${names.length} ${rarest.charAt(0).toUpperCase() + rarest.slice(1)} products listed: which one?`,
      why: `No card named "${input}". ${names.length} card${names.length > 1 ? 's' : ''} on SAFE's list contain "${rarest}": ${names.join(', ')}. Need the exact product the customer licenses.`,
      candidates: names,
      variants: [],
      evidence: evidenceFor(names),
    }
  }

  const vendorCards = cards.filter((c) => inTokens.some((t) => tokens(c.name, stop).includes(t))).map((c) => c.name)
  return {
    input,
    bucket: 'custom_work',
    matched_card: null,
    tool_key: input,
    rule: 'no_match',
    short: "Not on SAFE's public list",
    why:
      `Not on SAFE's public list (${cards.length} cards). SAFE claims more integrations than it lists publicly, so Confirm with SAFE before scoping a build.` +
      (vendorCards.length ? ` Cards sharing a word with it: ${vendorCards.join(', ')}.` : ''),
    candidates: [],
    variants: [],
    evidence: [],
  }
}

export function checkCoverage(tools: string[], cfg: AppConfig): CoverageResult[] {
  return tools.map((t) => matchTool(t, cfg))
}
