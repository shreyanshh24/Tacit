# CRM360 — Product Roadmap
> Source: Google Drive / CRM360 / 04_Product

  

Owner: Maya Chen (VP Product)  •  Last updated: 2026-07

  

A Now / Next / Later roadmap. This is directional, not a commitment of dates.

  

NOW (in flight)

\- Finish the React migration (CRM360-17). Complete the move off legacy jQuery to the React SPA; retire remaining jQuery screens.

\- Migrate remaining synchronous paths to the async queue (CRM360-16). Close out the last external calls still in the request path — the standing action from the 2025-09-12 outage (CRM360-19). Goal: zero synchronous external calls in the request path.

\- Ship RBAC + resource scopes (CRM360-15) and data masking at the data-access layer (CRM360-20).

\- First-party connectors (CRM360-8): Slack, Zapier, HubSpot import.

  

NEXT

\- Reporting read replica (CRM360-4). Route heavy reporting/export queries to a Postgres read replica to isolate load from the primary.

\- SSO / SAML (CRM360-7). Enterprise single sign-on.

\- Workflow automation builder GA (CRM360-5).

  

LATER

\- Revisit Elasticsearch (CRM360-14). Only if Postgres FTS hits scale/relevance limits that justify running a second search system.

\- Enterprise dedicated-DB tenants (CRM360-12). Productize the dedicated-database escape hatch for the largest / compliance-driven tenants.

\- Field-level locking (alternative to the killed real-time collab editing, CRM360-10).

  

NOT ON THE ROADMAP

\- App Marketplace. The self-serve partner marketplace was KILLED (CRM360-9) — 3 apps in 6 months, security review didn't scale, 90% of usage came from first-party connectors. We are explicitly NOT rebuilding a self-serve partner marketplace. Integration investment goes to the first-party connector framework (CRM360-8) instead.

\- Real-time collaborative record editing (killed, CRM360-10).

  

Guiding principles

\- Reliability first: no synchronous external calls in the request path.

\- Build where usage actually is (first-party connectors, not a marketplace).

\- Don't add a second data platform (Elasticsearch, dedicated DBs) until scale forces it.

  

Related: CRM360-4, -5, -7, -8, -9, -10, -12, -14, -15, -16, -17, -19, -20.
