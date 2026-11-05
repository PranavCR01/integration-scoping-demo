# Tenable Vulnerability Management API: notes from public docs

Compiled Nov 4, 2026 from Tenable's developer portal. developer.tenable.com may not be reachable from a build environment, so the relevant facts are copied here with their source. Exact endpoint paths are confirmed against Tenable's official Python SDK (attached as 03b_pytenable_exports_api.py, from github.com/tenable/pyTenable).

## Authentication
Source: https://developer.tenable.com/docs/get-started
- Base URL used in examples: `https://cloud.tenable.com`
- Header: `X-APIKeys: accessKey=<access_key>;secretKey=<secret_key>`
- Keys are generated per user account ("Generate API Keys" in the Tenable VM User Guide). The page does not name a specific role for general API use.

## Export vulnerabilities
Source: https://developer.tenable.com/reference/exports-vulnerabilities
- `POST https://cloud.tenable.com/vulns/export`
- Permissions: Basic [16] role or the custom privilege `VM.VM_EXPLORE.VM_EXPLORE.EXPORT`, plus "Can View" access control permission on the exported asset objects (the `All Assets` object can grant this). Administrator [64] users are exempt from the Can View requirement.
- Body parameters:
  - `num_assets` (int32, default 50, range 50 to 5000): assets per chunk; out-of-range values are clamped.
  - `include_unlicensed` (boolean, default false)
  - `include_software_vulns` (boolean, default false)
  - `include_plugin_output` (boolean, default true)
  - `properties` (array of strings): limits output; core properties (`id`, `asset.id`, `definition.id`, exploit/patch metadata) are always included.
  - `filters` (object). Default without time filters: only vulnerabilities found or fixed in the last 30 days are exported.
- Responses: 200 queued; 400 invalid; 401 invalid API keys; 403 no permission; 409 duplicate of a running export; 429 too many requests; 500 internal error.
- Deprecation: `vpr_v2_score` filter and `plugin.vpr_v2` property removed Oct 1, 2026 (400 `BAD_REQUEST_UNKNOWN_PROPERTY`); use `vpr_score` and `plugin.vpr`.

## Export assets
Sources: https://developer.tenable.com/docs/refine-asset-export-requests and the SDK
- Paths (from the SDK EXPORTS_MAP): v1 `POST /assets/export`; v2 `POST /assets/v2/export` (jobs for both live under `assets/export`).
- Body: `chunk_size` (doc examples use 100; SDK default 1000; the doc does not state limits) and `filters`.
- Filters documented on that page: `servicenow_sysid` (boolean), `created_at` (Unix timestamp), `sources` (array, e.g. `NESSUS_SCAN`), `tag.<category>` (array; v1 only, v2 does not support it). Values in one tag category are ORed; categories are ANDed.

## Export job lifecycle (paths from the official SDK)
- Status: `GET /{vulns|assets}/export/{export_uuid}/status`
- Download chunk: `GET /{vulns|assets}/export/{export_uuid}/chunks/{chunk_id}`
- Cancel: `POST /{vulns|assets}/export/{export_uuid}/cancel`
- List jobs: `GET /{vulns|assets}/export/status`
- The status response field names (e.g. which field lists available chunks) are not captured here. Mark them "Confirm" unless verified.

## Rate limiting
Source: https://developer.tenable.com/docs/rate-limiting
- Limits are per user per minute and depend on current processing load; no fixed number is published.
- Over the limit: HTTP 429 with a `retry-after` header in seconds (example: `retry-after:30`).
- One valid API key per user at a time.
- Recommendations: use the export endpoints rather than workbench endpoints; don't multi-thread requests; use a unique user account for each API integration.
- Concurrency limits for exports are in a separate "Concurrency Limiting" article that is NOT captured here. Mark as "Confirm."
