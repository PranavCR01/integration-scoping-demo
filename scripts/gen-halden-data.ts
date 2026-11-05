// Generates the SYNTHETIC Halden Outfitters exports in data/halden/. Deterministic.
// Every messy case is planted on purpose and recorded in truth.json so the merge logic can
// be scored. Field names for Tenable assets and CrowdStrike are PLACEHOLDERS (the attached
// docs do not document them); Okta device fields come from the Okta spec.
import { mkdirSync, writeFileSync } from 'node:fs'

const AS_OF = '2026-11-02T00:00:00Z'
const day = 86400000
const ago = (n: number) => new Date(Date.parse(AS_OF) - n * day).toISOString()

type T = { entity: string; id: string; hostnames?: string[]; fqdns?: string[]; ipv4s?: string[]; macs?: string[]; cloud_instance_id?: string | null; operating_systems?: string[]; last_seen: string }
type C = { entity: string; device_id: string; hostname: string; local_ip?: string; mac_address?: string; instance_id?: string | null; serial_number?: string | null; os_version: string; last_seen: string }
type O = { entity: string; id: string; status: string; lastUpdated: string; profile: { displayName: string; serialNumber: string | null; platform: string } }

const tenable: T[] = []
const cs: C[] = []
const okta: O[] = []
const planted: { case: string; entities: string[]; expect: string }[] = []

const mac = (n: number) => `00:1a:2b:3c:${String(Math.floor(n / 100)).padStart(2, '0')}:${String(n % 100).padStart(2, '0')}`
const serial = (n: number) => `C02HAL${String(n).padStart(3, '0')}`

// ---- Laptops ----
const laptop = (n: number, opts: { tenable?: 'fqdn' | 'caps' | 'old' | false; okta?: 'serial' | 'name_only' | 'friendly'; csSeen?: number; ip?: string; okta_name?: string }) => {
  const e = `E${String(n).padStart(2, '0')}`
  const host = `HAL-LT-${String(n).padStart(3, '0')}`
  const ip = opts.ip ?? `10.20.${n}.11`
  cs.push({ entity: e, device_id: `cs-${host.toLowerCase()}`, hostname: host, local_ip: ip, mac_address: mac(n), instance_id: null, serial_number: serial(n), os_version: 'Windows 11', last_seen: ago(opts.csSeen ?? 1) })
  if (opts.tenable === 'fqdn') tenable.push({ entity: e, id: `tio-${n}`, hostnames: [host.toLowerCase()], fqdns: [`${host.toLowerCase()}.halden.local`], ipv4s: [ip], macs: [mac(n).toUpperCase()], operating_systems: ['Microsoft Windows 11'], last_seen: ago(2) })
  if (opts.tenable === 'caps') tenable.push({ entity: e, id: `tio-${n}`, hostnames: [host], ipv4s: [ip], operating_systems: ['Microsoft Windows 11'], last_seen: ago(3) })
  if (opts.tenable === 'old') tenable.push({ entity: e, id: `tio-${n}`, hostnames: [host.toLowerCase()], ipv4s: [ip], macs: [mac(n)], operating_systems: ['Microsoft Windows 11'], last_seen: ago(52) })
  if (opts.okta === 'serial') okta.push({ entity: e, id: `guo-${n}`, status: 'ACTIVE', lastUpdated: ago(1), profile: { displayName: opts.okta_name ?? host, serialNumber: serial(n), platform: 'WINDOWS' } })
  if (opts.okta === 'name_only') okta.push({ entity: e, id: `guo-${n}`, status: 'ACTIVE', lastUpdated: ago(1), profile: { displayName: host, serialNumber: null, platform: 'WINDOWS' } })
  return e
}

