// The 5 Tacit prompts. Functions take the dynamic parts and return the full
// prompt string sent to Gemini.

// P1 — EXTRACTION (run over every document during setup)
export function extractionPrompt(content: string): string {
  return `You are analyzing a company's work history. From the document below, extract any DECISION that was made.

Return strict JSON only, no markdown fences:
{
  "has_decision": boolean,
  "title": "short name of the decision",
  "decision": "what was decided",
  "reasoning": "why, in the decision-makers' own logic",
  "alternatives": [{"option": "...", "why_rejected": "..."}],
  "people": [{"name": "...", "role_in_decision": "proposer|approver|dissenter"}],
  "outcome": "active|killed|succeeded|failed|unknown"
}

If no decision is present, return {"has_decision": false}.
Do not invent details not present in the text.

DOCUMENT:
${content}`;
}

// P2 — MEMORY (question -> plain, task-focused, cited answer)
export function memoryPrompt(question: string, chunks: string): string {
  return `You are Tacit, the team's shared memory. Answer the question below for a busy, NON-TECHNICAL reader, using ONLY the retrieved context.

How to answer:
- Lead with the direct answer in the first sentence. Get to the point.
- If the question asks whether something is done/resolved (e.g. "is ticket X resolved?"), START with a clear verdict — **Yes**, **No**, **Partially**, or **Unclear** — then 2–4 short bullets of evidence.
- If the question asks what happened with a feature or ticket (e.g. "what happened to the contacts work?"), give a short plain status: what got done, what's blocked, what's next, who's involved.
- Keep it short and plain. No jargon, no code, no internal system names unless the reader would recognize them. Prefer a few tight bullets over long paragraphs.
- Back every claim with its source id in square brackets, e.g. [CRM360-22] or [docs/04-decisions/ADR-009-kill-app-marketplace-v1.md].
- If the context doesn't answer it, say plainly what's missing and who likely knows (use the author/owner of the closest source). Never invent.

QUESTION: ${question}

RETRIEVED CONTEXT:
${chunks}`;
}

// P3 — ASSUMPTIONS (plan -> hidden bets)
export function assumptionsPrompt(planContent: string): string {
  return `You are analyzing a project plan for hidden assumptions — things the plan treats as true without evidence.

Return strict JSON only:
{
  "assumptions": [{
    "text": "the assumption, stated plainly",
    "why_load_bearing": "what breaks if this is false",
    "risk": "high|medium|low",
    "stated_or_implicit": "stated|implicit"
  }]
}

Focus on: vendor/partner behavior, user behavior, technical capacity, timelines, team bandwidth, regulatory. Extract 5-10 assumptions. Implicit assumptions are the most valuable — the ones the author doesn't realize they're making.

PLAN:
${planContent}`;
}

// P4 — FORESIGHT (proposal + retrieved history -> grounded pre-mortem)
export function foresightPrompt(proposal: string, chunks: string): string {
  return `You are Tacit's foresight engine. A team is proposing something new. Below is their proposal AND the most similar past initiatives retrieved from this company's own history.

Write a pre-mortem grounded ONLY in the retrieved history:
1. Name the most similar past initiative(s) and what happened to them, citing source ids in square brackets.
2. Identify which assumptions in the new proposal repeat assumptions that failed before — be specific about the parallel.
3. End with 3-4 concrete validation steps to run before committing.

If nothing in history is relevant, say so honestly. Do not generate generic startup advice — every warning must trace to a cited past event. Write plainly for a non-technical reader, with quiet authority; this is the moment the room goes silent.

PROPOSAL:
${proposal}

SIMILAR PAST INITIATIVES (retrieved):
${chunks}`;
}

