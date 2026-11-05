# Internal handoff: Halden Outfitters (FICTIONAL)

Prepared Nov 5, 2026. Integrations config: SAFE public integrations page (captured Nov 4, 2026). Draft: Saved model draft from 2026-11-05 (claude-opus-5-5). Verified again just now against the current config and sources.

Verification: 69/70 cited facts verified in code (0 with a corrected line number). 1 drafted item(s) held back.

## Decisions needed from SAFE

- **Microsoft Defender** (Confirm with SAFE): No card named "Microsoft Defender". 5 cards on SAFE's list contain "defender": Microsoft 365 Defender, Microsoft Defender for Endpoints, Microsoft Defender for Identity via M365, Azure Defender for Cloud, Defender for Endpoint via M365. Need the exact product the customer licenses.
- **Snyk** (Custom work): Not on SAFE's public list (105 cards). SAFE claims more integrations than it lists publicly, so Confirm with SAFE before scoping a build.

## Every Confirm item

- CrowdStrike Falcon / How we connect: No vendor docs on file for this tool, so nothing is guessed.
- CrowdStrike Falcon / Permissions or scopes: No vendor docs on file for this tool, so nothing is guessed.
- ServiceNow ITSM / How we connect: No vendor docs on file for this tool, so nothing is guessed.
- ServiceNow ITSM / Permissions or scopes: No vendor docs on file for this tool, so nothing is guessed.
- Microsoft Defender / How we connect: Waiting on the exact product the customer licenses.
- Microsoft Defender / Permissions or scopes: Waiting on the exact product the customer licenses.
- Snyk / Permissions or scopes: The attached sources do not state this.
- Snyk sheet / Versioning: The draft for this item could not be verified against the sources, so it was held back.
- Snyk sheet / How records relate to assets: Needs input from the customer.

## Held back by the verifier

| Item | What the draft said | Why it was held back |
|---|---|---|
| custom_sheet/Snyk/versioning | Each request sends a `version` query parameter as a date in `YYYY-MM-DD` format. Snyk recommends `2024-10-15`. Deprecated endpoints return a `Sunset` header with the end-of-support date. | A version must look like /\d{4}-\d{2}-\d{2}\|YYYY-MM-DD/ |

## Effort

*Placeholder from config, not an estimate.*

| Tool | Bucket | Effort |
|---|---|---|
| Okta | Out of the box | TBD |
| Tenable Vulnerability Management | Out of the box | TBD |
| CrowdStrike Falcon | Out of the box | TBD |
| ServiceNow ITSM | Out of the box | TBD |
| Microsoft Defender | Confirm with SAFE | TBD |
| Snyk | Custom work | TBD |

## Data readiness (synthetic sample data)

**Not ready to feed a risk number.** Blocking items below.

| Check | Status | Detail |
|---|---|---|
| Export counts differ from what the customer's console shows | BLOCKING | Tenable VM asset export: export 20, console 22 |
| Possible duplicates are waiting for a person to decide | BLOCKING | 4 possible duplicates waiting for review |
| Findings point to assets no tool reports | BLOCKING | 2 findings with no matching asset |
| Stale assets need a decision: keep, exclude, or investigate | Warning | 3 assets not seen in over 30 days |
| Endpoint agent coverage is below the agreed threshold (PLACEHOLDER: 90%) | Warning | 87% of 23 active assets have an endpoint agent |

53 asset records became 29 assets (16 merged across tools, 1 duplicate inside one tool). 4 possible duplicate(s) need a person.

| Possible duplicate | Evidence | Confidence | Why it needs a person |
|---|---|---|---|
| app-01 (crowdstrike_hosts, tenable_assets) / app-01 (crowdstrike_hosts) | Same hostname, nothing else in common (hostname=app-01) | 0.60 | Weak match, and the records have different cloud instance IDs (i-0a1b2c3d4e5f60101 vs i-0a1b2c3d4e5f60202): likely different machines. A person decides. |
| fileserver-02 (tenable_assets) / fileserver-02 (crowdstrike_hosts) | Same hostname, nothing else in common (hostname=fileserver-02) | 0.60 | Below the merge threshold (0.7). A person decides. |
| hal-lt-008 (crowdstrike_hosts, tenable_assets) / hal-lt-008 (okta_devices) | Device display name equals a hostname (display_name=hal-lt-008) | 0.50 | Below the merge threshold (0.7). A person decides. |
| hal-lt-005 (crowdstrike_hosts, okta_devices) / hal-lt-009 (crowdstrike_hosts, okta_devices, tenable_assets) | Shared IP address only (IPs get reassigned) (ipv4=10.20.4.17) | 0.30 | Weak match, and the records have different serial numbers (C02HAL005 vs C02HAL009): likely different machines. A person decides. |

### Field mappings to confirm

- tenable_assets.id -> source_id: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_assets.fqdns -> fqdn: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_assets.hostnames -> hostname: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_assets.ipv4s -> ipv4: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_assets.macs -> mac: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_assets.cloud_instance_id -> cloud_instance_id: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_assets.operating_systems -> os: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_assets.last_seen -> last_seen: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_vulns.definition.name -> title: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_vulns.severity -> severity: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_vulns.state -> status: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_vulns.first_found -> first_seen: Confirm: placeholder field name. The attached docs do not document this export field.
- tenable_vulns.last_found -> last_seen: Confirm: placeholder field name. The attached docs do not document this export field.
- crowdstrike_hosts.device_id -> source_id: Confirm: placeholder field name. The attached docs do not document this export field.
- crowdstrike_hosts.hostname -> hostname: Confirm: placeholder field name. The attached docs do not document this export field.
- crowdstrike_hosts.local_ip -> ipv4: Confirm: placeholder field name. The attached docs do not document this export field.
- crowdstrike_hosts.mac_address -> mac: Confirm: placeholder field name. The attached docs do not document this export field.
- crowdstrike_hosts.instance_id -> cloud_instance_id: Confirm: placeholder field name. The attached docs do not document this export field.
- crowdstrike_hosts.serial_number -> serial_number: Confirm: placeholder field name. The attached docs do not document this export field.
- crowdstrike_hosts.os_version -> os: Confirm: placeholder field name. The attached docs do not document this export field.
- crowdstrike_hosts.last_seen -> last_seen: Confirm: placeholder field name. The attached docs do not document this export field.

*Placeholder settings to agree with the customer: Stale after 30 days; Scanned within 30 days; Endpoint agent coverage is below the agreed threshold (PLACEHOLDER: 90%).*

## Config files in play (swap these for SAFE's internal versions)

- config/integrations.json
- config/aliases.json
- config/matching.json
- config/tool_profiles.json
- config/connection_order.json
- config/scoping_template.json
- config/canonical_schema.json
- config/source_mappings.json
- config/match_rules.json
- config/data_rules.json
- config/effort_placeholders.json
