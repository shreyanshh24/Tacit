# Demo data

The v2 demo revolves around a fictional product, **CRM360**, whose memory corpus
is drawn from **three real sources** so both Chat (retrieval) and Agents
(integrations) have something concrete to act on.

## 1. Jira project `CRM360` (46 tickets)

- **8 epics** plus decision, incident, and work tickets.
- Two **KILL** decisions at **CRM360-9** and **CRM360-10** (initiatives that were
  killed — Foresight/Memory should surface these when a proposal repeats them).
- Incident tickets **CRM360-19**, **CRM360-20**, **CRM360-21**.
- Imported read-only via the Jira connector (ADF→text, comments included, status
  not imported). See [05-integrations/jira.md](./05-integrations/jira.md).

## 2. GitHub repo `Alin-Verma/CRM360`

- Branches **`main`**, **`develop`**, and
  **`feature-ai-agent-marketplace`**.
- `docs/` contains ADRs plus a **marketplace-trap proposal** (a tempting design
  that repeats a past failure).
- Feeds the agent workdir via `prepareWorkdir(branch)`. See
  [05-integrations/github.md](./05-integrations/github.md).

## 3. Google Drive folder `CRM360`

Subfolders: **meeting transcripts** (`01_Meeting_Transcripts`), **architecture**,
**solution design**, **product**, **incidents**. The scrum agent reads the latest
transcript from `01_Meeting_Transcripts`. See
[05-integrations/google-drive.md](./05-integrations/google-drive.md).

## The marketplace-trap arc (spans all three)

A single narrative thread runs across the corpus: the **Partner/AI Agent
Marketplace** idea appears as a killed decision in **Jira** (CRM360-9/-10), as a
**GitHub** proposal on `feature-ai-agent-marketplace` with a trap ADR, and in
**Drive** product/architecture docs. Foresight should recognize a new marketplace
proposal as a **repeat of a known failure** and warn — the demo climax.

## Husk → real-module plan

CRM360 starts as a **husk**: `docs/` + an `index.html` only, enough for the
retrieval/Scrum demos. A **later phase** (see
[09-roadmap-phases.md](./09-roadmap-phases.md), phase 5) adds a small **real
coded TypeScript module + Jest tests** and a **planted-vulnerability PR**, so the
[Tester](./04-agents/04-agent-tester.md) and
[PR Security](./04-agents/05-agent-pr-security.md) agents run for real end-to-end.
