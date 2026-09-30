# AI / LLM Architecture and Guardrails — ProcureAtlas AI

**Status:** Phase 1 — all AI features are scaffolds. No live LLM calls. Deterministic scoring only.
**Phase 2+:** Live LLM features ship only after every guardrail in this document is implemented and tested.
**SDK:** `z-ai-web-dev-sdk` (backend-only; never invoked from the browser).
**Last updated:** 2026-09-30

This document defines (1) the boundary between deterministic and AI tasks, (2) the LLM provider strategy, (3) prompt-injection resistance controls, (4) evidence gating, (5) hallucination prevention, and (6) the MCP integration plan.

---

## 1. Task Boundary: AI vs Deterministic

The platform's four product principles translate into a hard task boundary. AI handles interpretation; deterministic systems own truth.

### 1.1 AI-owned tasks (interpretation, assistance, drafting)

| Task | Examples | Phase |
|---|---|---|
| Classification | Requirement type classification (mandatory / preferred / scoring); document section identification; buyer industry classification | P2+ |
| Summarization | Tender summary; amendment diff summary; award summary; market-pulse narrative | P2+ |
| Extraction assistance | Requirement extraction from PDF; eligibility criterion extraction; deadline extraction (always human-reviewed, always source-cited) | P2+ |
| Semantic matching | Tender ↔ company capability matching (pgvector embeddings); partner / JV recommendation | P3+ |
| Drafting | Proposal section drafts grounded in approved evidence; cover letter; clarification questions | P4+ |
| Reasoning | Bid / no-bid rationale drafting; loss-reason hypothesis; market-trend narrative | P4+ |
| Natural-language interaction | Conversational interface over the procurement graph (via MCP) | P5+ |

### 1.2 Deterministic tasks (truth)

| Task | Why deterministic |
|---|---|
| Deadline computation | Dates, time zones, DST — no probabilistic handling |
| Financial calculation | Tender values, FX conversion, threshold checks — exact arithmetic |
| Eligibility gates | Turnover, years in business, certification presence — boolean / threshold logic |
| Scoring arithmetic | Eligibility / fit / readiness scores — formula with weights, no LLM in the loop |
| Workflow / approval state | Pursuit stage transitions, approval chains — state machine, not AI |
| Compliance matrix gap detection | Requirement ↔ Evidence mapping — boolean logic; AI may *suggest* a mapping but never *assert* it without human confirmation |
| Source citation | Source URL, document, page, snippet — must come from ingestion, not from LLM |
| Audit log | Every action recorded as fact; never paraphrased by AI |

**Rule:** If the output is a number, a date, a status, an ID, a financial value, a deadline, or an eligibility verdict, it is deterministic. The LLM never produces these as facts; if the LLM emits one, it is treated as a suggestion pending deterministic validation.

---

## 2. LLM Provider Strategy

### 2.1 Primary SDK

- `z-ai-web-dev-sdk` is the primary SDK, invoked backend-only.
- LLM calls are wrapped in a service-layer abstraction (`src/lib/llm/`) so the underlying model can be swapped without touching call sites.
- Every LLM call is logged with: caller, model, prompt template hash, input tokens, output tokens, latency, cost, tenant, user, request ID.

### 2.2 Model selection

- Different tasks use different model tiers. Extraction and classification can use a smaller / faster model; drafting and reasoning use a larger model. Model routing is configuration-driven per task type.
- No model is invoked with raw user input without sanitization (see §3).

### 2.3 Fallback

- If `z-ai-web-dev-sdk` is unavailable, the platform degrades gracefully: extraction requests return "manual review required," drafting endpoints return a template prompt for the user to complete manually, semantic matching falls back to keyword + tag matching. No user-facing error exposes SDK internals.

---

## 3. Prompt-Injection Resistance

The platform processes untrusted text — tender documents, clarification questions, supplier-submitted material — through LLMs. Prompt-injection resistance is a first-class requirement.

### 3.1 Input sanitization

