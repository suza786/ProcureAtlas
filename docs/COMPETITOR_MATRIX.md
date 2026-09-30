# Competitor Matrix — ProcureAtlas AI

**Last updated:** 2026-09-30
**Owner:** Product / Strategy
**Method:** Public web research, vendor marketing pages, industry reporting. Pricing figures are listed only where commonly published; pricing marked "Not published" requires direct sales engagement.

This document compares ProcureAtlas AI against direct competitors (tender intelligence and bid management vendors) and adjacent vendors (procurement analytics, market intelligence, proposal software). The goal is to identify the gap ProcureAtlas AI is built to fill: **a single canonical model across markets, evidence-grounded bid operations, and an MCP-accessible procurement graph** — none of the competitors combine all three today.

---

## 1. Direct Competitors

### 1.1 ProcureIQ / ProcurementIQ (Industry Intelligence)

| Attribute | Detail |
|---|---|
| Focus market | Primarily US/EU mid-market; some global coverage |
| Key capabilities | Procurement market intelligence, vendor research, RFP templates, supplier discovery |
| Gap ProcureAtlas fills | No multi-portal tender aggregation; no Tender Digital Twin; no bid operations workspace; no evidence-grounded compliance matrix |
| Pricing model | Subscription (per seat); published list prices vary by report type |

### 1.2 TenderEasy

| Attribute | Detail |
|---|---|
| Focus market | India + global tenders aggregation |
| Key capabilities | Tender aggregation across geographies, daily email alerts, keyword search, paid subscription tiers |
| Gap ProcureAtlas fills | Aggregation-only (no Tender Digital Twin, no Company Brain, no compliance matrix, no bid workspace, no scoring) |
| Pricing model | Tiered subscription (free + paid plans); published on website |

### 1.3 Opstream

| Attribute | Detail |
|---|---|
| Focus market | Global SaaS source-to-pay (S2P) — procurement side (buyer) |
| Key capabilities | Spend analytics, supplier management, sourcing events (buyer-facing) |
| Gap ProcureAtlas fills | Buyer-side S2P, not supplier-side bid intelligence; no opportunity discovery from public portals; no bid operations |
| Pricing model | Enterprise SaaS (custom pricing) |

### 1.4 Beroe

| Attribute | Detail |
|---|---|
| Focus market | Global procurement intelligence and supplier research |
| Key capabilities | Procurement market intelligence, supplier benchmarking, category research, advisory |
| Gap ProcureAtlas fills | Research/advisory-led (not a workflow platform); no tender aggregation; no bid operations; no compliance matrix; no API |
| Pricing model | Subscription + advisory (enterprise contracts) |

### 1.5 GovWin (Deltek)

| Attribute | Detail |
|---|---|
| Focus market | US federal, state & local government contracting |
| Key capabilities | US opportunity tracking, market intelligence, competitor analysis, teaming partner matching, proposal tools |
| Gap ProcureAtlas fills | US-centric (limited EU/APAC/multilateral coverage); no OCDS canonical model; no MCP; limited bid workspace; US-only compliance matrix |
| Pricing model | Per-seat subscription (published tier pricing for IQ / IQ+); enterprise contracts for full suite |

### 1.6 Bloomberg Government (BGOV)

| Attribute | Detail |
|---|---|
| Focus market | US federal government affairs and contracting |
| Key capabilities | US federal opportunity tracking, legislation, market analysis, agency intelligence |
| Gap ProcureAtlas fills | US federal only; broader policy/government-affairs focus; no bid operations; no global / multilateral coverage; no MCP |
| Pricing model | Enterprise subscription (not publicly listed) |

### 1.7 DeltaBid

| Attribute | Detail |
|---|---|
| Focus market | Bid management (supplier-side) for Latin America + global SME |
| Key capabilities | RFP response management, vendor portal, document exchange, simple compliance tracking |
| Gap ProcureAtlas fills | Buyer-driven RFP management (not market discovery); no opportunity aggregation; no Tender Digital Twin; no intelligence graph |
| Pricing model | Per-user SaaS subscription; published |

### 1.8 TenderTiger

| Attribute | Detail |
|---|---|
| Focus market | India + global tender aggregation |
| Key capabilities | Tender aggregation, email alerts, BOQ parsing, tender results, TenderTiger India focus |
| Gap ProcureAtlas fills | Aggregation-only; minimal eligibility scoring; no Tender Digital Twin; no evidence-grounded compliance matrix; no bid workspace |
| Pricing model | Tiered subscription; published |

### 1.9 BidNet (Bonfire / Kommercial)

| Attribute | Detail |
|---|---|
| Focus market | US state / local government bid aggregation (supplier-side) |
| Key capabilities | US municipal bid aggregation, daily alerts, vendor directory, RFP response tooling |
| Gap ProcureAtlas fills | US state/local only; no international or multilateral coverage; no Tender Digital Twin; no compliance matrix |
| Pricing model | Per-region subscription; published |

### 1.10 Development Business (devbusiness.org)

