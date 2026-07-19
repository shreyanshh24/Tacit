# First-Party Integration Framework — Design (CRM360-8)
> Source: Google Drive / CRM360 / 03_Solution_Design

  

Author: Raj Patel (Principal Engineer)

Reviewers: Maya Chen, Sofia Rossi, Nina Torres

  

Problem

The self-serve App Marketplace v1 was killed (CRM360-9): only 3 apps in 6 months, security review didn't scale, and first-party Slack/Zapier connectors drove \~90% of integration usage. Customers want integrations that already exist and just work — not a store to shop in. This design defines the direction that replaces the marketplace.

  

Explicit note: This framework REPLACES the killed self-serve partner marketplace (CRM360-9). We are not reopening self-serve third-party publishing. We build and maintain a curated set of first-party connectors on an internal integration SDK.

  

Goals

\- Maintained first-party connectors: Slack (notifications), Zapier (automation reach), HubSpot import (migration onboarding).

\- Internal integration SDK: a shared, internal framework for building connectors — auth, sync, rate limiting, retries — so new connectors are fast and consistent.

\- All external calls go through the async queue (CRM360-16); no synchronous provider calls in the request path.

\- Connectors respect RBAC scopes and data masking (CRM360-15, -20).

  

Non-goals

\- Self-serve third-party partner publishing (killed, CRM360-9).

\- Public revenue-share marketplace.

\- Deprecating the public API/webhooks for individual customers' own automations — those remain.

  

Proposed solution

\- Internal SDK modules: OAuth/credential storage, a sync engine (poll/push + idempotency), a normalized event/mapping layer, rate-limit + backoff, and observability hooks. Connectors are first-party code we own and can change against internal contracts (no external API freeze — the cost that hurt the marketplace).

\- Connector runtime: each connector runs as queue workers (bulkheaded per connector class), reading/writing CRM360 entities through the standard data-access layer (so RLS + masking apply).

\- Config/UX: admins enable a connector and authorize it; no developer onboarding, no catalog.

  

Open questions

\- Prioritization after the initial three (Salesforce import? Google/Microsoft directory sync?).

\- SDK versioning cadence for internal connector authors.

\- Do we ever expose the SDK to select design partners under contract (NOT self-serve)?

  

Success metrics

\- Connector adoption (Slack/Zapier/HubSpot enablement rate).

\- Time-to-build a new connector on the SDK.

\- Integration usage growth vs. the marketplace baseline.

  

Related: CRM360-8, -9, -15, -16, -20.
