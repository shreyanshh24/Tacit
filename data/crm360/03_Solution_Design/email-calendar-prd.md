# PRD — Email & Calendar Integration (CRM360-3)
> Source: Google Drive / CRM360 / 03_Solution_Design

  

Author: Maya Chen (VP Product)

Eng lead: Tom Alvarez  •  SRE: Jordan Lee

  

Problem

Reps live in Gmail and Outlook, but their customer correspondence never lands in the CRM. Activity logging is manual and skipped. CRM360 needs email and calendar to sync automatically so the activity timeline reflects reality.

  

Goals

\- Two-way email sync with Gmail and Outlook: inbound and outbound messages tied to matching Contacts/Deals appear on the activity timeline.

\- Calendar logging: meetings from the connected calendar log as Activities against the right records.

\- Email templates: reusable, mergeable templates for common sends.

\- Email tracking: open/click tracking on tracked sends (opt-in per tenant).

  

Non-goals

\- Full inbox replacement / email client UI in v1.

\- Shared team inboxes (later).

\- Real-time collaborative drafting (killed, CRM360-10).

  

Proposed solution

\- Provider connectors (Gmail API, Microsoft Graph) authorized per user via OAuth.

\- CRITICAL: all provider calls run through the async job queue (CRM360-16), never in the request path. This is the direct lesson of the 2025-09-12 outage (CRM360-19) where synchronous sync calls saturated the thread pool. Sync polling, message fetch, send, and tracking callbacks are all queued jobs with retry/backoff and idempotency keys.

\- Outbound sends go through SendGrid (CRM360-13) or the provider send API, enqueued as email\_send jobs.

\- Matching engine links messages/events to Contacts/Accounts/Deals by participant email; unmatched items are suggested, not force-linked.

\- Templates stored per tenant with merge fields; tracking pixel/redirect for opens/clicks, respecting opt-in.

  

Open questions

\- Sync granularity/polling interval vs. push (Gmail push, Graph subscriptions) — start with polling, move to push?

\- How aggressively to auto-link vs. suggest, to avoid mis-association?

\- Retention window for synced message bodies (privacy).

  

Success metrics

\- % of reps with a connected mailbox.

\- Auto-logged activities per rep per week.

\- Sync error rate + queue depth (must stay bounded).

  

Related: CRM360-3, -13, -16, -19.
