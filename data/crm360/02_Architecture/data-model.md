# CRM360 — Data Model
> Source: Google Drive / CRM360 / 02_Architecture

  

Status: Living document

Owner: Tom Alvarez

  

Overview

Core relational entities stored in PostgreSQL (CRM360-11). Every tenant-scoped row carries a tenant\_id, and Postgres row-level security policies (CRM360-12) restrict all access to the current tenant bound on the connection. Custom fields are stored as JSONB on the relevant entities.

  

Entities

\- Tenant — the customer organization. Root of isolation. Has plan, settings, and (rarely) a dedicated-DB flag for the enterprise escape hatch.

\- User — a person in a tenant. Has a role (RBAC, CRM360-15) and resource scopes (team/territory).

\- Contact — an individual person. Belongs to an Account (optional). Supports custom JSONB fields, tags.

\- Account — a company/organization record. Has many Contacts and Deals.

\- Deal — an opportunity in the pipeline. Belongs to an Account, has a stage, amount, owner (User), win/loss outcome.

\- Activity — a logged interaction (email, call, meeting, note). Polymorphic link to Contact/Account/Deal. Feeds the activity timeline.

\- Workflow — an automation definition (trigger + actions) run via the async queue.

\- AuditLog — append-only record of sensitive actions (permission changes, exports, record access) for RBAC/compliance (ties to CRM360-20).

  

tenant\_id + RLS note

Every entity except Tenant carries tenant\_id NOT NULL. RLS policy pattern:

  USING (tenant\_id = current\_setting('app.tenant\_id')::uuid)

The tenant GUC is bound at connection checkout (see Multi-Tenancy design). A missing WHERE clause cannot leak cross-tenant data because the database enforces the filter.

  

Entity relationships (Mermaid)

\`\`\`mermaid

erDiagram

    TENANT ||--o{ USER : has

    TENANT ||--o{ CONTACT : has

    TENANT ||--o{ ACCOUNT : has

    TENANT ||--o{ DEAL : has

    TENANT ||--o{ ACTIVITY : has

    TENANT ||--o{ WORKFLOW : has

    TENANT ||--o{ AUDITLOG : has

    ACCOUNT ||--o{ CONTACT : employs

    ACCOUNT ||--o{ DEAL : has

    USER ||--o{ DEAL : owns

    USER ||--o{ ACTIVITY : performs

    CONTACT ||--o{ ACTIVITY : involves

    DEAL ||--o{ ACTIVITY : involves

    USER ||--o{ AUDITLOG : generates

    WORKFLOW ||--o{ ACTIVITY : triggers

  

    TENANT {

      uuid id PK

      string name

      string plan

      bool dedicated\_db

    }

    USER {

      uuid id PK

      uuid tenant\_id FK

      string email

      string role

      jsonb scopes

    }

    CONTACT {

      uuid id PK

      uuid tenant\_id FK

      uuid account\_id FK

      string name

      jsonb custom\_fields

    }

    DEAL {

      uuid id PK

      uuid tenant\_id FK

      uuid account\_id FK

      uuid owner\_id FK

      string stage

      numeric amount

      string outcome

    }

    ACTIVITY {

      uuid id PK

      uuid tenant\_id FK

      string type

      uuid subject\_id

      string subject\_type

      timestamptz occurred\_at

    }

\`\`\`

  

Indexing / search

\- FTS index (CRM360-14) on searchable text columns across Contact/Account/Deal/Activity.

\- Composite indexes lead with tenant\_id.

  

Related: CRM360-11, -12, -14, -15, -20.
