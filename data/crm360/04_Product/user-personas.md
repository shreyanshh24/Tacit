# CRM360 — User Personas
> Source: Google Drive / CRM360 / 04_Product

  

Owner: Alex Wu (Designer) / Maya Chen (VP Product)

  

Four primary personas guide CRM360 product decisions.

  

1\) Sara — Sales Rep

Goals: Hit quota, keep deals moving, never drop a follow-up. Spend time selling, not on data entry.

Pains: Manual activity logging; email lives outside the CRM; forgetting which deal needs a nudge; spreadsheets that go stale.

How CRM360 helps: Two-way email/calendar sync (CRM360-3) auto-logs interactions to the activity timeline (CRM360-6). The Kanban pipeline (CRM360-2) makes her deals and next steps visible. RBAC scopes (CRM360-15) show her own + territory records without clutter.

  

2\) Marcus — Sales Manager

Goals: Accurate forecast, coach the team, spot at-risk deals early.

Pains: No shared view of the pipeline; forecasting from gut and spreadsheets; can't see rep activity levels.

How CRM360 helps: Team-scoped pipeline board and weighted forecasting (CRM360-2). Dashboards and saved views (CRM360-4) for pipeline health, win/loss, and activity volume. Manager scope (CRM360-15) shows the whole team's deals.

  

3\) Priya — RevOps Admin

Goals: Clean data, correct permissions, reliable integrations, enforce process.

Pains: Duplicate records; over-broad access; brittle integrations; PII exposure risk; migrating data in from other tools.

How CRM360 helps: Dedupe/merge, custom fields, bulk CSV import (CRM360-1). RBAC roles + scopes and data masking (CRM360-15, -20) to control access and protect PII. First-party connectors + HubSpot import (CRM360-8). Feature flags (CRM360-18) for safe rollouts. Audit logging for compliance.

  

4\) Nina — Customer Success Manager

Goals: Keep customers healthy, renew and expand, respond fast to issues.

Pains: No full history of a customer's interactions; blind to product usage; surprised by churn signals.

How CRM360 helps: The unified activity timeline (CRM360-6) gives complete interaction history per account. Dashboards (CRM360-4) surface engagement and health signals. Slack connector (CRM360-8) pushes alerts where the CS team already works.

  

Design implications

\- Reduce manual data entry everywhere (sync, auto-logging).

\- Right-size what each persona sees via roles + scopes.

\- Reliability matters to all four — the async queue (CRM360-16) keeps the app responsive even when providers are slow.

  

Related: CRM360-1, -2, -3, -4, -6, -8, -15, -16, -18, -20.
