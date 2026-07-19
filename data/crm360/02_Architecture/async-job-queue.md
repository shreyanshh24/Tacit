# Async Job Queue — Design
> Source: Google Drive / CRM360 / 02_Architecture

  

Status: Adopted (ADR CRM360-16), post-outage CRM360-19

Owner: Raj Patel / Tom Alvarez

  

Context

The 2025-09-12 outage (CRM360-19) was caused by synchronous external-provider calls saturating the shared request thread pool. Standard adopted: no synchronous external calls in the request path. This design moves all external and background work onto a Redis-backed async job queue.

  

Design

\- Producers: API/service handlers enqueue a job and return immediately. No blocking on external providers.

\- Broker: Redis holds job queues, one logical queue per job class (email\_send, email\_sync, export, webhook, enrichment).

\- Worker pool: separate process from the API. Per-class bulkheads — each job class has its own concurrency budget so a backed-up class cannot starve others.

\- Retry with exponential backoff: transient failures retried with jittered backoff (e.g. 1s, 2s, 4s, ... capped).

\- Dead-letter queue (DLQ): jobs exceeding max retries move to a DLQ for inspection/replay; DLQ depth is alerted.

\- Idempotency keys: every job carries an idempotency key. Handlers must be idempotent — critical for billing/webhooks (ties to CRM360-21 double-charge, where a non-idempotent handler + provider retries caused duplicate charges).

  

Email-send through the queue (Mermaid sequence)

\`\`\`mermaid

sequenceDiagram

    participant API as API Handler

    participant Q as Redis Queue (email\_send)

    participant W as Worker

    participant SG as SendGrid (-13)

    participant DLQ as Dead-Letter Queue

  

    API-\>\>Q: enqueue(email\_send, idempotency\_key)

    API--\>\>API: return 202 immediately

    W-\>\>Q: dequeue job

    W-\>\>W: check idempotency\_key (skip if seen)

    W-\>\>SG: POST /send

    alt success

        SG--\>\>W: 202 accepted

        W-\>\>Q: ack (mark done)

    else transient error

        SG--\>\>W: 5xx / timeout

        W-\>\>Q: requeue w/ backoff (attempt \< max)

    else exhausted retries

        W-\>\>DLQ: move job

        DLQ--\>\>W: alert on DLQ depth

    end

\`\`\`

  

Failure modes and alerts

\- Provider slowdown: queue depth grows; workers stay bounded; API unaffected (the fix for CRM360-19). Alert on queue depth + age of oldest job.

\- Worker crash loop: alert on repeated worker restarts.

\- DLQ growth: alert on DLQ depth \> threshold; runbook to inspect and replay.

\- Poison message: idempotency + max-retry cap prevents infinite reprocessing; lands in DLQ.

\- Redis unavailability: producers degrade gracefully (buffer/backpressure); page on broker down.

  

Non-goals

\- Exactly-once delivery (we target at-least-once + idempotent handlers).

\- Cross-region queue replication (future).

  

Related: CRM360-13, -16, -18, -19, -21.
