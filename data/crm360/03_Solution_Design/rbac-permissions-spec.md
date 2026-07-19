# RBAC & Permissions — Spec (CRM360-7 / CRM360-15)
> Source: Google Drive / CRM360 / 03_Solution_Design

  

Author: Priya Nair (Staff Engineer)

Reviewers: Raj Patel, Alex Wu, Tom Alvarez

  

Problem

CRM360 needs multi-level access control: not everyone should see every record or every field, and enterprise buyers require it. Full ABAC is too heavy and unusable for admins (see 2025-11-25 design review). We adopt role-based access with resource scopes (CRM360-15).

  

Goals

\- Roles: Admin, Manager, Rep, Read-Only (extensible per tenant). Each role carries a permission set (which actions on which entity types).

\- Resource scopes: constrain which records a user sees — by team and by territory. Manager sees their team; Rep sees own + territory.

\- Audit logging: record permission changes and sensitive-record access to AuditLog.

\- Data masking: mask sensitive/PII fields for roles without permission (ties to CRM360-20 PII near-miss).

  

Non-goals

\- Full attribute-based policy engine (deferred). Field-level rules may later use partial ABAC — the interface is designed to allow it without a rewrite.

\- Per-field editable policy DSL for admins in v1.

  

Proposed solution

\- Permission checks enforced at the data-access layer (consistent with RLS, CRM360-12), against the tenant-bound session and the user's role + scopes. Roles/scopes resolve to row filters (which records) and column visibility (which fields).

\- Scopes: team membership and territory assignment on the User; resolved into row predicates layered on top of tenant RLS.

\- Data masking: sensitive columns (e.g. contact PII, deal revenue for restricted roles) masked at the DATA-ACCESS LAYER — not only at the API layer. This is the explicit fix pattern from CRM360-20, where a CSV export bypassed API-layer masking. Masking at the data-access layer means every read path (UI, export, reporting) inherits it.

\- Audit logging: append-only AuditLog entries for grants/revokes and sensitive reads/exports; who, what, when.

  

Open questions

\- Territory model — flat list vs hierarchy?

\- How to expose (and test) field-level masking config to admins without a policy language?

\- Break-glass access for support, fully audited?

  

Success metrics

\- Zero cross-scope data exposure incidents.

\- 100% of exports/reads honoring masking (no bypass paths).

\- Audit completeness on permission changes.

  

Related: CRM360-7, -12, -15, -20.
