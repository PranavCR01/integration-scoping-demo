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
// One clear example per kind of evidence. Kept small on purpose so every case can be explained.
const laptop = (n: number, opts: { tenable?: 'fqdn' | 'caps' | 'mac_only' | false; okta?: 'serial'; okta_name?: string }) => {
  const e = `E${String(n).padStart(2, '0')}`
  const host = `HAL-LT-${String(n).padStart(3, '0')}`
  const ip = `10.20.${n}.11`
  cs.push({ entity: e, device_id: `cs-${host.toLowerCase()}`, hostname: host, local_ip: ip, mac_address: mac(n), instance_id: null, serial_number: serial(n), os_version: 'Windows 11', last_seen: ago(1) })
  if (opts.tenable === 'fqdn') tenable.push({ entity: e, id: `tio-${n}`, hostnames: [host.toLowerCase()], fqdns: [`${host.toLowerCase()}.halden.local`], ipv4s: [ip], macs: [mac(n).toUpperCase()], operating_systems: ['Microsoft Windows 11'], last_seen: ago(2) })
  if (opts.tenable === 'caps') tenable.push({ entity: e, id: `tio-${n}`, hostnames: [host], ipv4s: [ip], operating_systems: ['Microsoft Windows 11'], last_seen: ago(3) })
  // The scanner caught this laptop on another network: a generic name and a different IP, so
  // only the network card's MAC address links it.
  if (opts.tenable === 'mac_only') tenable.push({ entity: e, id: `tio-${n}`, hostnames: [`desktop-7q${n}k2`], ipv4s: [`192.168.1.${40 + n}`], macs: [mac(n)], operating_systems: ['Microsoft Windows 11'], last_seen: ago(4) })
  if (opts.okta === 'serial') okta.push({ entity: e, id: `guo-${n}`, status: 'ACTIVE', lastUpdated: ago(1), profile: { displayName: opts.okta_name ?? host, serialNumber: serial(n), platform: 'WINDOWS' } })
  return e
}

laptop(1, { tenable: 'fqdn', okta: 'serial' })
planted.push({ case: 'Same laptop in three tools: short name in one, full domain name in another; serial number and MAC address link them', entities: ['E01'], expect: 'merge' })
laptop(2, { tenable: 'caps', okta: 'serial', okta_name: "Priya's MacBook Pro" })
planted.push({ case: "Okta shows a friendly device name (\"Priya's MacBook Pro\"); only the serial number links it", entities: ['E02'], expect: 'merge' })
laptop(3, { tenable: 'mac_only' })
planted.push({ case: 'Scanner saw the laptop under a generic name on another network; only the MAC address links it', entities: ['E03'], expect: 'merge' })
okta.push({ entity: 'E12', id: 'guo-12', status: 'ACTIVE', lastUpdated: ago(2), profile: { displayName: "Marco's iPhone", serialNumber: 'F2LHAL012', platform: 'IOS' } })
planted.push({ case: 'A phone seen only by Okta', entities: ['E12'], expect: 'listed separately, not counted in coverage' })

// ---- Cloud servers ----
const iid = (n: number) => `i-0a1b2c3d4e5f6${String(n).padStart(4, '0')}`
const cloud = (e: string, name: string, n: number, ip: string, where: { tenable?: boolean; cs?: boolean; tSeen?: number; csSeen?: number; awsName?: boolean }) => {
  if (where.tenable) tenable.push({ entity: e, id: `tio-${e.toLowerCase()}`, hostnames: [where.awsName ? `ip-${ip.replace(/\./g, '-')}` : name], fqdns: where.awsName ? [`ip-${ip.replace(/\./g, '-')}.ec2.internal`] : [], ipv4s: [ip], cloud_instance_id: iid(n), operating_systems: ['Amazon Linux 2023'], last_seen: ago(where.tSeen ?? 1) })
  if (where.cs) cs.push({ entity: e, device_id: `cs-${e.toLowerCase()}`, hostname: name, local_ip: ip, instance_id: iid(n), serial_number: null, os_version: 'Amazon Linux 2023', last_seen: ago(where.csSeen ?? 1) })
}
cloud('E20', 'web-prod-01', 1, '10.0.1.15', { tenable: true, cs: true, awsName: true })
planted.push({ case: 'Scanner sees an AWS-style name (ip-10-0-1-15), EDR sees web-prod-01; only the cloud instance ID links them', entities: ['E20'], expect: 'merge' })
// Production app-01 is only in the scanner, staging app-01 only in the EDR tool.
cloud('E23', 'app-01', 101, '10.0.2.21', { tenable: true })
cloud('E24', 'app-01', 202, '10.1.2.21', { cs: true })
planted.push({ case: 'Two different servers both named app-01 (production and staging) with different instance IDs', entities: ['E23', 'E24'], expect: 'must not merge (conflict); review' })
cloud('E25', 'db-prod-01', 5, '10.0.3.10', { tenable: true })
planted.push({ case: 'Production database server with no endpoint agent', entities: ['E25'], expect: 'coverage gap: no EDR' })

// ---- On-premises ----
const onprem = (e: string, name: string, ip: string, where: { tenable?: number; cs?: number; csName?: string; csIp?: string; fqdn?: boolean }) => {
  if (where.tenable !== undefined) tenable.push({ entity: e, id: `tio-${e.toLowerCase()}`, hostnames: [name], fqdns: where.fqdn ? [`${name}.halden.local`] : [], ipv4s: [ip], operating_systems: ['Windows Server 2019'], last_seen: ago(where.tenable) })
  if (where.cs !== undefined) cs.push({ entity: e, device_id: `cs-${e.toLowerCase()}`, hostname: where.csName ?? name.toUpperCase(), local_ip: where.csIp ?? ip, instance_id: null, serial_number: null, os_version: 'Windows Server 2019', last_seen: ago(where.cs) })
}
onprem('E31', 'fileserver-02', '10.30.0.12', { tenable: 5, cs: 1, csIp: '10.30.0.40' })
planted.push({ case: 'Same file server, but its IP changed between the two tools and nothing else links them', entities: ['E31'], expect: 'review (same hostname only)' })
onprem('E33', 'legacy-erp-01', '10.30.0.31', { tenable: 120 })
planted.push({ case: 'A server not seen in 120 days', entities: ['E33'], expect: 'stale' })
onprem('E34', 'dc-01', '10.30.0.5', { tenable: 1, cs: 1, fqdn: true })
planted.push({ case: 'Domain controller in both tools; same hostname and a shared IP link them', entities: ['E34'], expect: 'merge' })
onprem('E37', 'kiosk-lobby-01', '10.40.0.8', { cs: 2 })
planted.push({ case: 'A machine with the endpoint agent that the scanner never saw', entities: ['E37'], expect: 'coverage gap: not scanned' })

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
for (const orphan of ['tio-retired-77']) {
  v++
  vulns.push({ id: `vuln-${String(v).padStart(4, '0')}`, 'asset.id': orphan, 'definition.id': 100003, 'definition.name': 'Outdated runtime library', severity: 'high', state: 'OPEN', first_found: ago(90), last_found: ago(15) })
}
planted.push({ case: 'A finding points to an asset ID missing from the asset export', entities: [], expect: 'orphan finding' })

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
