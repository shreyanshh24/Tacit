# CRM360 — Features List
> Source: Google Drive / CRM360 / 04_Product

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| Feature | Module | Jira Key | Status | Priority | Notes |
| Contact Management | Contacts | CRM360-1 | Shipped | P0 | Core CRUD for contacts/accounts with custom JSONB fields |
| Contact Dedupe & Merge | Contacts | CRM360-1 | Shipped | P1 | Duplicate detection and record merge |
| Deal Pipeline Kanban | Deals | CRM360-2 | Shipped | P0 | Drag-drop board with customizable stages; win/loss |
| Two-Way Email Sync | Email/Calendar | CRM360-3 | Shipped | P0 | Gmail/Outlook sync via async queue (post CRM360-19) |
| Calendar Sync | Email/Calendar | CRM360-3 | Shipped | P1 | Meeting logging to activity timeline |
| Reporting Dashboards | Reporting | CRM360-4 | In Progress | P0 | Dashboards + saved views; read replica for load isolation |
| Workflow Automation Builder | Workflows | CRM360-5 | In Progress | P1 | Trigger/action automations run on the async queue |
| Bulk CSV Import | Contacts | CRM360-1 | Shipped | P1 | Bulk contact/account import with mapping |
| Custom Fields | Platform | CRM360-1 | Shipped | P1 | Per-tenant custom fields stored as JSONB |
| Tags & Segments | Contacts | CRM360-1 | Shipped | P2 | Tagging and saved segments |
| Activity Timeline | Activities | CRM360-6 | Shipped | P0 | Unified interaction history per record |
| Webhooks & Public API | Platform | CRM360-6 | Shipped | P1 | Public REST API + webhooks for customer automations |
| SSO / SAML | Security | CRM360-7 | Planned | P0 | Enterprise SSO/SAML login |
| Async Job Queue | Infra | CRM360-16 | Shipped | P0 | Redis queue w/ retry/backoff/DLQ; adopted after CRM360-19 |
| Feature Flags | Infra | CRM360-18 | Shipped | P1 | LaunchDarkly flags + incident kill switches |
| RBAC + Resource Scopes | Security | CRM360-15 | In Progress | P0 | Roles + team/territory scopes; chosen over ABAC |
| PostgreSQL Store | Infra | CRM360-11 | Shipped | P0 | Primary data store; chosen over MongoDB |
| Postgres FTS Search | Search | CRM360-14 | Shipped | P1 | Full-text search on Postgres; Elasticsearch deferred |
| React Migration | Frontend | CRM360-17 | In Progress | P1 | Migrating SPA off legacy jQuery to React |
| First-Party Connectors | Integrations | CRM360-8 | In Progress | P0 | Slack/Zapier/HubSpot; replaces killed marketplace |
| App Marketplace v1 | Integrations | CRM360-9 | Killed | P2 | Self-serve partner marketplace; only 3 apps in 6 months |
| Real-Time Collab Editing | Deals | CRM360-10 | Killed | P3 | Concurrent record editing; killed on complexity/value |
| Field-Level Locking | Deals | CRM360-10 | Planned | P2 | Lightweight alternative after collab editing killed |
| AI Agent Marketplace | Integrations |  | Proposed | P2 | Self-serve partner AI agents on public API; Q1 proposal |
| Multi-Tenancy RLS | Infra | CRM360-12 | Shipped | P0 | Shared DB + row-level security; dedicated-DB escape hatch |
| Data Masking (PII) | Security | CRM360-20 | In Progress | P0 | Masking at data-access layer after CSV export near-miss |
| Idempotent Webhook Handling | Infra | CRM360-21 | Shipped | P0 | Idempotency keys after billing double-charge incident |
