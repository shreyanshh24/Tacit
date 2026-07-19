# Postmortem — 2025-11 Billing Double-Charge (CRM360-21)
> Source: Google Drive / CRM360 / 05_Incidents

  

Severity: SEV1  •  Status: Resolved (refunds issued)

  

Summary

Our payment provider retried webhook deliveries during a brief slowdown. The webhook handler was not idempotent, so each redelivered event was processed as a new charge, double-charging (and in a few cases triple-charging) a subset of tenants. Fix: idempotency keys on the provider event id so a redelivered event is a no-op.

  

Impact

\- \~40 tenants overcharged on a subscription/invoice event; a handful charged 3x.

\- Financial and trust impact; several angry inbound tickets.

\- All affected charges refunded. No data corruption beyond the duplicate charge records (reversed).

  

Timeline (2025-11)

\- Payment provider experiences transient slowness; acknowledgements to our webhook are delayed.

\- Provider follows its retry policy and redelivers the same billing events (a retry storm).

\- Our webhook handler processes each delivery independently — no dedupe on event id — creating a new charge per delivery.

\- Duplicate-charge tickets arrive; billing alert on charge-volume anomaly fires.

\- Handler traced; non-idempotent processing confirmed as cause.

\- Idempotency keyed on provider event id deployed; duplicate future deliveries become no-ops.

\- Nina Torres coordinates refunds and customer comms.

  

Root Cause

The webhook handler assumed exactly-once delivery. Payment providers guarantee at-least-once and WILL retry on delayed acks. Without an idempotency key, redelivered events were reprocessed, each creating a charge. This is precisely the failure the async-queue design (CRM360-16) calls out: at-least-once delivery requires idempotent handlers.

  

Resolution

\- Add idempotency keys keyed on the provider's event id. Persist processed event ids; on receipt, if the event id was already handled, ack and no-op.

\- Reconcile and refund all duplicate charges (Nina).

\- Verify the same idempotency pattern is applied across all webhook/queue consumers.

  

Prevention

\- Standard: all webhook/queue handlers MUST be idempotent, keyed on a stable external id (ties to CRM360-16 idempotency-key design).

\- Add tests that deliver the same event N times and assert exactly one effect.

\- Alert on charge-volume anomalies and duplicate event ids.

\- Treat provider retries as expected, not exceptional.

  

Early Warning Signs

\- Known industry behavior (providers retry on delayed acks) was not designed for.

\- The queue design already specified idempotency keys (CRM360-16) — the billing webhook handler predated/skipped that pattern. The gap was applying the standard everywhere.

  

People

\- Incident commander: Jordan Lee (SRE)

\- Fix owner: Tom Alvarez (backend)

\- Refunds + customer comms: Nina Torres (CS)

\- Exec: Ben Carter (CTO)

  

Related: CRM360-16, -21.
