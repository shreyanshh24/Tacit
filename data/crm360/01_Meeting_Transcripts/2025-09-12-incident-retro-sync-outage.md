CRM360 — Meeting Transcript

Date: 2025-09-12

Topic: Incident Retro — Pipeline & Email Sync Outage (CRM360-19)

Attendees: Jordan Lee (SRE/DevOps), Raj Patel (Principal Engineer), Tom Alvarez (Backend Eng), Priya Nair (Staff Engineer), Nina Torres (Customer Success Lead), Ben Carter (CTO)

  

\[00:00:10\] Ben Carter: Let's walk this calmly, blameless. Jordan, timeline first.

  

\[00:00:29\] Jordan Lee: At 14:02 our email sync provider — SendGrid inbound plus the Gmail/Outlook sync — started responding slowly, three to five seconds per call. At 14:11 the thread-pool saturation alert fired. At 14:14 request latency across the whole app spiked; deals pipeline stopped loading, email sync stalled. Full user-visible degradation from about 14:14 to 14:53. Roughly forty minutes.

  

\[00:01:15\] Tom Alvarez: The mechanism is what hurt us. Email sync and a couple of pipeline enrichment calls hit the external provider synchronously, inside the request-handling threads. When the provider slowed down, those threads blocked waiting on it. The pool drained. Once every worker was parked on a slow external call, unrelated requests — just loading a deal — had no thread to run on.

  

\[00:02:04\] Priya Nair: So one slow dependency took down features that have nothing to do with email. That's the coupling I'd want us to break.

  

\[00:02:30\] Jordan Lee: Right. And our first mitigation made it worse. At 14:22 we raised the HTTP client timeout, thinking the calls just needed more time to complete.

  

\[00:02:55\] Raj Patel: Which is exactly backwards. Longer timeout means each blocked thread stays parked longer, so the pool stays saturated longer. We increased the time each thread was held hostage.

  

\[00:03:28\] Jordan Lee: Correct. Latency got worse for about eight minutes after that change. At 14:34 we reverted the timeout and instead started shedding the sync calls — we feature-flagged email sync off via LaunchDarkly. Threads freed up, pipeline recovered by 14:41, full recovery 14:53 once we re-enabled sync behind a concurrency limit.

  

\[00:04:15\] Nina Torres: On customer impact — 60-some tenants opened tickets. The loud complaint was "my pipeline is frozen," not email, which tracks with what Tom described. A couple of enterprise accounts escalated. No data loss, which is the message I've been giving them, and I'd like that confirmed on the record.

  

\[00:05:00\] Tom Alvarez: Confirmed, no data loss. Sync events queued up at the provider and replayed once we restored. Nothing dropped.

  

\[00:05:26\] Ben Carter: Good. Root cause in one sentence?

  

\[00:05:40\] Raj Patel: Synchronous external-provider calls in the request path saturated the shared worker thread pool, so one slow dependency degraded the entire application.

  

\[00:06:08\] Ben Carter: And the fix, not just the patch?

  

\[00:06:22\] Raj Patel: Structural. Every external call moves out of the request path and onto an async job queue. Producer enqueues, returns immediately; a separate worker pool drains the queue and talks to providers, with retry and backoff. If a provider slows down, the queue backs up — it doesn't take the app down. That's ADR CRM360-16.

  

\[00:07:05\] Priya Nair: I'd add a bulkhead even within that. The email-sync workers shouldn't share a pool with, say, export workers. Isolate pools per job class so one backed-up class can't starve the others.

  

\[00:07:40\] Raj Patel: Agreed, bulkheading goes in the design. And I want to make this a standard, written down: no synchronous external calls in the request path. If you're calling something over the network that we don't control, it goes through the queue. Full stop.

  

\[00:08:20\] Ben Carter: I'll bless that as a standard. Jordan, the thread-pool alert fired at 14:11, three minutes before user impact. Did we act on it?

  

\[00:08:50\] Jordan Lee: We saw it but didn't connect it to the provider slowness fast enough. It was an early warning — pool utilization climbing — about ten minutes ahead of the worst of it if you count from when the provider first got slow. We should treat saturation as a page, not a warning, and wire it to a runbook that says "check external dependency latency first."

  

\[00:09:35\] Priya Nair: And a dependency-latency dashboard so the correlation is one glance, not a hunt.

  

\[00:10:02\] Ben Carter: Let's lock actions.

  

\[00:10:15\] Raj Patel: I'll author ADR CRM360-16, async queue with retry/backoff, dead-letter, and per-class bulkheads.

  

\[00:10:38\] Tom Alvarez: I'll inventory every synchronous external call in the request path and migrate email sync first.

  

\[00:11:00\] Jordan Lee: I'll promote thread-pool saturation to a paging alert with a runbook, and build the dependency-latency dashboard.

  

\[00:11:20\] Nina Torres: I'll send the "no data loss, here's what happened" note to affected tenants and close the escalations.

  

\[00:11:42\] Ben Carter: Thank you all. Clean retro. Let's ship the fix.

  

Action Items:

\- Raj: Author ADR CRM360-16 (async queue: retry/backoff, DLQ, per-class bulkheads).

\- Tom: Inventory all synchronous external calls in request path; migrate email sync first.

\- Jordan: Promote thread-pool saturation to paging alert + runbook; build dependency-latency dashboard.

\- Nina: Customer comms + close enterprise escalations (no data loss).

\- Standard adopted: No synchronous external calls in the request path.
