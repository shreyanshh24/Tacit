# CRM360 — Architecture Overview
> Source: Google Drive / CRM360 / 02_Architecture

  

Status: Living document

Owner: Raj Patel (Principal Engineer)

  

Purpose

High-level map of CRM360's runtime components and request flow, with links to the ADRs that shaped them.

  

Components

\- React SPA — the web client. Migrating off a legacy jQuery frontend (CRM360-17). Talks only to the API/service layer over HTTPS/JSON.

\- API / Service Layer — stateless application services. Handles auth, RBAC (CRM360-15), request validation, and business logic. Enforces the standard: no synchronous external calls in the request path (CRM360-16). Long-running or external work is enqueued.

\- PostgreSQL (primary) — system of record (CRM360-11). Multi-tenant via shared DB + row-level security (CRM360-12). JSONB for custom fields.

\- Postgres Full-Text Search — search over contacts/accounts/deals/activities using Postgres FTS now; Elasticsearch deferred (CRM360-14).

\- Redis-backed Async Job Queue — broker for all external/background work: email sync, exports, webhooks (CRM360-16). Worker pool with retry, backoff, DLQ.

\- SendGrid — outbound/inbound email provider (CRM360-13), reached only via workers.

\- LaunchDarkly — feature flags and kill switches (CRM360-18); used to shed load during incidents.

  

ASCII block diagram

\+-------------------+        HTTPS/JSON        +------------------------+

|   React SPA       | -----------------------\> |   API / Service Layer  |

| (ex-jQuery, -17)  | \<----------------------- |  auth, RBAC (-15)      |

\+-------------------+                          +-----------+------------+

                                                           |

                        +----------------------------------+-------------------+

                        |                     |                                |

                        v                     v                                v

                +---------------+     +----------------+              +------------------+

                | PostgreSQL    |     | Postgres FTS   |              | Redis Job Queue  |

                | primary (-11) |     | search (-14)   |              | broker (-16)     |

                | RLS (-12)     |     +----------------+              +--------+---------+

                +---------------+                                              |

                                                                     +--------v---------+

                                                                     |  Worker Pool     |

                                                                     +----+--------+----+

                                                                          |        |

                                                                     +----v--+  +--v-------+

                                                                     |SendGrid| |LaunchDkly|

                                                                     | (-13)  | |  (-18)   |

                                                                     +--------+ +----------+

  

Request flow (Mermaid)

\`\`\`mermaid

graph TD

    U\[User\] --\> SPA\[React SPA\]

    SPA --\>|HTTPS/JSON| API\[API / Service Layer\]

    API --\> AUTH\[Auth + RBAC -15\]

    AUTH --\> API

    API --\>|reads/writes| PG\[(PostgreSQL primary -11, RLS -12)\]

    API --\>|search| FTS\[Postgres FTS -14\]

    API --\>|enqueue external/bg work| Q\[Redis Job Queue -16\]

    Q --\> W\[Worker Pool\]

    W --\>|email| SG\[SendGrid -13\]

    W --\>|flags/kill-switch| LD\[LaunchDarkly -18\]

    W --\>|results| PG

\`\`\`

  

Key principles

\- No synchronous external calls in the request path (post-CRM360-19 standard).

\- The database enforces tenant isolation via RLS, not the app layer alone.

\- Feature flags gate risky paths and provide incident kill switches.

  

Related ADRs: CRM360-11, -12, -13, -14, -15, -16, -17, -18.