laptop(1, { tenable: 'fqdn', okta: 'serial' })
planted.push({ case: 'Same laptop, short name in one tool and full domain name in another (HAL-LT-001 vs hal-lt-001.halden.local)', entities: ['E01'], expect: 'merge' })
laptop(2, { tenable: 'caps', okta: 'serial', okta_name: "Priya's MacBook Pro" })
planted.push({ case: "Okta shows a friendly device name (\"Priya's MacBook Pro\"); only the serial number links it", entities: ['E02'], expect: 'merge' })
laptop(3, { tenable: 'old', okta: 'serial' })
planted.push({ case: 'Laptop last scanned 52 days ago', entities: ['E03'], expect: 'coverage gap: not scanned recently' })
laptop(4, { okta: 'serial' })
planted.push({ case: 'Laptop with the endpoint agent but never scanned', entities: ['E04'], expect: 'coverage gap: not scanned' })
laptop(5, { okta: 'serial', csSeen: 20, ip: '10.20.4.17' })
laptop(7, { tenable: 'fqdn', okta: 'serial' })
// Reinstall: a second, older CrowdStrike record for the same laptop (same serial).
cs.push({ entity: 'E07', device_id: 'cs-hal-lt-007-old', hostname: 'HAL-LT-007', local_ip: '10.20.7.11', mac_address: mac(7), instance_id: null, serial_number: serial(7), os_version: 'Windows 10', last_seen: ago(64) })
planted.push({ case: 'Two CrowdStrike records for one laptop after a reinstall', entities: ['E07'], expect: 'merge, flagged as duplicate inside one tool' })
laptop(8, { tenable: 'fqdn', okta: 'name_only' })
planted.push({ case: 'Okta device with no serial number whose name equals a hostname', entities: ['E08'], expect: 'review (weak match)' })
// E09: its IP 10.20.4.17 used to belong to E05 (DHCP reassignment).
laptop(9, { tenable: 'fqdn', okta: 'serial', ip: '10.20.4.17' })
planted.push({ case: 'Two different laptops share IP 10.20.4.17 (address reassigned)', entities: ['E05', 'E09'], expect: 'review, must not merge' })
laptop(10, { tenable: 'fqdn', okta: 'serial' })
laptop(11, { tenable: 'fqdn', okta: 'serial' })
okta.push({ entity: 'E12', id: 'guo-12', status: 'ACTIVE', lastUpdated: ago(2), profile: { displayName: "Marco's iPhone", serialNumber: 'F2LHAL012', platform: 'IOS' } })
okta.push({ entity: 'E13', id: 'guo-13', status: 'ACTIVE', lastUpdated: ago(6), profile: { displayName: "Dana's iPad", serialNumber: 'DMPHAL013', platform: 'IOS' } })
planted.push({ case: 'Phones and tablets seen only by Okta', entities: ['E12', 'E13'], expect: 'listed separately, not counted in coverage' })

// ---- Cloud servers ----
const iid = (n: number) => `i-0a1b2c3d4e5f6${String(n).padStart(4, '0')}`
const cloud = (e: string, name: string, n: number, ip: string, where: { tenable?: boolean; cs?: boolean; tSeen?: number; csSeen?: number; awsName?: boolean }) => {
  if (where.tenable) tenable.push({ entity: e, id: `tio-${e.toLowerCase()}`, hostnames: [where.awsName ? `ip-${ip.replace(/\./g, '-')}` : name], fqdns: where.awsName ? [`ip-${ip.replace(/\./g, '-')}.ec2.internal`] : [], ipv4s: [ip], cloud_instance_id: iid(n), operating_systems: ['Amazon Linux 2023'], last_seen: ago(where.tSeen ?? 1) })
  if (where.cs) cs.push({ entity: e, device_id: `cs-${e.toLowerCase()}`, hostname: name, local_ip: ip, instance_id: iid(n), serial_number: null, os_version: 'Amazon Linux 2023', last_seen: ago(where.csSeen ?? 1) })
}
cloud('E20', 'web-prod-01', 1, '10.0.1.15', { tenable: true, cs: true, awsName: true })
planted.push({ case: 'Scanner sees an AWS-style name (ip-10-0-1-15), EDR sees web-prod-01; only the cloud instance ID links them', entities: ['E20'], expect: 'merge' })
cloud('E21', 'web-prod-02', 2, '10.0.1.16', { tenable: true, cs: true, awsName: true })
cloud('E22', 'api-prod-01', 3, '10.0.1.40', { tenable: true, cs: true })
cloud('E23', 'app-01', 101, '10.0.2.21', { tenable: true, cs: true })
cloud('E24', 'app-01', 202, '10.1.2.21', { cs: true })
planted.push({ case: 'Two different servers both named app-01 (production and staging) with different instance IDs', entities: ['E23', 'E24'], expect: 'must not merge (conflict)' })
cloud('E25', 'db-prod-01', 5, '10.0.3.10', { tenable: true })
planted.push({ case: 'Production database server with no endpoint agent', entities: ['E25'], expect: 'coverage gap: no EDR' })
cloud('E26', 'batch-worker-07', 6, '10.0.4.77', { cs: true, csSeen: 2 })

