# Internal handoff: Halden Outfitters (FICTIONAL)

Prepared Nov 10, 2026. Integrations config: SAFE public integrations page (captured Nov 4, 2026). Draft: Saved model draft from 2026-11-05 (claude-opus-5-5). Verified again just now against the current config and sources.

Verification: 69/70 cited facts verified in code (0 with a corrected line number). 1 drafted item held back.

## Decisions needed from SAFE

- **Microsoft Defender** (Confirm with SAFE): No card named "Microsoft Defender". 5 cards on SAFE's list contain "defender": Microsoft 365 Defender, Microsoft Defender for Endpoints, Microsoft Defender for Identity via M365, Azure Defender for Cloud, Defender for Endpoint via M365. Need the exact product the customer licenses.
- **Snyk** (Custom work): Not on SAFE's public list (105 cards). SAFE claims more integrations than it lists publicly, so Confirm with SAFE before scoping a build.

## Who owes what

### Okta administrator (Okta)

- access: How we connect: We connect with an Okta API token sent in the Authorization header with the SSWS prefix. Okta also supports an OAuth access token sent in the same header as a Bearer token.
- access: Permissions or scopes: For OAuth access, read access to the core records uses these scopes: okta.users.read, okta.groups.read, okta.apps.read, okta.devices.read and okta.logs.read.

### Vulnerability management lead (Tenable VM)

- access: How we connect: We connect with an access key and secret key generated for a user account. They are sent in the X-APIKeys header as accessKey and secretKey, against https://cloud.tenable.com.
- access: Permissions or scopes: Vulnerability export needs the Basic role or the custom privilege VM.VM_EXPLORE.VM_EXPLORE.EXPORT. The user also needs Can View access on the exported assets, which the All Assets object can grant. The sources do not name the role needed for asset export.
- question: Can you create a dedicated Tenable user account for this integration? Tenable recommends a separate user for each API integration, and each user has one valid API key at a time.
- data: Your Tenable VM console shows 22 assets, but our export returned 20. Can you help us find which ones are missing?

### Endpoint security (EDR) administrator (CrowdStrike Falcon)

- access: We will confirm the exact access CrowdStrike Falcon needs and follow up. Please confirm you are the right person to set it up.
- question: SAFE also lists "Crowdstrike Falcon Exposure Management (Spotlight)". Do you use it in addition to CrowdStrike Falcon?

### ServiceNow administrator (ServiceNow ITSM)

- access: We will confirm the exact access ServiceNow ITSM needs and follow up. Please confirm you are the right person to set it up.

### Microsoft security administrator (Microsoft Defender)

- question: Which Microsoft Defender product do you license? SAFE lists these: Microsoft 365 Defender, Microsoft Defender for Endpoints, Microsoft Defender for Identity via M365, Azure Defender for Cloud, Defender for Endpoint via M365.

### Application security lead (Snyk)

- access: How we connect: We connect with a Snyk service account token sent in the Authorization header with the token prefix. Snyk API access requires the Enterprise plan.
- question: Is your Snyk account on the Enterprise plan, and which Snyk region hosts it? API access needs the Enterprise plan, and tokens only work in their own region.

### Customer project lead

- question: Who will present the risk figure to the board, and when is the first meeting it needs to be ready for?
- question: Who owns the admin account for each tool, and who approves API access?
- question: Which systems hold your most critical data or drive the most revenue? These count first in the risk figure.
- question: How far back should vulnerability history go, and after how many days without activity should an asset count as stale?
- question: Do you have an existing asset inventory, such as a CMDB, that we should treat as the source of truth?
- data: 3 assets not seen in over 30 days (legacy-erp-01, print-srv-01, scanner-test-vm): keep, exclude, or investigate?

### SAFE platform team