| Attribute | Detail |
|---|---|
| Focus market | Multilateral development bank procurement (UN, World Bank, ADB, AfDB, IADB) |
| Key capabilities | Multilateral procurement notices, project data, supplier directory |
| Gap ProcureAtlas fills | Notice aggregation only; no Tender Digital Twin; no compliance matrix; no bid operations; no national-portal coverage |
| Pricing model | Subscription (UNDP-affiliated); published tiers |

---

## 2. Adjacent Vendors

| Vendor | Category | Overlap | Why not a direct competitor |
|---|---|---|---|
| Coupa, SAP Ariba, Ivalua | Source-to-Pay (buyer) | Workflow + supplier mgmt | Buyer-side only; no supplier bid intelligence |
| Loopio, Qvidian, Responsive (RFPIO) | Proposal management software | RFP response automation | No market discovery; no tender intelligence; no canonical procurement model |
| Crunchbase, PitchBook | Company intelligence | Firmographic data | Not procurement-specific; no award data |
| Spend Matters, Forrester (procurement) | Analyst coverage | Procurement research | Advisory, not a workflow platform |
| Dataminr, Meltwater | Media / event intelligence | Alerts | Not procurement-specific |

---

## 3. Feature Comparison Matrix

| Capability | ProcureAtlas AI (target) | GovWin | BGOV | TenderEasy | TenderTiger | BidNet | DeltaBid | DevBusiness | Beroe | ProcureIQ |
|---|---|---|---|---|---|---|---|---|---|---|
| Multi-portal opportunity aggregation (≥ 5 markets) | ✅ (target) | US-only | US-only | ✅ (India+global) | ✅ (India+global) | US state/local only | ❌ | ✅ (MDBs) | ❌ | ❌ |
| OCDS-inspired canonical model | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Partial | ❌ | ❌ |
| Tender Digital Twin (lots, requirements, amendments, awards) | ✅ | Partial | Partial | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Company Brain (evidence graph) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Partial | Partial |
| Evidence-grounded compliance matrix | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Partial | ❌ | ❌ | ❌ |
| Deterministic eligibility / fit scoring | ✅ | ❌ | ❌ | Partial | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pursuit pipeline + bid rooms | ✅ | Partial | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Buyer Intelligence (awards, incumbents, spend) | ✅ (P3) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | Partial | ✅ | ❌ |
| Competitor Intelligence | ✅ (P3) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | Partial |
| Partner / JV Finder | ✅ (P3) | ✅ (US teaming) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Multi-language (English + Bangla at launch) | ✅ (P6) | ❌ | ❌ | Partial | Partial | ❌ | ❌ | Partial | ❌ | ❌ |
| Public REST API | ✅ (P5) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| MCP server (LLM-native access) | ✅ (P5) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bangladesh market coverage | ✅ (P1) | ❌ | ❌ | Partial | Partial | ❌ | ❌ | ❌ | ❌ | ❌ |
| Singapore market coverage | ✅ (P1) | ❌ | ❌ | Partial | Partial | ❌ | ❌ | ❌ | ❌ | ❌ |
| World Bank / ADB / UN coverage | ✅ (P1) | ❌ | ❌ | Partial | Partial | ❌ | ❌ | ✅ | ❌ | ❌ |

Legend: ✅ = in scope/target; Partial = limited coverage; ❌ = not in scope.

---

## 4. Differentiation Summary

ProcureAtlas AI's defensible position is the intersection of three capabilities no single competitor delivers today:

1. **Canonical model across markets** — one OCDS-inspired schema spanning Bangladesh, Singapore, multilateral banks, EU, and US. Competitors are either US-only (GovWin, BGOV, BidNet) or aggregation-only without a canonical model (TenderEasy, TenderTiger, DevBusiness).
2. **Evidence-grounded bid operations** — the Company Brain plus evidence-backed compliance matrix turns bid management from a craft into an auditable workflow. Proposal tools (Loopio, Responsive, DeltaBid) automate RFP response but do not connect to a procurement intelligence graph.
3. **LLM-native access (MCP + API)** — the procurement graph is exposed via Model Context Protocol and versioned REST, enabling intelligence teams to query the graph from any AI client. No competitor offers an MCP server today.

Secondary differentiators include Bangladesh / Singapore market depth (underserved by global vendors), multi-tenant SaaS with MFA + SSO, and the principle that **AI is not the source of truth** — every factual claim is evidence-anchored.

---

## 5. Pricing Posture

ProcureAtlas AI's pricing is documented in `PRICING.md`. The structure (Free + Solo + Professional + Team + Enterprise) is positioned below enterprise incumbents (BGOV, GovWin full suite, Beroe advisory) and above pure aggregators (TenderEasy, TenderTiger, BidNet) by including the bid operations layer. Pricing validation is required before launch — see `PRICING.md` and `KNOWN_RISKS.md`.

---

## 6. Open Items

- Validate competitor pricing against current public pages (Q4 2026).
- Conduct 10 customer-discovery interviews to test willingness-to-pay in Bangladesh and Singapore.
- Confirm MCP competitive landscape (no public MCP server from any listed competitor as of research date).
- Re-evaluate after Phase 3 (Buyer / Award / Competitor Intelligence) ships.
