# Integration Scoping Plan: Halden Outfitters (FICTIONAL CUSTOMER)

**Goal:** A board-ready cyber risk figure within 30 days of kickoff.

**Plan built for:** Board-ready risk figure

**Prepared:** Nov 9, 2026 · **Status:** Draft for customer review

**Sources:** SAFE public integrations page (captured Nov 4, 2026); vendor API docs listed under each tool. Anything not found in those sources is marked **Confirm**.

**At a glance:** 4 of 6 tools can be connected now. Before the risk figure can be trusted: 4 items for SAFE to confirm, 9 answers from Halden Outfitters and the data checks to run.

---

## 1. Coverage check

| Customer tool | Bucket | Why |
|---|---|---|
| Okta | Out of the box | Exact match: "Okta" on SAFE's list ("Okta via M365" is also listed) |
| Tenable VM | Out of the box | Alias match: "Tenable VM" is configured as "Tenable Vulnerability Management" (config/aliases.json), which is on SAFE's list |
| CrowdStrike Falcon | Out of the box | Exact match: "CrowdStrike Falcon" on SAFE's list (related card also listed: "Crowdstrike Falcon Exposure Management (Spotlight)") |
| ServiceNow ITSM | Out of the box | Exact match: "ServiceNow ITSM" on SAFE's list |
| Microsoft Defender | Confirm with SAFE | No card named "Microsoft Defender". 5 cards on SAFE's list contain "defender": Microsoft 365 Defender, Microsoft Defender for Endpoints, Microsoft Defender for Identity via M365, Azure Defender for Cloud, Defender for Endpoint via M365. Need the exact product the customer licenses. |
| Snyk | Custom work | Not on SAFE's public list (105 cards). SAFE claims more integrations than it lists publicly, so Confirm with SAFE before scoping a build. |

## 2. Connection order (draft rules, editable)

1. **Tenable VM and CrowdStrike Falcon:** What assets exist and what vulnerabilities they have. Nothing downstream is meaningful without this.
2. **Okta:** Who has access to what.
3. **ServiceNow ITSM:** Where fixes get tracked once priorities exist.
4. **Microsoft Defender:** What assets exist and what vulnerabilities they have. Nothing downstream is meaningful without this. Connect after the exact product is confirmed.
5. **Snyk:** Additional findings that refine the picture. Connect after SAFE confirms whether a connector exists.

*Ordering rules come from a config file, not the model. Confirm against SAFE's onboarding playbook.*

## 3. Access checklist

| Tool | What we need | Customer owner | Source |
|---|---|---|---|
| Okta | How we connect: We connect with an Okta API token sent in the `Authorization` header with the `SSWS` prefix. Okta also supports an OAuth access token sent in the same header as a `Bearer` token. Permissions or scopes: For OAuth access, read access to the core records uses these scopes: `okta.users.read`, `okta.groups.read`, `okta.apps.read`, `okta.devices.read` and `okta.logs.read`. | Okta administrator | Okta Management OpenAPI v2026.42.1, lines 100424, 100429; Okta Management OpenAPI v2026.42.1, lines 2004, 11809, 14115, 19732, 27061 |
| Tenable VM (Tenable Vulnerability Management) | How we connect: We connect with an access key and secret key generated for a user account. They are sent in the `X-APIKeys` header as `accessKey` and `secretKey`, against `https://cloud.tenable.com`. Permissions or scopes: Vulnerability export needs the `Basic` role or the custom privilege `VM.VM_EXPLORE.VM_EXPLORE.EXPORT`. The user also needs `Can View` access on the exported assets, which the `All Assets` object can grant. The sources do not name the role needed for asset export. | Vulnerability management lead | Tenable VM API notes (developer.tenable.com), lines 7, 8, 9; Tenable VM API notes (developer.tenable.com), line 14 |
| CrowdStrike Falcon | How we connect: **Confirm.** No vendor docs on file for this tool, so nothing is guessed. Permissions or scopes: **Confirm.** No vendor docs on file for this tool, so nothing is guessed. | Endpoint security (EDR) administrator | None (no vendor docs on file) |
| ServiceNow ITSM | How we connect: **Confirm.** No vendor docs on file for this tool, so nothing is guessed. Permissions or scopes: **Confirm.** No vendor docs on file for this tool, so nothing is guessed. | ServiceNow administrator | None (no vendor docs on file) |
| Microsoft Defender | How we connect: **Confirm.** Waiting on the exact product the customer licenses. Permissions or scopes: **Confirm.** Waiting on the exact product the customer licenses. | Microsoft security administrator | None (no vendor docs on file) |
| Snyk | How we connect: We connect with a Snyk service account token sent in the `Authorization` header with the `token` prefix. Snyk API access requires the Enterprise plan. Permissions or scopes: **Confirm.** The attached sources do not state this. | Application security lead | Snyk docs: Authentication for API, lines 13, 22, 44 |