- decision: Microsoft Defender: which listed product does the connector cover? Candidates: Microsoft 365 Defender, Microsoft Defender for Endpoints, Microsoft Defender for Identity via M365, Azure Defender for Cloud, Defender for Endpoint via M365.
- decision: Snyk: is there a connector beyond the public list? If not, review the custom scoping sheet.
- decision: CrowdStrike Falcon: what access does SAFE's connector need? No vendor docs on file here.
- decision: ServiceNow ITSM: what access does SAFE's connector need? No vendor docs on file here.
- decision: For connectors with vendor docs on file: confirm the exact scopes and roles SAFE's connector needs (the plan lists what each vendor documents).

### Forward deployed engineer (us)

- data: Decide whether app-01 (CrowdStrike, Tenable) and app-01 (CrowdStrike) are the same machine. Evidence: same hostname, nothing else in common.
- data: Decide whether fileserver-02 (Tenable) and fileserver-02 (CrowdStrike) are the same machine. Evidence: same hostname, nothing else in common.
- data: Decide whether hal-lt-008 (CrowdStrike, Tenable) and hal-lt-008 (Okta) are the same machine. Evidence: device display name equals a hostname.
- data: Decide whether hal-lt-005 (CrowdStrike, Okta) and hal-lt-009 (CrowdStrike, Okta, Tenable) are the same machine. Evidence: shared IP address only.
- data: Trace 2 findings that point to assets no export contains (tio-retired-77, tio-retired-78).
- data: Raise the 3 assets with no endpoint agent with the customer: db-prod-01, fileserver-01, fileserver-02.

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
| custom_sheet/Snyk/versioning | Each request sends a `version` query parameter as a date in `YYYY-MM-DD` format. Snyk recommends `2024-10-15`. Deprecated endpoints return a `Sunset` header with the end-of-support date. | "Sunset" was labelled as an API version, but an API version must be a date such as 2024-10-15 (or the format YYYY-MM-DD). The draft labelled this fact wrongly, so the item is held back |

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

**Data not ready yet.** Blocking items below.

| Check | Status | Detail |
|---|---|---|
| Export counts differ from what the customer's console shows | BLOCKING | Tenable VM asset export: export 20, console 22 |
| Possible duplicates are waiting for a person to decide | BLOCKING | 4 possible duplicates waiting for review |
| Findings point to assets no tool reports | BLOCKING | 2 findings with no matching asset |
| Stale assets need a decision: keep, exclude, or investigate | Warning | 3 assets not seen in over 30 days |
| Endpoint agent coverage is below the agreed threshold (PLACEHOLDER: 90%) | Warning | 87% of 23 active assets have an endpoint agent |

53 asset records became 29 assets (16 merged across tools, 1 duplicate inside one tool). 4 possible duplicates need a person.

| Possible duplicate | Evidence | Confidence | Why it needs a person |
|---|---|---|---|
| app-01 (CrowdStrike, Tenable) / app-01 (CrowdStrike) | Same hostname, nothing else in common (hostname=app-01) | 0.60 | Weak match, and the records have different cloud instance IDs (i-0a1b2c3d4e5f60101 vs i-0a1b2c3d4e5f60202): likely different machines. A person decides. |
| fileserver-02 (Tenable) / fileserver-02 (CrowdStrike) | Same hostname, nothing else in common (hostname=fileserver-02) | 0.60 | Below the merge threshold (0.7). A person decides. |
| hal-lt-008 (CrowdStrike, Tenable) / hal-lt-008 (Okta) | Device display name equals a hostname (display_name=hal-lt-008) | 0.50 | Below the merge threshold (0.7). A person decides. |
| hal-lt-005 (CrowdStrike, Okta) / hal-lt-009 (CrowdStrike, Okta, Tenable) | Shared IP address only (IPs get reassigned) (ipv4=10.20.4.17) | 0.30 | Weak match, and the records have different serial numbers (C02HAL005 vs C02HAL009): likely different machines. A person decides. |

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

*Placeholder settings to agree with the customer: Stale after 30 days; Scanned within 30 days; Endpoint agent coverage target 90%.*

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
