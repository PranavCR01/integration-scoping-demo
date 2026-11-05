# Attachments for the SAFE integration scoping demo

| File | What it is | Source |
|---|---|---|
| 01_safe_integrations_public_list.md | All 105 integration cards on SAFE's public page, plus matching notes | safe.security/integrations, captured Nov 4, 2026 |
| 02_okta_management_openapi_v2026.42.1.yaml | Okta Admin Management API, OpenAPI spec (minimal variant) | github.com/okta/okta-management-openapi-spec, dist/current |
| 03_tenable_vm_api_notes.md | Auth, vuln export, asset export, job lifecycle, rate limiting, each with its source URL | developer.tenable.com |
| 03b_pytenable_exports_api.py | Tenable's official Python SDK export module, the ground truth for export endpoint paths | github.com/tenable/pyTenable |
| 04_snyk_rest_openapi.json | Snyk REST API, OpenAPI 3.0.3 spec | github.com/snyk/user-docs (mirror of docs.snyk.io) |
| 04b_snyk_about_rest_api.md | Regions, versioning, pagination, rate limits | same |
| 04c_snyk_authentication.md | Token types, header format, Enterprise plan requirement | same |
| 05_example_scoping_plan.md | Target output: a one-page plan for a fictional customer, built only from the files above | hand-built reference |

Okta, Tenable VM, CrowdStrike and ServiceNow are on SAFE's public list (Out of the box). "Microsoft Defender" is ambiguous (Confirm with SAFE). Snyk is not on the public list (Custom work example).
