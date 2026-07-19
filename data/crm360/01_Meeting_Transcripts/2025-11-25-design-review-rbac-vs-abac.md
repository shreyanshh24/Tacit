CRM360 — Meeting Transcript

Date: 2025-11-25

Topic: Design Review — RBAC vs ABAC (CRM360-15)

Attendees: Priya Nair (Staff Engineer), Ben Carter (CTO), Raj Patel (Principal Engineer), Alex Wu (Designer), Tom Alvarez (Backend Eng), Maya Chen (VP Product)

  

\[00:00:10\] Ben Carter: Access control model for CRM360. Priya's got a recommendation. Go.

  

\[00:00:24\] Priya Nair: Recommendation is role-based access control with resource scopes. Not full attribute-based access control. Let me explain both and why.

  

\[00:00:48\] Priya Nair: RBAC: we define roles — Admin, Manager, Rep, Read-Only — and each role carries a set of permissions. Then we layer resource scopes on top: a Manager sees their team's deals, a Rep sees their own and their territory's. Roles answer "what can you do," scopes answer "on which records."

  

\[00:01:35\] Tom Alvarez: And ABAC would be?

  

\[00:01:40\] Priya Nair: ABAC evaluates policies over arbitrary attributes at request time — user attributes, resource attributes, environment. Extremely flexible. "Allow if user.department == resource.department AND time is business hours AND record.value \< 50k." You can express almost anything.

  

\[00:02:20\] Raj Patel: The cost of that flexibility is a policy engine, policy authoring, and evaluation on every request. It's powerful and it's a lot to build, test, and reason about. Debugging "why was this denied" in ABAC is genuinely hard.

  

\[00:02:55\] Priya Nair: Exactly my argument. Ninety percent of what customers ask for is expressible as roles plus scopes. Admins understand roles. They do not want to write policy expressions. RBAC is the right altitude for where we are.

  

\[00:03:30\] Alex Wu: From the admin usability side, I strongly agree. I've watched admins configure permissions. A grid of roles and checkboxes they get. A policy language they abandon. RBAC with scopes I can make genuinely usable — a role editor, a scope picker for team and territory. ABAC I honestly don't know how to make friendly for a non-technical admin.

  

\[00:04:10\] Maya Chen: And time to value? Our enterprise deals are asking for permissions now.

  

\[00:04:22\] Priya Nair: RBAC ships faster and covers the asks on the table. That's a point in its favor for the deals in the pipeline.

  

\[00:04:48\] Priya Nair: I do want to flag one thing so it's on record. Field-level permissions. "Reps can't see the revenue field on a deal." Pure RBAC handles that at the coarse level, but truly granular per-field, per-condition masking may eventually push us toward partial ABAC — just for field-level rules, not the whole system. I don't want to build that now, but I want us to design the RBAC model so we can bolt on field-level attribute rules later without a rewrite.

  

\[00:05:40\] Raj Patel: So keep the permission-check interface abstract enough that a field-level policy layer can slot in later. Reasonable. We commit to RBAC plus scopes now, and we don't paint ourselves into a corner on fields.

  

\[00:06:12\] Tom Alvarez: Implementation-wise, permissions enforced at the data-access layer, checked against the tenant-bound session — consistent with our RLS model. Roles and scopes resolve to row filters and column visibility.

  

\[00:06:45\] Priya Nair: Yes, and audit logging on permission changes and on sensitive-record access. Who granted what, who viewed what.

  

\[00:07:10\] Ben Carter: Any dissent on RBAC-plus-scopes over ABAC?

  

\[00:07:18\] Raj Patel: None from me.

  

\[00:07:22\] Alex Wu: None. RBAC, please.

  

\[00:07:28\] Ben Carter: Then I approve RBAC with resource scopes as the model, recorded as CRM360-15. Field-level masking is a future extension that may use partial ABAC, and we design the interface to allow it. Actions.

  

\[00:07:55\] Priya Nair: I'll write CRM360-15, the RBAC model — roles, scopes for team and territory, and the extension point for field-level rules.

  

\[00:08:15\] Tom Alvarez: I'll implement the permission checks at the data-access layer against the tenant session, with roles and scopes as row filters.

  

\[00:08:35\] Alex Wu: I'll design the admin role editor and the scope picker, and validate it with two admin users.

  

\[00:08:52\] Raj Patel: I'll review the interface abstraction to make sure the field-level layer can attach later.

  

\[00:09:10\] Ben Carter: Good. Clean decision. Thanks all.

  

Action Items:

\- Ben: Approved RBAC + resource scopes over full ABAC (CRM360-15).

\- Priya: Author CRM360-15 (roles, team/territory scopes, field-level extension point).

\- Tom: Implement permission checks at data-access layer against tenant session.

\- Alex: Design + user-test admin role editor and scope picker.

\- Raj: Review interface abstraction for future field-level (partial ABAC) layer.
