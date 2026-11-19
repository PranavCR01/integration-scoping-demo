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

  it('links a laptop seen under a generic name on another network by MAC address only', () => {
    const a = assetWith('tenable_assets:tio-3')
    expect(a.records.map((x) => x.key)).toContain('crowdstrike_hosts:cs-hal-lt-003')
    expect(a.reasons[0].rule).toBe('mac')
  })

  it('links the domain controller by hostname plus a shared IP', () => {
    expect(assetWith('tenable_assets:tio-e34').reasons[0].rule).toBe('hostname_and_ip')
  })

  it('one example of each kind of evidence: five merged machines, two possible duplicates', () => {
    const merged = r.assets.filter((a) => a.sources.length > 1)
    expect(merged.map((a) => a.reasons[0].rule).sort()).toEqual(['cloud_instance_id', 'hostname_and_ip', 'mac', 'serial_number', 'serial_number'])
    expect(r.review.map((x) => x.shared).sort()).toEqual(['hostname=app-01', 'hostname=fileserver-02'])
  })

  it('finds the stale asset, coverage gaps, the orphan finding and the count mismatch', () => {
    expect(r.stale.map((s) => s.hostname)).toEqual(['legacy-erp-01'])
    expect(r.coverage.no_edr.map((x) => x.hostname)).toEqual(['db-prod-01'])
    expect(r.coverage.not_scanned.map((x) => x.hostname)).toEqual(['kiosk-lobby-01'])
    expect(r.orphans.map((o) => o.asset_ref)).toEqual(['tio-retired-77'])
    expect(r.sources.find((s) => s.key === 'tenable_assets')!.mismatch).toBe(true)
    expect(r.coverage.identity_only.map((x) => x.label)).toEqual(["marco's iphone"])
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
    expect(after.checks.find((c) => c.check === 'review_queue')!.level).toBe('ok')
    expect(scoreAgainstTruth(after, truth).wrong_merges).toBe(0)
    expect(scoreAgainstTruth(after, truth).missed_pairs).toBe(0)
  })
})

describe('merge guard: a person can merge against the evidence, but it is never silent', () => {
  it('pairs with conflicting evidence say so; merging them anyway marks the asset', () => {
    const before = runData({ customer })
    const appPair = before.review.find((x) => x.shared === 'hostname=app-01')!
    const filePair = before.review.find((x) => x.shared.includes('fileserver-02'))!
    expect(appPair.conflict).toMatch(/different cloud instance IDs/)
    expect(filePair.conflict).toBeNull()
    const after = runData({ customer, decisions: { [appPair.pair.join('|')]: 'same', [filePair.pair.join('|')]: 'same' } })
    const merged = after.assets.find((a) => a.overrides.length)!
    expect(merged.overrides[0]).toMatch(/i-0a1b2c3d4e5f60101/)
    expect(merged.reasons.some((r) => r.label.startsWith('A person merged these despite different cloud instance IDs'))).toBe(true)
    // the clean "same" decision carries no override
    expect(after.assets.filter((a) => a.overrides.length)).toHaveLength(1)
    // and the truth check still counts it as a wrong merge
    expect(scoreAgainstTruth(after, truth).wrong_merges).toBeGreaterThan(0)
  })
})

describe('no-agent assets waiting on a duplicate decision are not raised yet', () => {
  it('fileserver-02 is held apart until its pair is decided, then drops off once merged', async () => {
    const before = runData({ customer })
    expect(before.coverage.no_edr.map((x) => x.hostname)).not.toContain('fileserver-02')
    expect(before.coverage.no_edr_pending.map((x) => x.hostname)).toContain('fileserver-02')
    const { buildPlan } = await import('../src/server/plan')
    const { buildActions } = await import('../src/core/summary')
    const us = buildActions(await buildPlan({ customer }), before).find((a) => a.party === 'us')!
    expect(us.items.find((i) => i.text.startsWith('Raise the'))!.text).not.toContain('fileserver-02')
    const pair = before.review.find((x) => x.shared.includes('fileserver-02'))!
    const after = runData({ customer, decisions: { [pair.pair.join('|')]: 'same' } })
    expect([...after.coverage.no_edr, ...after.coverage.no_edr_pending].map((x) => x.hostname)).not.toContain('fileserver-02')
  })
})

describe('not-scanned machines waiting on a duplicate decision are held apart', () => {
  it('app-01 (staging) and fileserver-02 wait while their pairs are open; deciding the pairs settles them', () => {
    const before = runData({ customer })
    expect(before.coverage.not_scanned.map((x) => x.hostname)).toEqual(['kiosk-lobby-01'])
    expect(before.coverage.not_scanned_pending.map((x) => x.hostname).sort()).toEqual(['app-01', 'fileserver-02'])
    const app = before.review.find((x) => x.shared === 'hostname=app-01')!
    const file = before.review.find((x) => x.shared === 'hostname=fileserver-02')!
    const after = runData({ customer, decisions: { [app.pair.join('|')]: 'different', [file.pair.join('|')]: 'same' } })
    expect(after.coverage.not_scanned_pending).toEqual([])
    // staging app-01 really is unscanned, so it is now listed; the file server merged with its scan
    expect(after.coverage.not_scanned.map((x) => x.hostname).sort()).toEqual(['app-01', 'kiosk-lobby-01'])
  })
})

describe('stale machines are only raised when the goal needs their tool', () => {
  it('the board goal asks about legacy-erp-01; the access goal (no Tenable) does not', async () => {
    const { buildPlan } = await import('../src/server/plan')
    const { buildActions } = await import('../src/core/summary')
    const access = { ...customer, goal: 'Understand who has access to what across our systems.' }
    const ask = async (c: typeof customer) => buildActions(await buildPlan({ customer: c }), runData({ customer: c })).flatMap((a) => a.items).some((i) => /not seen in over/.test(i.text))
    expect(await ask(customer)).toBe(true)
    expect(await ask(access)).toBe(false)
  })
})
