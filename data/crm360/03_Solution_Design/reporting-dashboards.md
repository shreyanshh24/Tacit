# Solution Design — Reporting & Dashboards (CRM360-4)
> Source: Google Drive / CRM360 / 03_Solution_Design

  

Author: Dana Kim (Data/ML Eng)

Reviewers: Raj Patel, Jordan Lee

  

Problem

Managers and RevOps need to see pipeline health, activity, and win/loss trends without exporting to spreadsheets. Reporting queries are heavy and, run against the primary, threaten transactional performance.

  

Goals

\- Configurable dashboards: widgets for pipeline value, stage funnel, win/loss, activity volume, forecast.

\- Saved views: users save filtered/segmented report configurations and share within scope.

\- Scheduled exports: recurring CSV/report delivery via email (through the async queue, CRM360-16).

\- Keep reporting load off the transactional primary.

  

Non-goals

\- A full BI tool / custom SQL console for end users.

\- Real-time streaming analytics.

\- Cross-tenant analytics.

  

Proposed solution

\- Read replica plan: heavy reporting/aggregation queries run against a PostgreSQL read replica, not the primary (CRM360-11). Dashboards and scheduled exports read from the replica; small tolerance for replica lag is acceptable for reporting.

\- Search / filtering uses Postgres FTS now (CRM360-14). Rationale: FTS covers our current search and filter needs on Postgres with no new infrastructure. Elasticsearch is deferred until scale or advanced relevance/faceting demands justify a second data system and its operational cost. (We deliberately avoid adding a platform we'd have to run — same cost logic as the store decision, CRM360-11.)

\- Scheduled exports are queue jobs (CRM360-16): generated on a worker, delivered via SendGrid (CRM360-13). Exports respect RBAC scopes and data masking (CRM360-15, and PII masking per CRM360-20).

\- Dashboard widgets are parameterized aggregate queries; results cached briefly per tenant/scope.

  

Open questions

\- Replica lag budget for near-real-time widgets — acceptable threshold?

\- Do saved views need org-wide sharing, or scope-limited only?

\- Export size limits / pagination for very large tenants.

  

Success metrics

\- Dashboard weekly active managers.

\- Primary DB CPU unaffected by reporting load (replica isolation working).

\- Scheduled export success rate.

  

Related: CRM360-4, -11, -13, -14, -15, -16, -20.
