# Multi-Tenancy & Row-Level Security — Design
> Source: Google Drive / CRM360 / 02_Architecture

  

Status: Adopted (ADR CRM360-12)

Owner: Tom Alvarez / Jordan Lee

  

Decision

CRM360 uses a shared PostgreSQL database with logical tenant isolation enforced by Postgres row-level security (RLS). A dedicated-database escape hatch is available for a small number of very large or compliance-sensitive enterprise tenants. (See CRM360-12; store choice CRM360-11.)

  

Why shared + RLS

\- One schema, one migration path — schema changes ship once, not per-tenant.

\- Isolation is enforced by the database, so an application bug (a missing WHERE) cannot leak cross-tenant data.

\- Efficient resource use at our scale.

  

Mechanics

\- Every tenant-scoped table has tenant\_id NOT NULL.

\- RLS policy on each table:

    USING (tenant\_id = current\_setting('app.tenant\_id')::uuid)

\- The tenant GUC (app.tenant\_id) is set at connection checkout by the pooler. A connection cannot be handed out without a tenant bound — this was a launch blocker (per the 2025-02-12 architecture review).

\- Application code never writes WHERE tenant\_id = ... by hand for isolation; the policy does it. Code sets the session tenant, then queries normally.

  

Connection pooling

\- Shared pooler; on checkout, bind app.tenant\_id for the request's tenant, and RESET on check-in so a connection can't carry a stale tenant into the next request.

\- Bulkheaded pools keep background/worker traffic from starving request traffic.

  

Enterprise dedicated-DB escape hatch

\- Tenant.dedicated\_db routes that tenant to its own database on the same codebase and schema.

\- Same application, different connection target. Used for physical-isolation compliance demands or very large tenants where noisy-neighbor risk is unacceptable.

\- Kept rare on purpose — it reintroduces per-DB migration cost.

  

ASCII diagram

                          +----------------------------+

   request (tenant A) --\> |  Connection Pooler         |

   request (tenant B) --\> |  binds app.tenant\_id       |

                          |  on checkout, RESET on     |

                          |  check-in                  |

                          +-------------+--------------+

                                        |

                          +-------------v--------------+

                          |  Shared PostgreSQL          |

                          |  RLS: tenant\_id =           |

                          |    current\_setting(tenant)  |

                          |  \[A rows\] \[B rows\] \[C rows\]  |

                          +----------------------------+

  

                          +----------------------------+

   enterprise tenant Z -\> |  Dedicated DB (escape hatch)|

                          |  same schema/codebase       |

                          +----------------------------+

  

Risks / mitigations

\- Forgotten tenant binding -\> pooler enforcement makes unbound connections impossible.

\- Superuser/BYPASSRLS misuse -\> app role is non-superuser, no BYPASSRLS.

\- Noisy neighbor -\> workload limits + dedicated-DB hatch for the worst offenders.

  

Related: CRM360-11, -12.