- **Untrusted text never enters a prompt as instructions.** Tender / document text is wrapped in a clearly delimited data block (e.g., `<UNTRUSTED_DATA>...</UNTRUSTED_DATA>`) and the system prompt explicitly states that content inside the block is data, not instructions.
- **Control-character stripping** — null bytes, Unicode control characters, and prompt-template-syntax characters are stripped or escaped before inclusion.
- **Length caps** — untrusted text is truncated to a per-task maximum (e.g., 32k tokens for extraction, 8k for classification) to reduce injection surface.
- **No tool invocation from untrusted text** — untrusted text is never passed in a role that allows tool calling. Tool-calling prompts are constructed only from platform-controlled templates.

### 3.2 Output validation

- Every LLM output is parsed against a strict schema (JSON Schema or Zod). Invalid output is rejected and never reaches the user as fact.
- Extracted entities (requirements, deadlines, financials) are validated against source text — the platform verifies that the extracted value appears (verbatim or fuzzy-matched) in the source document. If not, the extraction is flagged "unverified" and routed to human review.
- LLM-emitted numbers, dates, IDs, and statuses are **never** persisted as truth; they are persisted as `extractionConfidence`-tagged suggestions pending deterministic validation.

### 3.3 Tool-call authorization

- LLM agents (Phase 4+) are granted a minimal tool surface, scoped per task. An extraction agent can read documents and write extraction suggestions; it cannot create pursuits, modify evidence, send alerts, or invoke any consequential workflow.
- Every tool call is authorized against the calling user's RBAC role and tenant scope. Tool calls are logged in the audit log with caller, tool, arguments, result, and authorization decision.

### 3.4 Agent action restrictions

- **No autonomous consequential actions.** An LLM agent may never submit a tender, accept a contractual commitment, sign a declaration, change a financial offer, create a partnership, send sensitive commercial information externally, or modify evidence verification status. See ADR-007 in `DECISIONS.md`.
- Agents can only *prepare* drafts and *suggest* mappings. Every consequential action requires explicit human approval via the Approval workflow.

---

## 4. Evidence Gating

### 4.1 The core rule

> **An LLM may not output a factual claim about a company without an Evidence ID backing it.**

If the LLM is asked "Is this company eligible?" and the company has no evidence of ISO 27001 certification, the LLM must respond that the certification is missing — not infer that the company "likely" has it based on its name or industry.

### 4.2 Implementation

- Every company factual claim (certification, project reference, financial figure, employee count, OEM relationship, partner relationship, registration) is backed by an `Evidence` record.
- LLM prompts for drafting / reasoning tasks are constructed from the evidence graph, not from free-text company descriptions. The prompt includes only claims that have evidence IDs; the LLM is explicitly instructed: "If you cannot find evidence for a claim, do not make the claim — surface the gap instead."
- LLM outputs that assert a company fact are validated against the evidence graph. If an output asserts a fact with no matching evidence ID, the output is rejected and the user is shown a "claim not supported by evidence" notice.

### 4.3 Hallucination prevention

- **Source-cited extraction** — every extracted requirement carries `sourceDocumentId`, `sourcePage`, `sourceSnippet`. The platform verifies the snippet exists at the cited page (fuzzy match). If not, the extraction is rejected.
- **Confidence thresholds** — extractions below the confidence threshold are routed to human review and never published as canonical.
- **No LLM-only entity creation** — LLMs cannot create Organization, Buyer, Supplier, or Tender records. They can only suggest attributes on existing records (created by ingestion).
- **Translation labeling** — LLM-produced translations are clearly labeled as derived content with a confidence score; the original-language text is always preserved as the source of truth.

---

## 5. Cost + Performance Controls

