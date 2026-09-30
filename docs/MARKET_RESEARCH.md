# Market Research — Priority Procurement Markets

**Research date:** 2026-09-30
**Researcher:** Product
**Sources:** Official procurement portals (cited per market). Volume estimates are order-of-magnitude figures based on publicly reported portal activity and should be validated before connector implementation.

This document captures a per-market snapshot for the seven priority markets in scope for ProcureAtlas AI Phase 1–2. Each entry covers portal URL, primary language, content type, API availability, legal access constraints, registration requirements, known data quality issues, search / filter capabilities, and an indicative tender volume estimate.

---

## 1. Bangladesh — CPTU e-Government Procurement (eTender)

| Field | Value |
|---|---|
| **Portal** | https://www.eprocure.gov.bd/ |
| **Owner** | Central Procurement Technical Unit (CPTU), Ministry of Planning, Government of Bangladesh |
| **Primary language** | English (interface) and Bangla (some solicitation documents) |
| **Content type** | Tender notices, RFPs, RFQs, EOIs, contract awards, procurement plans |
| **API availability** | No official public REST API. Public tender lists are accessible via the portal's notice board; some structured XML/CSV exports are available through the e-GP system for registered bidders. |
| **Legal access constraints** | Public notices are open data. Bidder-specific documents require e-GP registration. Terms of use must be reviewed before any automated retrieval; scraping of authenticated pages is prohibited. |
| **Registration requirements** | Bidders register with e-GP for full document access. Anonymous browsing of notice metadata is permitted. |
| **Known data quality issues** | Inconsistent categorization (CPV codes not always present); deadlines shown in local time (BST, UTC+6); amendments sometimes posted as new notices rather than linked revisions; embedded PDFs scanned rather than text-based. |
| **Search / filter** | By procuring entity, organization, tender / acceptance / closing date, tender type, category. Full-text search of notice titles only. |
| **Volume estimate** | ~30,000–50,000 tenders / year nationally. |

---

## 2. Singapore — GeBIZ

| Field | Value |
|---|---|
| **Portal** | https://www.gebiz.gov.sg/ |
| **Owner** | GovTech Singapore, on behalf of the Ministry of Finance |
| **Primary language** | English |
| **Content type** | Invitation-to-Quote (ITQ), Invitation-to-Tender (ITT), Request-for-Proposal (RFP), Request-for-Information (RFI), award notices |
| **API availability** | GeBIZ provides a public listing of opportunities and awards. A registered GeBIZ Trading Partner account is required for bidding. Open data is also exposed through data.gov.sg for some procurement datasets. |
| **Legal access constraints** | Public notices are open. Automated retrieval of public listing pages is permitted within reasonable rate limits; the GeBIZ terms of use must be consulted before any production scraping. Authenticated bidder pages must not be scraped. |
| **Registration requirements** | Singpass / CorpPass-based GeBIZ Trading Partner registration for bidding; anonymous listing access for browsing. |
| **Known data quality issues** | Well-structured JSON / HTML on listings; some ITT attachments are large; awards sometimes published with redacted commercial values. |
| **Search / filter** | By procurement agency, opportunity type, status, publish / close date, category, keyword. |
| **Volume estimate** | ~10,000–20,000 opportunities / year. |

---

## 3. World Bank — Procurement

| Field | Value |
|---|---|
| **Portal** | https://procure.worldbank.org/ (Systematic Tracking of Exchanges in Procurement — STEP) and https://projects.worldbank.org/ |
| **Owner** | The World Bank Group |
| **Primary language** | English (project documents may be in borrower country language) |
| **Content type** | Procurement plans, specific procurement notices (SPNs), contract awards, project procurement data |
| **API availability** | World Bank publishes procurement data through open data feeds (CSV / JSON); the Projects API at https://api.worldbank.org/v2/ covers project-level data. STEP offers downloadable datasets. |
| **Legal access constraints** | Open data under the World Bank Open Data terms. Attribution encouraged. |
| **Registration requirements** | None for public datasets. |
| **Known data quality issues** | Borrower-executed procurement often updated with delay; award values sometimes missing or in local currency without FX rate; SPNs reference borrower-side portals which ProcureAtlas AI should not scrape without authorization. |
| **Search / filter** | By country, sector, project ID, notice type, status, fiscal year. |
| **Volume estimate** | ~20,000–40,000 procurement notices / year across all borrower countries. |

---

## 4. Asian Development Bank (ADB)

| Field | Value |
|---|---|
| **Portal** | https://uxdm.adb.org/ (Procurement / Consulting Services) and https://www.adb.org/projects |
| **Owner** | Asian Development Bank |
| **Primary language** | English |
| **Content type** | Procurement notices (goods, works, consulting), contract awards, project data |
| **API availability** | ADB publishes open datasets; some endpoints accessible via uxdm.adb.org. Project data is downloadable in CSV. No documented stable REST API for notices. |
| **Legal access constraints** | Public notices are open data. Attribution per ADB terms of use. |
| **Registration requirements** | None for browsing public notices. Bidder registration on the borrower's portal is required to bid. |
| **Known data quality issues** | Notices duplicated across ADB and borrower portals; deadlines in Manila time (PHT, UTC+8) for ADB-issued, local time for borrower-issued; country classification sometimes ambiguous. |
| **Search / filter** | By country, sector, project, notice type, status, date. |
| **Volume estimate** | ~5,000–10,000 notices / year. |

