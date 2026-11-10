import { describe, expect, it } from 'vitest'
import { runData } from '../src/server/data'
import { loadCustomer, readJson } from '../src/server/store'
import { scoreAgainstTruth } from '../src/core/data'

const customer = loadCustomer('halden')
const truth = readJson<{ record_entity: Record<string, string> }>('data/halden/truth.json').record_entity
const r = runData({ customer })
const assetWith = (key: string) => r.assets.find((a) => a.records.some((x) => x.key === key))!

describe('data normalization and checks (synthetic Halden data)', () => {
  it('never merges two different machines', () => {
    const s = scoreAgainstTruth(r, truth)
    expect(s.wrong_merges).toBe(0)
  })

  it('every same-machine pair it does not merge is in the review queue', () => {
    const s = scoreAgainstTruth(r, truth)
    expect(s.missed_pairs_sent_to_review).toBe(s.missed_pairs)
  })

  it('links an AWS-style scanner name to the EDR name by cloud instance ID', () => {
    const a = assetWith('tenable_assets:tio-e20')
    expect(a.records.map((x) => x.key)).toContain('crowdstrike_hosts:cs-e20')
    expect(a.reasons[0].rule).toBe('cloud_instance_id')
  })

  it('links a friendly Okta device name by serial number only', () => {
    expect(assetWith('okta_devices:guo-2').records.map((x) => x.key)).toContain('crowdstrike_hosts:cs-hal-lt-002')
  })

  it('keeps the two app-01 servers apart (different instance IDs) and asks a person', () => {
    expect(assetWith('crowdstrike_hosts:cs-e24').records).toHaveLength(1)
    const rev = r.review.find((x) => x.shared === 'hostname=app-01')!
    expect(rev.why).toMatch(/different cloud instance IDs/)
  })

  it('does not merge two laptops that share a reassigned IP; sends it to review', () => {
    expect(assetWith('crowdstrike_hosts:cs-hal-lt-005')).not.toBe(assetWith('crowdstrike_hosts:cs-hal-lt-009'))
    expect(r.review.some((x) => x.rule === 'ip_only')).toBe(true)
  })

  it('flags the duplicate CrowdStrike record from a reinstall', () => {
    expect(assetWith('crowdstrike_hosts:cs-hal-lt-007-old').same_tool_duplicates).toEqual(['crowdstrike_hosts'])
  })

  it('finds stale assets, coverage gaps, orphan findings and the count mismatch', () => {
    expect(r.stale.map((s) => s.hostname).sort()).toEqual(['legacy-erp-01', 'print-srv-01', 'scanner-test-vm'])
    expect(r.coverage.no_edr.map((x) => x.hostname)).toEqual(expect.arrayContaining(['db-prod-01', 'fileserver-01']))
    expect(r.orphans).toHaveLength(2)
    expect(r.sources.find((s) => s.key === 'tenable_assets')!.mismatch).toBe(true)
    expect(r.coverage.identity_only.map((x) => x.label)).toEqual(expect.arrayContaining(["marco's iphone", "dana's ipad"]))
  })

  it('blocks the risk number until the blocking checks are resolved', () => {
    expect(r.ready).toBe(false)
    expect(r.checks.filter((c) => c.level === 'block').map((c) => c.check).sort()).toEqual(['counts', 'orphans', 'review_queue'])
  })

  it('verifies the Okta and Tenable vuln field mappings against the docs; the rest are labelled placeholders', () => {
    const okta = r.mapping.filter((m) => m.source === 'okta_devices')
    expect(okta.every((m) => m.status === 'verified')).toBe(true)
    expect(r.mapping.filter((m) => m.source === 'crowdstrike_hosts').every((m) => m.status === 'placeholder')).toBe(true)
    expect(r.mapping.some((m) => m.status === 'failed')).toBe(false)
  })

  it('an uploaded file replaces the synthetic export for that source', () => {
    const up = runData({ customer, uploads: { crowdstrike_hosts: [{ device_id: 'x1', hostname: 'NEW-HOST', last_seen: '2026-11-01T00:00:00Z' }] } })
    const s = up.sources.find((x) => x.key === 'crowdstrike_hosts')!
    expect(s.records).toBe(1)
    expect(s.uploaded).toBe(true)
    expect(up.synthetic).toBe(false)
  })
})

describe('review decisions by a person', () => {
  it('"same" merges the pair, "different" removes it from the queue, and the gate updates', () => {
    const before = runData({ customer })
    const decisions = Object.fromEntries(before.review.map((x) => [x.pair.join('|'), x.rule === 'ip_only' || x.why.includes('different') ? 'different' : 'same'])) as Record<string, 'same' | 'different'>
    const after = runData({ customer, decisions })
    expect(after.review).toHaveLength(0)
    expect(after.checks.find((c) => c.check === 'review_queue')!.level).toBe('ok')
    // an OK check reads as OK, not as the problem it would describe
    expect(after.checks.find((c) => c.check === 'review_queue')!.text).toBe('No possible duplicates are waiting for a person')
    expect(after.checks.find((c) => c.check === 'edr_coverage')!.text).toMatch(/meets the agreed threshold/)
    expect(scoreAgainstTruth(after, truth).wrong_merges).toBe(0)
    expect(scoreAgainstTruth(after, truth).missed_pairs).toBe(0)
  })
})
