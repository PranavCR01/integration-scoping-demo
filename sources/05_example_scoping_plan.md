# Integration Scoping Plan: Halden Outfitters (FICTIONAL CUSTOMER)

**Goal:** a board-ready cyber risk figure within 30 days of kickoff.
**Prepared:** Nov 2026 · **Status:** draft for customer review
**Sources:** SAFE public integrations page (captured Nov 4, 2026); vendor API docs listed under each tool. Anything not found in those sources is marked **Confirm**.

---

## 1. Coverage check

| Customer tool | Bucket | Why |
|---|---|---|
| Okta | Out of the box | Exact match: "Okta" on SAFE's list ("Okta via M365" is also listed) |
| Tenable Vulnerability Management | Out of the box | Exact match on SAFE's list |
| CrowdStrike Falcon | Out of the box | Exact match on SAFE's list |
| ServiceNow (ITSM) | Out of the box | Exact match: "ServiceNow ITSM" |
| "Microsoft Defender" | Confirm with SAFE | SAFE's list has four Defender variants; need the exact product the customer licenses |
| Snyk | Custom work | Not on SAFE's public list. SAFE claims 150+ integrations but lists 105, so **Confirm** with SAFE before scoping a build |

## 2. Connection order (draft rules, editable)

1. **Tenable VM and CrowdStrike Falcon:** what assets exist and what vulnerabilities they have. Nothing downstream is meaningful without this.
2. **Okta:** who has access to what.
3. **ServiceNow ITSM:** where fixes get tracked once priorities exist.
4. **Defender:** after the exact product is confirmed.
5. **Snyk:** after SAFE confirms whether a connector exists.

*Ordering rules come from a config file, not the model. **Confirm** against SAFE's onboarding playbook.*

## 3. Access checklist

| Tool | What we need | Customer owner | Source |
|---|---|---|---|
| Okta | API token (`Authorization: SSWS {token}`) or OAuth 2.0 app. Read scopes in the spec: `okta.users.read`, `okta.groups.read`, `okta.apps.read`, `okta.logs.read`, `okta.devices.read` | Okta admin | Okta Management OpenAPI v2026.42.1 |
| Tenable VM | API key pair (`X-APIKeys: accessKey=...;secretKey=...`) on a dedicated user. Basic [16] role or `VM.VM_EXPLORE.VM_EXPLORE.EXPORT`, plus Can View on assets | Vulnerability management lead | developer.tenable.com (export, rate limiting) |
| CrowdStrike Falcon | **Confirm** (no vendor docs reviewed) | EDR admin | None |
| ServiceNow ITSM | **Confirm** (no vendor docs reviewed) | ServiceNow admin | None |
| Snyk | API access requires a Snyk Enterprise plan. A service account token (`Authorization: token ...`) or a Bearer token. Tokens only work in their own region, so we need the customer's region URL | AppSec lead | Snyk authentication doc; "About the REST API" |

*Which Okta scopes SAFE's connector actually needs: **Confirm** with SAFE.*

## 4. Custom work scoping sheet: Snyk

| Item | Detail | Source |
|---|---|---|
| Base URL | `https://api.snyk.io/rest` (region-specific; EU and other regions use different hosts) | Spec `servers`; About the REST API |
| Versioning | Every call needs `?version=YYYY-MM-DD`; Snyk recommends `2024-10-15` | About the REST API |
| Endpoints | `GET /orgs` · `GET /orgs/{org_id}/projects` · `GET /orgs/{org_id}/issues` | Spec `paths` |
| Useful filters on issues | `type`, `status`, `effective_severity_level`, `updated_after`, `created_after`, `ignored` | Spec parameters |
| Pagination | Cursor-based (`starting_after`, `ending_before`, `limit`) | About the REST API; spec |
| Rate limit | 1,620 requests per minute per API key; 429 on excess, safe to retry | About the REST API |
| Fields to map | `id`, `attributes.title`, `attributes.type`, `attributes.status`, `attributes.effective_severity_level`, `attributes.created_at`, `attributes.updated_at`, `relationships.scan_item`, `relationships.organization` | Spec response schema |
| Mapping to our asset model | How a Snyk project relates to a host or cloud asset | **Confirm with customer** |

## 5. Data checks before anything feeds a risk number

- **Counts:** asset and finding totals match what each tool's own console shows.
- **Duplicates:** the same machine seen by Tenable, CrowdStrike and Okta devices (match on hostname, IP, cloud instance ID), with a confidence level for each match.
- **Staleness:** assets not seen within the customer's agreed window.
- **Coverage:** share of assets with an EDR agent; share scanned recently.
- **Tenable default window:** without time filters, the vulnerability export covers only the last 30 days. Agree the lookback window with the customer.

## 6. Open questions for Halden Outfitters

1. Which Microsoft Defender product do you license?
2. Which Snyk region is your account in, and are you on the Enterprise plan (required for API access)?
3. Who owns each tool's admin account, and who approves API access?
4. Which systems hold your most critical data or revenue? This decides what counts first in the risk figure.
5. What lookback window should vulnerability history use?
6. Is there an existing asset inventory (a CMDB) we should treat as the source of truth?

---
*Fictional customer. Built from public documentation only. SAFE's internal connector list and scoping template would replace the public versions used here.*