// ---- On-premises ----
const onprem = (e: string, name: string, ip: string, where: { tenable?: number; cs?: number; csName?: string; csIp?: string; fqdn?: boolean }) => {
  if (where.tenable !== undefined) tenable.push({ entity: e, id: `tio-${e.toLowerCase()}`, hostnames: [name], fqdns: where.fqdn ? [`${name}.halden.local`] : [], ipv4s: [ip], operating_systems: ['Windows Server 2019'], last_seen: ago(where.tenable) })
  if (where.cs !== undefined) cs.push({ entity: e, device_id: `cs-${e.toLowerCase()}`, hostname: where.csName ?? name.toUpperCase(), local_ip: where.csIp ?? ip, instance_id: null, serial_number: null, os_version: 'Windows Server 2019', last_seen: ago(where.cs) })
}
onprem('E30', 'fileserver-01', '10.30.0.11', { tenable: 3 })
onprem('E31', 'fileserver-02', '10.30.0.12', { tenable: 5, cs: 1, csIp: '10.30.0.40' })
planted.push({ case: 'Same file server, but its IP changed between the two tools and nothing else links them', entities: ['E31'], expect: 'review (same hostname only)' })
onprem('E32', 'print-srv-01', '10.30.0.21', { tenable: 95 })
onprem('E33', 'legacy-erp-01', '10.30.0.31', { tenable: 120 })
onprem('E36', 'scanner-test-vm', '10.30.0.99', { tenable: 47 })
planted.push({ case: 'Three servers not seen in 47 to 120 days', entities: ['E32', 'E33', 'E36'], expect: 'stale' })
onprem('E34', 'dc-01', '10.30.0.5', { tenable: 1, cs: 1, fqdn: true })
onprem('E35', 'dc-02', '10.30.0.6', { tenable: 1, cs: 1, fqdn: true })
onprem('E37', 'kiosk-lobby-01', '10.40.0.8', { cs: 2 })

// ---- Findings ----
const titles = ['Outdated web server package', 'Weak TLS configuration', 'Missing operating system update', 'Outdated runtime library', 'Insecure service setting']
const sev = ['critical', 'high', 'medium', 'low']
const vulns: any[] = []
let v = 0
tenable.forEach((a, i) => {
  const count = (i % 4) + 1
  for (let k = 0; k < count; k++) {
    v++
    vulns.push({ id: `vuln-${String(v).padStart(4, '0')}`, 'asset.id': a.id, 'definition.id': 100000 + ((i * 7 + k * 13) % 50), 'definition.name': titles[(i + k) % titles.length], severity: sev[(i + k) % sev.length], state: k === 0 && i % 5 === 0 ? 'FIXED' : 'OPEN', first_found: ago(40 + k), last_found: ago(2) })
  }
})
for (const orphan of ['tio-retired-77', 'tio-retired-78']) {
  v++
  vulns.push({ id: `vuln-${String(v).padStart(4, '0')}`, 'asset.id': orphan, 'definition.id': 100003, 'definition.name': 'Outdated runtime library', severity: 'high', state: 'OPEN', first_found: ago(90), last_found: ago(15) })
}
planted.push({ case: 'Two findings point to asset IDs missing from the asset export', entities: [], expect: 'orphan findings' })

// ---- Console counts the customer reports (fictional) ----
const consoleCounts = {
  _about: 'What Halden says each tool console shows (FICTIONAL). Compared against the export record counts.',
  tenable_assets: tenable.length + 2,
  crowdstrike_hosts: cs.length,
  okta_devices: okta.length,
  tenable_vulns: vulns.length,
}
planted.push({ case: 'Tenable console shows 2 more assets than the export returned', entities: [], expect: 'count mismatch' })

// ---- Write ----
const strip = <X extends { entity: string }>(rows: X[]) => rows.map(({ entity, ...r }) => r)
const truth: Record<string, string> = {}
tenable.forEach((r) => (truth[`tenable_assets:${r.id}`] = r.entity))
cs.forEach((r) => (truth[`crowdstrike_hosts:${r.device_id}`] = r.entity))
okta.forEach((r) => (truth[`okta_devices:${r.id}`] = r.entity))

mkdirSync('data/halden', { recursive: true })
const w = (f: string, x: unknown) => writeFileSync(`data/halden/${f}`, JSON.stringify(x, null, 2) + '\n')
w('meta.json', { customer: 'Halden Outfitters (FICTIONAL)', synthetic: true, as_of: AS_OF, note: 'Synthetic exports for a fictional customer. Tenable asset and CrowdStrike field names are placeholders.' })
w('tenable_assets.json', strip(tenable))
w('crowdstrike_hosts.json', strip(cs))
w('okta_devices.json', strip(okta))
w('tenable_vulns.json', vulns)
w('console_counts.json', consoleCounts)
w('truth.json', { _about: 'Ground truth for scoring: which real machine each record belongs to, and the cases planted on purpose.', record_entity: truth, planted })
console.log(`tenable ${tenable.length}, crowdstrike ${cs.length}, okta ${okta.length}, vulns ${vulns.length}, planted cases ${planted.length}`)
