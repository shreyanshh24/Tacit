# PRD — Deals & Pipeline (CRM360-2)
> Source: Google Drive / CRM360 / 03_Solution_Design

  

Author: Maya Chen (VP Product)

Eng lead: Tom Alvarez  •  Design: Alex Wu

  

Problem

Sales reps and managers have no shared, visual view of where deals stand. Deal status lives in spreadsheets and reps' heads, so managers can't forecast and reps drop follow-ups. CRM360 needs a first-class pipeline.

  

Goals

\- A Kanban pipeline board: columns are stages, cards are deals.

\- Customizable stages per tenant (add/rename/reorder/delete).

\- Drag-and-drop to move a deal between stages; updates stage + timestamps.

\- Forecasting: weighted pipeline value by stage probability; expected-close reporting.

\- Win/loss capture: mark deals Won/Lost with a reason; feed win/loss analysis.

  

Non-goals

\- Deal-level real-time collaborative editing (killed, CRM360-10).

\- AI deal scoring (out of scope for v1; may revisit).

\- Cross-tenant benchmarking.

  

Proposed solution

\- Deal entity (see Data Model): account, owner, stage, amount, probability, expected\_close, outcome, custom JSONB fields.

\- Board reads deals for the tenant (RLS-scoped, CRM360-12) filtered by owner/team per RBAC scopes (CRM360-15) — a rep sees their deals, a manager their team's.

\- Drag-drop issues a stage-change; server validates the transition, writes an Activity to the timeline, and updates forecast rollups.

\- Stage config stored per tenant; probability weights per stage drive weighted forecast.

\- Win/Loss modal on close captures outcome + reason code.

\- Search/filter via Postgres FTS (CRM360-14).

  

Open questions

\- Do we allow custom probability per deal, or only per stage? (Lean: per stage for v1.)

\- How do stage renames/deletes handle deals already in that stage? (Proposal: block delete if occupied, or force reassign.)

\- Forecast window defaults — quarter vs configurable?

  

Success metrics

\- % of active deals with a stage set.

\- Weekly board engagement by managers.

\- Forecast accuracy vs actual close.

  

Related: CRM360-2, -10 (killed collab), -12, -14, -15.
