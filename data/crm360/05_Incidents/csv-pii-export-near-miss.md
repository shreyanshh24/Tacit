# Postmortem — 2025-10 CSV Export PII Near-Miss (CRM360-20)
> Source: Google Drive / CRM360 / 05_Incidents

  

Severity: SEV2 (near-miss, no external exposure)  •  Status: Resolved

  

Summary

The CSV export path read records directly and bypassed the PII masking that was applied only at the API layer. A restricted-role user could export contact fields (phone, email, address) that the UI masked for them. Caught internally before any customer data was improperly disclosed. Fix: enforce masking at the DATA-ACCESS LAYER so every read path — UI, export, reporting — inherits it.

  

Impact

\- No confirmed external data exposure. Near-miss.

\- Potential exposure: masked PII fields retrievable via CSV export by roles that should not see them.

\- Affected surface: export feature for tenants using restricted roles / field masking.

  

Timeline (2025-10)

\- Masking implemented at the API serialization layer during RBAC work (CRM360-15).

\- Export feature built to stream records for performance, reading closer to the data layer — and thus NOT passing through API-layer masking.

\- During review of the export path, Priya Nair noticed exported columns included fields the same user could not see in the UI.

\- Reproduced with a restricted-role test user: masked fields present in the CSV.

\- Export masking gap patched; audit of other non-API read paths (reporting) initiated.

  

Root Cause

Masking was enforced at the wrong layer. Applying it at the API/serialization layer meant any code path that read data without going through that serializer (bulk export, and potentially reporting) skipped masking entirely. Defense was attached to a path, not to the data.

  

Resolution

\- Move masking enforcement to the data-access layer (CRM360-20 fix, per RBAC spec CRM360-15). Sensitive columns are masked as they are read, so UI, export, and reporting all inherit the same rules.

\- Re-run the export with restricted roles to confirm masked fields are absent.

\- Audit all read paths for other API-layer-only protections.

  

Prevention

\- Principle: enforce data protections at the data-access layer, not per-endpoint.

\- Add automated tests: for each restricted role, assert masked fields are absent across UI, export, AND reporting outputs.

\- Review checklist item: any new read path must go through the masking-aware data-access layer.

  

Early Warning Signs

\- The export feature was deliberately built to bypass normal serialization for performance — a design smell that should have triggered a data-protection review at the time.

\- Masking living at the API layer meant every non-API read path was an untested gap.

  

People

\- Detected by: Priya Nair (Staff Engineer)

\- Fix owners: Tom Alvarez (data-access layer), Priya Nair (review)

\- Exec: Ben Carter (CTO)

  

Related: CRM360-15, -20.
