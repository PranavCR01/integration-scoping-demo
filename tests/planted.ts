// Planted errors: each one corrupts the saved model draft in a way a real model could
// (made-up endpoint, wrong scope, wrong number...). The verifier must hold back every one.
import type { Draft, DraftRow, Fact } from '../src/core/types'

const SNYK_SPEC = 'sources/04_snyk_rest_openapi.json'
const SNYK_ABOUT = 'sources/04b_snyk_about_rest_api.md'
const OKTA_SPEC = 'sources/02_okta_management_openapi_v2026.42.1.yaml'
const TENABLE = 'sources/03_tenable_vm_api_notes.md'
const ISSUES = '/orgs/{org_id}/issues'

const F = (f: Partial<Fact> & Pick<Fact, 'kind' | 'value' | 'cite_file'>): Fact => ({ method: 'get', path: null, cite_line: null, quote: null, ...f })

export interface PlantedError {
  id: string
  description: string
  row: { section: DraftRow['section']; tool: string; item: string }
  // the literal that must NOT appear anywhere in the final plan
  bad: string
  text: string // appended to the row text
  fact: Fact | null // appended to the row facts (null: text-only error)
}

export const PLANTED: PlantedError[] = [
  { id: 'fake-endpoint', description: 'Made-up Snyk endpoint', row: { section: 'custom_sheet', tool: 'Snyk', item: 'endpoints' }, bad: '/orgs/{org_id}/vulnerabilities', text: ' Vulnerabilities: `/orgs/{org_id}/vulnerabilities`.', fact: F({ kind: 'endpoint', value: '/orgs/{org_id}/vulnerabilities', cite_file: SNYK_SPEC }) },
  { id: 'wrong-method', description: 'Real path, wrong HTTP method', row: { section: 'custom_sheet', tool: 'Snyk', item: 'endpoints' }, bad: 'POST /orgs/{org_id}/issues', text: ' Create issues with `POST /orgs/{org_id}/issues`.', fact: F({ kind: 'endpoint', value: 'POST /orgs/{org_id}/issues', cite_file: SNYK_SPEC }) },
  { id: 'fake-param', description: 'Made-up filter parameter', row: { section: 'custom_sheet', tool: 'Snyk', item: 'filters' }, bad: 'severity_min', text: ' `severity_min` sets a minimum severity.', fact: F({ kind: 'param', value: 'severity_min', path: ISSUES, cite_file: SNYK_SPEC }) },
  { id: 'fake-pagination', description: 'Made-up pagination parameter', row: { section: 'custom_sheet', tool: 'Snyk', item: 'pagination' }, bad: 'page_number', text: ' `page_number` selects a page.', fact: F({ kind: 'pagination', value: 'page_number', path: ISSUES, cite_file: SNYK_SPEC }) },
  { id: 'fake-field', description: 'Made-up response field', row: { section: 'custom_sheet', tool: 'Snyk', item: 'key_fields' }, bad: 'attributes.cvss_score', text: ' `attributes.cvss_score` maps to `severity`.', fact: F({ kind: 'field', value: 'attributes.cvss_score', path: ISSUES, cite_file: SNYK_SPEC }) },
  { id: 'fake-canonical', description: 'Maps to a field our common format does not have', row: { section: 'custom_sheet', tool: 'Snyk', item: 'key_fields' }, bad: 'risk_score', text: ' `attributes.title` also maps to `risk_score`.', fact: F({ kind: 'canonical_field', value: 'risk_score', cite_file: 'config/canonical_schema.json' }) },
  { id: 'fake-scope', description: 'Made-up Okta scope', row: { section: 'access', tool: 'Okta', item: 'permissions' }, bad: 'okta.devices.readonly', text: ' Also `okta.devices.readonly`.', fact: F({ kind: 'scope', value: 'okta.devices.readonly', path: '/api/v1/devices', cite_file: OKTA_SPEC }) },
  { id: 'scope-wrong-endpoint', description: 'Real Okta scope attached to the wrong endpoint', row: { section: 'access', tool: 'Okta', item: 'permissions' }, bad: 'okta.logs.read for users', text: ' Listing users needs `okta.logs.read` (okta.logs.read for users).', fact: F({ kind: 'scope', value: 'okta.logs.read', path: '/api/v1/users', cite_file: OKTA_SPEC }) },
  { id: 'fake-auth-header', description: 'Wrong Okta auth header', row: { section: 'access', tool: 'Okta', item: 'auth' }, bad: 'X-Okta-Key', text: ' Or send the token in `X-Okta-Key`.', fact: F({ kind: 'auth', value: 'X-Okta-Key', cite_file: OKTA_SPEC }) },
  { id: 'wrong-rate-limit', description: 'Wrong rate limit, real quote', row: { section: 'custom_sheet', tool: 'Snyk', item: 'rate_limits' }, bad: '2000', text: ' That is `2000` requests per minute.', fact: F({ kind: 'rate_limit', value: '2000 requests per minute', cite_file: SNYK_ABOUT, cite_line: 135, quote: 'There is a limit of **1620 requests per minute**, per API key.' }) },
  { id: 'invented-quote', description: 'Quote that is not in the doc', row: { section: 'custom_sheet', tool: 'Snyk', item: 'rate_limits' }, bad: '5000', text: ' Bursts of `5000` requests are allowed.', fact: F({ kind: 'rate_limit', value: '5000', cite_file: SNYK_ABOUT, cite_line: 135, quote: 'Bursts of 5000 requests are allowed per API key.' }) },
  { id: 'wrong-version', description: 'Wrong recommended API version', row: { section: 'custom_sheet', tool: 'Snyk', item: 'versioning' }, bad: '2023-01-01', text: ' Snyk recommends `2023-01-01`.', fact: F({ kind: 'version', value: '2023-01-01', cite_file: SNYK_ABOUT, cite_line: 56, quote: 'Snyk recommends using `2024-10-15` the version number' }) },
  { id: 'wrong-base-url', description: 'Wrong base URL', row: { section: 'custom_sheet', tool: 'Snyk', item: 'base_url' }, bad: 'https://api.snyk.com/rest', text: ' Or `https://api.snyk.com/rest`.', fact: F({ kind: 'base_url', value: 'https://api.snyk.com/rest', cite_file: SNYK_SPEC }) },
  { id: 'wrong-source-file', description: 'Real fact cited to a file that is not this tool\'s docs', row: { section: 'custom_sheet', tool: 'Snyk', item: 'rate_limits' }, bad: 'okta-cited', text: ' (okta-cited) `1620` per minute.', fact: F({ kind: 'rate_limit', value: '1620', cite_file: OKTA_SPEC, quote: 'There is a limit of 1620 requests per minute' }) },
  { id: 'wrong-tenable-header', description: 'Wrong Tenable auth header', row: { section: 'access', tool: 'Tenable Vulnerability Management', item: 'auth' }, bad: 'X-API-Token', text: ' Send it as `X-API-Token`.', fact: F({ kind: 'auth', value: 'X-API-Token', cite_file: TENABLE, cite_line: 8, quote: 'Header: `X-APIKeys: accessKey=<access_key>;secretKey=<secret_key>`' }) },
  { id: 'wrong-tenable-role', description: 'Wrong Tenable role', row: { section: 'access', tool: 'Tenable Vulnerability Management', item: 'permissions' }, bad: 'Administrator [32]', text: ' Or the `Administrator [32]` role.', fact: F({ kind: 'permission', value: 'Administrator [32]', cite_file: TENABLE, cite_line: 14, quote: 'Administrator [64] users are exempt from the Can View requirement.' }) },
  { id: 'unbacked-token', description: 'Endpoint in the text with no fact behind it', row: { section: 'custom_sheet', tool: 'Snyk', item: 'endpoints' }, bad: '/orgs/{org_id}/findings', text: ' Findings: `/orgs/{org_id}/findings`.', fact: null },
  { id: 'unbacked-number', description: 'Number in the text with no fact behind it', row: { section: 'access', tool: 'Snyk', item: 'auth' }, bad: '90 days', text: ' Tokens expire after 90 days.', fact: null },
]

