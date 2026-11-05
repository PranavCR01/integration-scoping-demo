import { describe, expect, it } from 'vitest'
import { checkCoverage, matchTool } from '../src/core/coverage'
import { loadConfig, readJson } from '../src/server/store'
import type { IntegrationsConfig } from '../src/core/types'

const cfg = loadConfig()

describe('coverage check (code, not model)', () => {
  it('puts Halden tools in the expected buckets', () => {
    const r = Object.fromEntries(checkCoverage(['Okta', 'Tenable VM', 'CrowdStrike Falcon', 'ServiceNow ITSM', 'Microsoft Defender', 'Snyk'], cfg).map((c) => [c.input, c.bucket]))
    expect(r).toEqual({
      Okta: 'out_of_box',
      'Tenable VM': 'out_of_box',
      'CrowdStrike Falcon': 'out_of_box',
      'ServiceNow ITSM': 'out_of_box',
      'Microsoft Defender': 'confirm_with_safe',
      Snyk: 'custom_work',
    })
  })

  it('a tool absent from the integrations config always lands in Custom work', () => {
    for (const t of ['Snyk', 'Acme Vuln Scanner', 'Lacework', 'Microsoft Sentinel', 'zzz']) {
      expect(matchTool(t, cfg).bucket, t).toBe('custom_work')
    }
  })

  it('every card on the list matches itself out of the box, unless it is a bare vendor name with other products', () => {
    for (const c of cfg.integrations.integrations) {
      const r = matchTool(c.name, cfg)
      if (r.rule === 'bare_vendor_name') expect(r.bucket).toBe('confirm_with_safe')
      else expect(r.bucket, c.name).toBe('out_of_box')
    }
  })

  it('ambiguous names land in Confirm with SAFE, listing the candidates', () => {
    const d = matchTool('Microsoft Defender', cfg)
    expect(d.bucket).toBe('confirm_with_safe')
    expect(d.candidates).toHaveLength(5)
    expect(matchTool('ServiceNow', cfg).bucket).toBe('confirm_with_safe')
    expect(matchTool('ServiceNow', cfg).candidates).toHaveLength(6)
    expect(matchTool('Tenable', cfg).bucket).toBe('confirm_with_safe')
    expect(matchTool('Crowdstrike', cfg).bucket).toBe('confirm_with_safe')
    expect(matchTool('Defender', cfg).bucket).toBe('confirm_with_safe')
  })

  it('"Okta" stays out of the box: "Okta via M365" is a route, not a different product', () => {
    const r = matchTool('Okta', cfg)
    expect(r.bucket).toBe('out_of_box')
    expect(r.variants).toContain('Okta via M365')
  })

  it('aliases only apply when their target card exists', () => {
    expect(matchTool('Tenable VM', cfg).rule).toBe('alias')
    const noTarget = { ...cfg, integrations: { ...cfg.integrations, integrations: cfg.integrations.integrations.filter((c) => c.name !== 'Tenable Vulnerability Management') } }
    expect(matchTool('Tenable VM', noTarget).bucket).not.toBe('out_of_box')
  })

  it('swapping the integrations config file changes the bucket with no code change', () => {
    const internal = readJson<IntegrationsConfig>('config/variants/integrations.safe-internal-example.json')
    expect(matchTool('Snyk', { ...cfg, integrations: internal }).bucket).toBe('out_of_box')
  })
})