- **Caching** — LLM outputs are cached by `(promptTemplateHash, inputHash)` for stable prompts (e.g., classification). Cache TTL is task-specific.
- **Token budgeting** — per-tenant daily token budget; over-budget requests are queued or rejected with a clear message.
- **Model routing** — small models for high-volume tasks (classification), large models for low-volume high-stakes tasks (drafting).
- **Async execution** — long-running LLM tasks (extraction over large documents, multi-document drafting) run async via the worker pool; results are pushed to the user via TanStack Query refetch / WebSocket.

---

## 6. MCP Integration Plan (Phase 5)

### 6.1 What MCP exposes

The MCP server exposes the procurement graph as tools consumable by external AI clients (Claude Desktop, custom agents, IDE assistants):

- `tenders.search` — search tenders by filter
- `tenders.get` — fetch Tender Digital Twin
- `tenders.requirements` — fetch requirements with source citations
- `tenders.eligibility` — fetch deterministic eligibility assessment
- `company.brain` — fetch tenant company brain (evidence graph)
- `company.capability_map` — fetch capability map
- `pursuits.list` — list pursuits
- `compliance.matrix` — fetch compliance matrix
- `alerts.list` — fetch active alerts

### 6.2 What MCP does NOT expose

- No tools that perform consequential actions (no `pursuit.submit`, no `evidence.delete`, no `approval.decide`).
- No tools that expose another tenant's data.
- No tools that bypass evidence gating.

### 6.3 Authorization

- MCP access requires an API key with `mcp:read` scope (or `mcp:read_write` for a future write surface).
- Every MCP tool call is authorized against the API key's tenant + role + scope.
- Every MCP tool call is logged in the audit log.

### 6.4 Transport

- HTTP + SSE for the public MCP endpoint (`/api/mcp/sse`).
- stdio for internal use (Claude Desktop bridge, dev tooling).

### 6.5 Prompt-injection resistance for MCP

- MCP tool calls are deterministic and parameterized. The MCP server does not invoke an LLM in response to a tool call; it returns structured data. The LLM that consumes the data is the caller's responsibility.
- The MCP server never returns data the caller's API key is not authorized to read.

---

## 7. LLM / Agent Security Controls (Summary)

| Control | Implementation |
|---|---|
| Backend-only invocation | `z-ai-web-dev-sdk` never imported in client components; ESLint rule enforced |
| Input sanitization | Untrusted text wrapped in `<UNTRUSTED_DATA>` blocks; control chars stripped; length caps |
| Output validation | Strict schema parse; source-text verification; confidence thresholds |
| Tool-call authorization | Per-task tool surface; RBAC + tenant scope; audit log |
| Agent action restriction | No autonomous consequential actions; human-in-the-loop always |
| Evidence gating | LLM may not output a company factual claim without Evidence ID |
| Hallucination prevention | Source-cited extraction; no LLM-only entity creation; translation labeling |
| Cost control | Per-tenant token budget; caching; model routing |
| Audit | Every LLM call logged with caller, model, prompt hash, tokens, latency, cost |
| Provider abstraction | `src/lib/llm/` wrapper; graceful degradation on provider failure |
| No PII in prompts | PII scrubbing before LLM invocation (Phase 3+); tenant data minimization |
| No training on tenant data | Provider contract prohibits training on API inputs (verified at procurement) |

---

## 8. Phase 1 Status

In Phase 1, the following AI features are **scaffolds only** (UI surfaces, no live LLM calls):

- Requirement extraction (UI lists seeded requirements; LLM extraction deferred to Phase 2)
- Tender summary (UI shows description text; LLM summary deferred to Phase 2)
- Eligibility assessment (deterministic engine runs; LLM narrative deferred to Phase 2)
- Compliance mapping suggestions (deterministic tag matching only; LLM suggestions deferred to Phase 2)
- Semantic search (keyword + tag matching only; pgvector deferred to Phase 3)
- Proposal drafting (not built; Phase 4)
- Conversational interface (not built; Phase 5)

All UI surfaces that will eventually use AI are labeled "AI-assisted (planned)" or hidden behind a feature flag in Phase 1. The Phase 1 product makes **no live AI claims** to the user.
