# Internal handoff: Halden Outfitters (FICTIONAL)

Prepared Nov 19, 2026. Integrations config: SAFE public integrations page (captured Nov 4, 2026). Draft: Saved model draft from 2026-11-05 (claude-opus-5-5). Verified again just now against the current config and sources.

Verification: 69/70 cited facts verified in code. 1 drafted item held back.

## Who owes what

### Okta administrator (Okta)

- access: How we connect: Authorization, SSWS, Bearer
- access: Permissions or scopes: okta.users.read, okta.groups.read, okta.apps.read, okta.devices.read, okta.logs.read

### Vulnerability management lead (Tenable VM)

- access: How we connect: X-APIKeys, accessKey, secretKey, https://cloud.tenable.com
- access: Permissions or scopes: Basic, VM.VM_EXPLORE.VM_EXPLORE.EXPORT, Can View, All Assets
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

- access: How we connect: Authorization, token
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

- data: Review 4 possible duplicates on the Data readiness tab (app-01, fileserver-02, hal-lt-008, hal-lt-005).
- data: Trace 2 findings that point to assets no export contains (tio-retired-77, tio-retired-78).
- data: Raise the 2 assets with no endpoint agent with the customer: db-prod-01, fileserver-01.

*Access lines are short here. The full verified wording is in the customer plan, section 3, and in each email.*

## Every Confirm item

| Tool | What's open | Why | Who resolves it |
|---|---|---|---|
| Microsoft Defender | Which product this is | No card named "Microsoft Defender". 5 cards on SAFE's list contain "defender": Microsoft 365 Defender, Microsoft Defender for Endpoints, Microsoft Defender for Identity via M365, Azure Defender for Cloud, Defender for Endpoint via M365. Need the exact product the customer licenses | Customer (which product), then SAFE |
| Snyk | Whether a connector exists | Not on SAFE's public list (105 cards). SAFE claims more integrations than it lists publicly, so Confirm with SAFE before scoping a build | SAFE |
| CrowdStrike Falcon | How we connect, Permissions or scopes | No vendor docs on file for this tool, so nothing is guessed | SAFE (what its connector needs) |
| ServiceNow ITSM | How we connect, Permissions or scopes | No vendor docs on file for this tool, so nothing is guessed | SAFE (what its connector needs) |
| Microsoft Defender | How we connect, Permissions or scopes | Waiting on the exact product the customer licenses | Customer (which product), then SAFE |
| Snyk | Permissions or scopes | The attached sources do not state this | SAFE (whether a connector exists, and what it needs) |
| Snyk | Scoping sheet: Versioning | The draft for this item could not be verified against the sources, so it was held back | Us (a new model draft, checked again) |
| Snyk | Scoping sheet: How records relate to assets | Needs input from the customer | Customer |

## Held back by the verifier

| Item | What the draft said | Why it was held back |
|---|---|---|
| custom_sheet/Snyk/versioning | Each request sends a `version` query parameter as a date in `YYYY-MM-DD` format. Snyk recommends `2024-10-15`. Deprecated endpoints return a `Sunset` header with the end-of-support date. | "Sunset" was labelled as an API version, but an API version must be a date such as 2024-10-15 (or the format YYYY-MM-DD). The draft labelled this fact wrongly, so the item is held back |

## Data readiness (synthetic sample data)

**Data not ready yet.** Blocking items below.

| Check | Status | Detail |
|---|---|---|
| Export counts differ from what the customer's console shows | BLOCKING | Tenable VM asset export: export 20, console 22 |
| Possible duplicates are waiting for a person to decide | BLOCKING | 4 possible duplicates waiting for review |
| Findings point to assets no tool reports | BLOCKING | 2 findings with no matching asset |
| Stale assets need a decision: keep, exclude, or investigate | Warning | 3 assets not seen in over 30 days |
| Endpoint agent coverage is below the agreed threshold (PLACEHOLDER: 90%) | Warning | 87% of 23 active assets have an endpoint agent (1 without one is waiting on a duplicate decision and may have one) |

53 asset records became 29 assets (16 merged across tools, 1 duplicate inside one tool). 4 possible duplicates need a person.

| Possible duplicate | Evidence | Why it needs a person |
|---|---|---|
| app-01 (CrowdStrike, Tenable) / app-01 (CrowdStrike) | Same hostname, nothing else in common (hostname=app-01) | Weak match, and the records have different cloud instance IDs (i-0a1b2c3d4e5f60101 vs i-0a1b2c3d4e5f60202): likely different machines. A person decides. |
| fileserver-02 (Tenable) / fileserver-02 (CrowdStrike) | Same hostname, nothing else in common (hostname=fileserver-02) | Not enough on its own to merge. A person decides. |
| hal-lt-008 (CrowdStrike, Tenable) / hal-lt-008 (Okta) | Device display name equals a hostname (display_name=hal-lt-008) | Not enough on its own to merge. A person decides. |
| hal-lt-005 (CrowdStrike, Okta) / hal-lt-009 (CrowdStrike, Okta, Tenable) | Shared IP address only (IPs get reassigned) (ipv4=10.20.4.17) | Weak match, and the records have different serial numbers (C02HAL005 vs C02HAL009): likely different machines. A person decides. |

### Field mappings to confirm

*Placeholder field names: the attached docs do not document these export fields. Confirm each one before the data is used.*

- Tenable VM asset export: `id`, `fqdns`, `hostnames`, `ipv4s`, `macs`, `cloud_instance_id`, `operating_systems`, `last_seen`
- Tenable VM vulnerability export: `definition.name`, `severity`, `state`, `first_found`, `last_found`
- CrowdStrike Falcon host list: `device_id`, `hostname`, `local_ip`, `mac_address`, `instance_id`, `serial_number`, `os_version`, `last_seen`

*Placeholder settings to agree with the customer: Stale after 30 days; Scanned within 30 days; Endpoint agent coverage target 90%.*

## Config files in play (swap these for SAFE's internal versions)

| Config file | SAFE's version needed on day one |
|---|---|
| config/integrations.json | SAFE's full connector list, including connectors not on the public website |
| config/aliases.json | The names customers actually use for each tool, from past onboardings |
| config/matching.json | SAFE's rules for vague names, such as a bare vendor name that covers several products |
| config/tool_profiles.json | Each tool's role, who usually owns it on the customer side, and SAFE's connector docs to check against instead of vendor docs |
| config/connection_order.json | SAFE's onboarding playbook: what to connect first for each kind of customer goal |
| config/scoping_template.json | SAFE's scoping template: plan sections, what to find out per tool, and standard kickoff questions |
| config/canonical_schema.json | SAFE's data model for assets and findings |
| config/source_mappings.json | SAFE's field mappings from each tool's export into that data model |
| config/match_rules.json | SAFE's rules for deciding two records are the same machine |
| config/data_rules.json | SAFE's standard thresholds: stale window, scan window, coverage target, and what blocks the data |
| config/effort_placeholders.json | SAFE's typical effort per integration type, if it tracks one |