export function plant(draft: Draft, e: PlantedError): Draft {
  const rows = draft.rows.map((r) => ({ ...r, facts: [...r.facts] }))
  let row = rows.find((r) => r.section === e.row.section && r.tool === e.row.tool && r.item === e.row.item)
  if (!row) {
    row = { section: e.row.section, tool: e.row.tool, item: e.row.item, text: '', facts: [] }
    rows.push(row)
  }
  row.text = row.text + e.text
  if (e.fact) row.facts.push(e.fact)
  return { rows }
}

// Caught means the specific planted fact failed verification, or (for text-only errors) the
// planted token is named in the hold reason. A row that was already held for another reason
// does not count as catching the planted error.
export function caughtBy(plan: import('../src/core/types').Plan, e: PlantedError): string | null {
  const row = `${e.row.section}/${e.row.tool}/${e.row.item}`
  if (e.fact) {
    const f = plan.verification.log.find((l) => l.row === row && !l.verified && l.fact.value === e.fact!.value && l.fact.kind === e.fact!.kind)
    return f ? f.detail : null
  }
  const h = plan.verification.held.find((x) => x.row === row)
  const token = e.text.match(/`([^`]+)`/)?.[1] ?? e.bad.split(' ')[0]
  return h && h.reason.includes(`"${token}"`) ? h.reason : null
}
