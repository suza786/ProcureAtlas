# ProcureAtlas AI

### Global Tender Intelligence & Bid Operations Platform

> The Intelligence and Operating System for Global Public Procurement.

ProcureAtlas AI helps companies discover public procurement opportunities globally, understand tender requirements, determine eligibility, identify qualification gaps, research buyers and competitors, build evidence-backed compliance matrices, manage bid/no-bid decisions, draft tender responses, track deadlines and amendments, and find consortium / JV / OEM partners.

## Principles

1. **Evidence before AI** — every factual claim is linked to verifiable evidence. The AI never invents projects, customers, certifications, or financials.
2. **Source traceability** — tender intelligence retains portal, URL, document, page, clause, extracted text, timestamp, original language, translation, and confidence.
3. **AI is not the source of truth** — deadlines, financial calculations, eligibility gates, scoring arithmetic, dates, and thresholds are deterministic.
4. **Human approval for consequential actions** — submission, contractual commitments, signed declarations, and partner engagement require explicit human authorization.

## Status

Phase 1 (Foundation & Command Center MVP) — runnable Next.js 16 application with seeded demo data. See `PROJECT_STATE.md` for the authoritative status.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui (New York)
- **State**: Zustand (client), TanStack Query (server)
- **Charts**: Recharts
- **Database**: Prisma + SQLite (dev) — PostgreSQL-ready schema
- **AI SDK**: z-ai-web-dev-sdk (backend only, MCP-ready)
- **Auth**: NextAuth.js v4 (wired-ready, not yet enforced in MVP)

## Quickstart

```bash
bun install                 # already done in this workspace
bun run db:push             # create SQLite schema
bun run scripts/seed.ts     # load demo data
bun run dev                 # dev server on :3000 (auto-started in this env)
bun run lint                # code quality check
```

Open the Preview Panel to view the application. The only externally visible route is `/`.

## Workspace

```
/docs                — product, architecture, security, market, and ops documentation
/scripts             — seed and utility scripts
/src/app             — Next.js App Router (single route: /)
/src/app/api         — REST API routes
/src/components      — UI components (shadcn/ui + custom module components)
/src/lib             — shared utilities, db client, scoring engine
/prisma              — schema.prisma
PROJECT_STATE.md     — authoritative current state
worklog.md           — shared multi-agent log
```

## Documentation Index

| Document | Purpose |
|----------|---------|
| `/docs/PRODUCT_VISION.md` | Long-form product vision and principles |
| `/docs/PRD.md` | Product requirements (MVP and beyond) |
| `/docs/MARKET_RESEARCH.md` | Initial market research per priority country |
| `/docs/COMPETITOR_MATRIX.md` | Competitor and adjacent vendor analysis |
| `/docs/DATA_SOURCES.md` | Catalog of procurement data sources |
| `/docs/DATA_SOURCE_LEGAL_REGISTER.md` | Legal/technical access register per source |
| `/docs/ARCHITECTURE.md` | Reference architecture and decisions |
| `/docs/DATA_MODEL.md` | OCDS-inspired canonical model |
| `/docs/API_SPEC.md` | REST API specification |
| `/docs/AI_ARCHITECTURE.md` | AI/LLM/agent architecture and guardrails |
| `/docs/UX_SPEC.md` | UX principles and module-level specs |
| `/docs/SECURITY.md` | Security baseline and controls |
| `/docs/THREAT_MODEL.md` | Threat model and mitigations |
| `/docs/QA_PLAN.md` | QA strategy and test plan |
| `/docs/DEPLOYMENT.md` | Deployment and runbooks |
| `/docs/ROADMAP.md` | Phased roadmap |
| `/docs/PRICING.md` | Commercial model |
| `/docs/GO_TO_MARKET.md` | GTM strategy |
| `/docs/DECISIONS.md` | Architecture Decision Records |
| `/docs/KNOWN_RISKS.md` | Known risks and mitigations |
| `/docs/HANDOFF.md` | Phase handoff format |
| `PROJECT_STATE.md` | Authoritative current state |

## License

Proprietary. All rights reserved.
