CRM360 — Meeting Transcript

Date: 2025-02-12

Topic: Architecture Review — Core Data Store & Multi-Tenancy

Attendees: Ben Carter (CTO), Maya Chen (VP Product), Raj Patel (Principal Engineer), Priya Nair (Staff Engineer), Tom Alvarez (Backend Eng), Jordan Lee (SRE/DevOps)

  

\[00:00:14\] Ben Carter: Alright, two decisions to close today. One, the core data store. Two, how we isolate tenants. Raj, you're driving the first.

  

\[00:00:41\] Raj Patel: Right. My recommendation is PostgreSQL as the primary store. It's relational, we have relational data — contacts, accounts, deals, activities all reference each other. We get transactions, joins, constraints. And frankly the team knows it.

  

\[00:01:22\] Priya Nair: I want to push back before we anchor. A CRM is write-heavy on activity logs and email sync events. Mongo with sharding gives us horizontal write scaling out of the box. With Postgres we're going to hit a single-primary write ceiling and then we're bolting on sharding later, which is worse.

  

\[00:02:03\] Raj Patel: We will hit that ceiling at a scale we are nowhere near. And "sharding out of the box" in Mongo still means you pick a shard key and live with it. If we pick wrong we're re-sharding, which is not free.

  

\[00:02:35\] Priya Nair: Agreed the shard key is a commitment. My bigger worry is actually tenant blast radius. If everyone shares one Postgres primary and one tenant runs a pathological query or a bulk import, everybody feels it.

  

\[00:03:10\] Tom Alvarez: That's a workload isolation problem though, not really a Mongo-vs-Postgres problem. We'd have the same noisy-neighbor issue on a shared Mongo cluster.

  

\[00:03:41\] Maya Chen: Let me put the cost lens on this. We're pre-scale. Two data platforms — one for relational, one for documents — means two sets of expertise, two on-call rotations, two backup stories. That's real money and real headcount we don't have.

  

\[00:04:19\] Priya Nair: Fair. I'm not asking for two stores. I'm asking whether the one store should be Mongo. The schema flexibility helps us with custom fields — every tenant wants different fields on a contact.

  

\[00:04:52\] Raj Patel: Custom fields we can do in Postgres with a JSONB column. We get flexible attributes and we keep relational integrity for the parts that are actually relational. Best of both.

  

\[00:05:30\] Jordan Lee: From an ops view, Postgres is the boring choice and I mean that as a compliment. Mature replication, point-in-time recovery, tons of tooling. Mongo's operable but it's more surface area for us to learn under fire.

  

\[00:06:11\] Priya Nair: I'll concede JSONB covers most of the flexibility argument. My write-scaling concern stands but I accept it's a future problem, not a today problem.

  

\[00:06:44\] Ben Carter: Then let's decide the store. Postgres primary, JSONB for custom fields, and we write down the write-scaling risk explicitly so future-us doesn't act surprised. That's ADR CRM360-11. Any objection to recording it?

  

\[00:07:20\] Priya Nair: No objection. I want the ADR to name the escape hatch though — read replicas first, and sharding or Citus as the eventual lever.

  

\[00:07:48\] Ben Carter: Good, put it in. Now tenancy. Shared database with row-level security, or a database per tenant?

  

\[00:08:15\] Priya Nair: DB-per-tenant gives the cleanest isolation. One tenant's data physically cannot leak into another's, and blast radius is contained.

  

\[00:08:52\] Raj Patel: It's clean until you have two thousand tenants and two thousand databases to migrate every time we ship a schema change. Migrations become a fleet operation. And connection pooling across that many DBs is painful.

  

\[00:09:30\] Tom Alvarez: Shared DB with a tenant\_id on every row plus Postgres RLS policies gets us logical isolation. The database enforces it, not the app layer, so a missing WHERE clause can't leak data.

  

\[00:10:05\] Priya Nair: RLS is only as good as the policy and the session variable being set correctly. If someone forgets to set the tenant context on a connection, the policy defaults matter a lot. That's the risk I want us clear-eyed about.

  

\[00:10:44\] Jordan Lee: We can enforce setting the tenant GUC in the connection checkout path in the pooler. Make it impossible to get a connection without a tenant bound.

  

\[00:11:20\] Maya Chen: And the giant enterprise tenants who demand physical isolation for compliance — do we lose those deals?

  

\[00:11:47\] Raj Patel: That's where we keep an escape hatch. Default is shared plus RLS. For a small number of very large or compliance-sensitive tenants, we offer a dedicated database on the same codebase. Same schema, different home.

  

\[00:12:25\] Ben Carter: I like that. Shared plus RLS as the default, dedicated-DB escape hatch for the whales. That's ADR CRM360-12. Priya, can you live with it if the connection-checkout enforcement is a hard requirement, not a nice-to-have?

  

\[00:12:58\] Priya Nair: Yes. Make the enforcement a launch blocker and I'm on board.

  

\[00:13:20\] Ben Carter: Done. Approved: Postgres primary, shared DB with RLS, dedicated-DB escape hatch. Let's close out with actions.

  

\[00:13:44\] Raj Patel: I'll write ADR CRM360-11 and CRM360-12 by Friday.

  

\[00:14:02\] Tom Alvarez: I'll prototype the JSONB custom-fields approach and the RLS policies on contacts and deals.

  

\[00:14:20\] Jordan Lee: I'll own the pooler change that binds tenant context on connection checkout and blocks unbound connections.

  

\[00:14:38\] Priya Nair: I'll draft the write-scaling escape-hatch section — read replicas then Citus — as an appendix to CRM360-11.

  

\[00:14:55\] Ben Carter: Great. Decisions recorded, owners assigned. Thanks everyone.

  

Action Items:

\- Raj: Author ADRs CRM360-11 (Postgres) and CRM360-12 (shared DB + RLS) by Fri.

\- Tom: Prototype JSONB custom fields + RLS policies on contacts/deals.

\- Jordan: Pooler enforcement binding tenant context at connection checkout (launch blocker).

\- Priya: Write-scaling escape-hatch appendix (read replicas, then Citus/sharding).