*For out-of-the-box connectors, SAFE's connector documentation decides the exact access needed. The access details above are what each vendor documents; confirm them with SAFE.*

## 4. Custom work scoping sheet: Snyk

*Snyk is not on SAFE's public list. Confirm with SAFE whether a connector exists before building one.*

| Item | Detail | Source |
|---|---|---|
| Base URL | The default base URL is `https://api.snyk.io/rest`. Other regions use their own base URL, for example `https://api.eu.snyk.io/rest`. Tokens only work in the region where they were created. | Snyk REST OpenAPI spec, line 122726; Snyk docs: About the REST API, lines 18, 20 |
| Versioning | **Confirm.** The draft for this item could not be verified against the sources, so it was held back. | None |
| Authentication | Send the token in the `Authorization` header with the `token` prefix. Use a service account token for automation. Requests that contain data must send `Content-Type: application/vnd.api+json`. | Snyk REST OpenAPI spec, line 31109; Snyk docs: Authentication for API, line 44; Snyk docs: About the REST API, line 33 |
| Endpoints | `/orgs` lists organizations. `/orgs/{org_id}/projects` lists projects and `/orgs/{org_id}/targets` lists targets. `/orgs/{org_id}/issues` and `/groups/{group_id}/issues` list issues. | Snyk REST OpenAPI spec, lines 35290, 62402, 76022, 80094, 85213 |
| Useful filters | The issues list accepts `updated_after`, `created_after`, `effective_severity_level`, `status`, `ignored` and `type`. | Snyk REST OpenAPI spec, lines 76056, 76068, 76086, 76095, 76098, 76101 |
| Pagination | Cursor-based. Responses include next and previous links built from `starting_after`, `ending_before` and `limit`. Setting the `sort` parameter removes the guarantee of consistent pages, so we keep the default order. | Snyk REST OpenAPI spec, lines 76030, 76033, 76036; Snyk docs: About the REST API, line 94 |
| Rate limits | `1620` requests per minute per API key. Above that, Snyk returns `429` until requests stop for one minute. These requests can be retried later. | Snyk docs: About the REST API, line 135 |
| Fields to map | From `/orgs/{org_id}/issues`: `id` maps to `finding_id`, `attributes.title` to `title`, `attributes.type` to `type`, `attributes.effective_severity_level` to `severity`, `attributes.status` to `status`, and `attributes.created_at` to `first_seen`. | Snyk REST OpenAPI spec, lines 17815, 18341, 18353, 18442, 18450, 18464, 76022; Our common format (config), lines 17, 19, 20, 21, 22, 23 |
| How records relate to assets | **Confirm.** Needs input from the customer. | None |

## 5. Data checks before anything feeds a risk number

- **Counts:** Asset and finding totals match what each tool's own console shows.
- **Duplicates:** The same machine seen by more than one tool is merged once, with the reason and a confidence level for each match. Weak matches go to a person to review.
- **Staleness:** Assets not seen within the customer's agreed window are flagged.
- **Coverage:** Share of assets with an endpoint agent; share scanned recently.
- **Orphan findings:** Findings that point to an asset no tool reports are flagged.
- **Tenable Vulnerability Management:** Without time filters, a vulnerability export only includes findings found or fixed in the last `30` days. We will set time filters to match the agreed lookback. (Tenable VM API notes (developer.tenable.com), line 21)
- **Okta:** Okta devices include `profile.serialNumber`, which maps to `serial_number`, and `profile.displayName`, which maps to `display_name`. These can help match the same device across tools. (Okta Management OpenAPI v2026.42.1, lines 76863, 76903; Our common format (config), lines 10, 11)

## 6. Open questions for Halden Outfitters

1. SAFE also lists "Crowdstrike Falcon Exposure Management (Spotlight)". Do you use it in addition to CrowdStrike Falcon?
2. Which Microsoft Defender product do you license? SAFE lists these: Microsoft 365 Defender, Microsoft Defender for Endpoints, Microsoft Defender for Identity via M365, Azure Defender for Cloud, Defender for Endpoint via M365.
3. Who will present the risk figure to the board, and when is the first meeting it needs to be ready for?
4. Who owns the admin account for each tool, and who approves API access?
5. Which systems hold your most critical data or drive the most revenue? These count first in the risk figure.
6. How far back should vulnerability history go, and after how many days without activity should an asset count as stale?
7. Do you have an existing asset inventory, such as a CMDB, that we should treat as the source of truth?
8. Is your Snyk account on the Enterprise plan, and which Snyk region hosts it? API access needs the Enterprise plan, and tokens only work in their own region.
9. Can you create a dedicated Tenable user account for this integration? Tenable recommends a separate user for each API integration, and each user has one valid API key at a time.

---

*Fictional customer. Built from public documentation only. SAFE's internal connector list and scoping template would replace the public versions used here.*
