# CRM360 — Release Notes
> Source: Google Drive / CRM360 / 04_Product

  

Reverse-chronological. Versions map to when modules and key decisions shipped.

  

Unreleased

\- React migration completing; final jQuery screens being retired (CRM360-17).

\- Remaining synchronous external calls migrating to the async queue (CRM360-16).

\- RBAC + resource scopes and data-access-layer PII masking rolling out (CRM360-15, -20).

\- First-party connectors (Slack/Zapier/HubSpot) in progress (CRM360-8).

  

0.6.0 — 2025-12-10

\- Adopted RBAC with resource scopes over ABAC (CRM360-15); admin role editor + team/territory scopes (initial).

\- Idempotent webhook handling shipped — idempotency keys on event id — following the billing double-charge incident (CRM360-21).

\- Began data masking work at the data-access layer after the CSV export PII near-miss (CRM360-20).

  

0.5.0 — 2025-11-20

\- App Marketplace v1 KILLED (CRM360-9). Catalog + self-serve partner onboarding sunset; integration investment redirected to a first-party connector framework (CRM360-8).

\- Kicked off first-party connectors: Slack, Zapier, HubSpot import.

  

0.4.0 — 2025-09-25

\- Async job queue shipped: Redis broker, worker pool, retry/backoff, dead-letter queue, per-class bulkheads (CRM360-16). Direct response to the 2025-09-12 outage (CRM360-19).

\- Email/calendar sync moved fully onto the queue; no synchronous provider calls in the request path.

\- LaunchDarkly feature flags + incident kill switches in place (CRM360-18).

  

0.3.0 — 2025-07-15

\- App Marketplace v1 launched: public-API catalog, install flow, self-serve partner onboarding (later killed, CRM360-9).

\- Public API + webhooks hardened with versioning for external consumers.

\- Reporting dashboards (beta) with saved views (CRM360-4).

  

0.2.0 — 2025-05-01

\- Two-way email & calendar integration (Gmail/Outlook) — initial sync (CRM360-3).

\- Activity timeline unifying interaction history (CRM360-6).

\- Bulk CSV import, tags & segments (CRM360-1).

\- Real-time collaborative record editing KILLED before GA on complexity vs. value (CRM360-10).

  

0.1.0 — 2025-03-01

\- First release. Contact & account management with custom JSONB fields and dedupe/merge (CRM360-1).

\- Deal pipeline Kanban with customizable stages, drag-drop, win/loss (CRM360-2).

\- Foundation: PostgreSQL primary chosen over MongoDB (CRM360-11); multi-tenancy via shared DB + row-level security with dedicated-DB escape hatch (CRM360-12); SendGrid for email (CRM360-13); Postgres full-text search (CRM360-14).

  

Related: CRM360-1..21.