---

## 5. United Nations — UNGM

| Field | Value |
|---|---|
| **Portal** | https://www.ungm.org/ |
| **Owner** | United Nations Global Marketplace (UNGM), managed by UN Secretariat on behalf of UN system organizations |
| **Primary language** | English, French, Spanish (interface); solicitation documents may be in any UN language |
| **Content type** | Expressions of interest, RFPs, RFQs, ITBs, contract awards, supplier registration |
| **API availability** | UNGM provides public tender listings. There is no documented public REST API; opportunities are published in HTML and email alerts. UN organizations also publish procurement data to data.un.org. |
| **Legal access constraints** | Public listings are open. Automated retrieval must respect UNGM terms; no bypassing of authentication. |
| **Registration requirements** | UN Supplier registration (free) required to access some documents and to bid. Anonymous browsing of public listings permitted. |
| **Known data quality issues** | Multi-agency variation in classification; awards sometimes published late or not at all; values often redacted for security reasons. |
| **Search / filter** | By UN agency, country, notice type, deadline, sector, keyword. |
| **Volume estimate** | ~10,000–20,000 opportunities / year across UN system. |

---

## 6. European Union — TED (Tenders Electronic Daily)

| Field | Value |
|---|---|
| **Portal** | https://ted.europa.eu/ (TED) and https://ec.europa.eu/info/policies/public-procurement/eu-public-procurement-portal_en |
| **Owner** | Publications Office of the European Union |
| **Primary language** | All 24 official EU languages (notices in buyer's language; TED offers machine translation) |
| **Content type** | Prior information notices (PIN), contract notices, contract awards, design contests, qualification systems |
| **API availability** | TED publishes an open data API (TED API) and bulk XML / CSV downloads. Documentation at https://docs.ted.europa.eu/. Notices conform to eForms (EU Regulation 2022/1630). |
| **Legal access constraints** | Open data under the EU Public Procurement Directive; reuse permitted with attribution. |
| **Registration requirements** | None for data access. |
| **Known data quality issues** | eForms migration has introduced some field-level inconsistency between legacy and new notices; CPV codes are reliable but country-specific sub-codes vary; buyer identifiers need cross-referencing with EU registry. |
| **Search / filter** | By CPV code, country, NUTS region, notice type, deadline, procedure type, value range, keyword. |
| **Volume estimate** | ~150,000+ notices / year across EU + EEA + candidate countries. |

---

## 7. United States — SAM.gov

| Field | Value |
|---|---|
| **Portal** | https://sam.gov/ |
| **Owner** | U.S. General Services Administration (GSA), Integrated Award Environment (IAE) |
| **Primary language** | English |
| **Content type** | Contract opportunities (synopses, solicitations, awards), contract data (FPDS), assistance listings, wage determinations, entity registration |
| **API availability** | SAM.gov provides a documented REST API (API key required) for opportunities, entities, contract data, and assistance listings. Documentation at https://open.gsa.gov/api/. Bulk data extracts also available. |
| **Legal access constraints** | Public open data under U.S. open data policy. API key required; rate limits apply. Entity-sensitive data is restricted. |
| **Registration requirements** | Free account + API key for API access. SAM.gov entity registration required to bid on U.S. federal contracts. |
| **Known data quality issues** | NAICS / PSC codes mostly reliable but inconsistently applied; notice attachments sometimes duplicated; FPDS award data lags real-time by 24–72h. |
| **Search / filter** | By NAICS code, PSC, place of performance, notice type, posted date, deadline, set-aside type, keyword. |
| **Volume estimate** | ~100,000+ contract opportunities / year (federal). |

---

## Cross-Market Observations

- **Common identifiers:** OCID (Open Contracting ID), CPV (EU), NAICS (US), UNSPSC (multilateral) — ProcureAtlas AI maintains a crosswalk table in `DATA_MODEL.md`.
- **Currency:** All financial values normalized to USD at ingestion time using a daily FX snapshot; original currency preserved.
- **Time zones:** All deadlines normalized to UTC at ingestion time; original time zone and DST flag preserved.
- **Languages:** Original notice language preserved alongside English / Bangla summaries (translation deferred to Phase 2 LLM).
- **Amendments:** All seven portals support amendments; structure differs significantly. Canonical amendment model is in `DATA_MODEL.md`.

---

## Open Research Items

- Validate TED eForms field coverage against canonical model.
- Confirm World Bank STEP bulk extract update cadence (daily vs. weekly).
- Investigate ADB open data download URL stability for programmatic access.
- Confirm SAM.gov API rate limits for the planned tier.
- Review UNGM terms for any prohibition on listing aggregation (for attribution).
- Verify CPTU e-GP public listing URL patterns before any connector design.

All live connector work is gated on legal review per `DATA_SOURCE_LEGAL_REGISTER.md`. No scraping or automated retrieval has been performed in Phase 1.
