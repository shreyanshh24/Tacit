# Postmortem — 2025-09-12 Pipeline & Email Sync Outage (CRM360-19)
> Source: Google Drive / CRM360 / 05_Incidents

  

Severity: SEV1  •  Duration: \~40 min (14:14–14:53)  •  Status: Resolved

  

Summary

Synchronous calls to our external email provider slowed down and saturated the shared request worker thread pool. With every worker blocked on a slow external call, unrelated requests (loading the deal pipeline) had no thread to run on, degrading the entire application. The first mitigation — raising the HTTP client timeout — made it worse. Root fix: move all external calls onto an async job queue (ADR CRM360-16).

  

Impact

\- \~40 minutes of user-visible degradation. Deal pipeline failed to load; email sync stalled.

\- \~60 tenants opened tickets; two enterprise accounts escalated. Loud complaint was "pipeline frozen," not email.

\- No data loss. Sync events queued at the provider and replayed on recovery.

  

Timeline (all times local, 2025-09-12)

\- 14:02 — Email provider (SendGrid inbound + Gmail/Outlook sync) response times climb to 3–5s.

\- 14:11 — Thread-pool saturation alert fires (early warning, \~3 min before user impact).

\- 14:14 — App-wide latency spike; pipeline stops loading; sync stalls. SEV1 declared.

\- 14:22 — First mitigation: raise HTTP client timeout (INCORRECT — worsened saturation).

\- 14:22–14:30 — Latency worsens; blocked threads held longer.

\- 14:34 — Revert timeout; feature-flag email sync OFF via LaunchDarkly (CRM360-18) to shed load.

\- 14:41 — Thread pool recovers; pipeline loads again.

\- 14:53 — Sync re-enabled behind a concurrency limit; full recovery.

  

Root Cause

Synchronous external-provider calls ran inside request-handling threads. When the provider slowed, those threads blocked, draining the shared pool. One slow dependency degraded features unrelated to email. Raising the client timeout increased how long each thread stayed blocked, deepening saturation.

  

Resolution

\- Immediate: reverted the timeout change; shed load by flag-disabling sync; re-enabled behind a concurrency limit.

\- Structural: adopted an async job queue (ADR CRM360-16) — producers enqueue and return immediately; a separate worker pool handles external calls with retry/backoff, DLQ, and per-class bulkheads so a slow dependency backs up a queue instead of taking down the app.

  

Prevention

\- Standard adopted: NO synchronous external calls in the request path.

\- Inventory and migrate all remaining synchronous external calls (email sync first).

\- Promote thread-pool saturation to a PAGING alert with a runbook ("check external dependency latency first").

\- Build a dependency-latency dashboard so the correlation is one glance.

\- Per-class bulkheads to isolate job classes.

  

Early Warning Signs

\- Thread-pool saturation alert fired at 14:11 — 3 minutes before user impact (and \~10 min after provider latency first began climbing). It was seen but not connected to provider slowness fast enough. Now a page, not a warning.

  

People

\- Incident commander: Jordan Lee (SRE)

\- Responders: Tom Alvarez (backend), Raj Patel (principal)

\- Customer comms: Nina Torres (CS)

\- Exec: Ben Carter (CTO)

  

Related: CRM360-16, -13, -18, -19.
