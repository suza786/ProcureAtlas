# Data Sources — Procurement Source Catalog

**Last updated:** 2026-09-30
**Owner:** Data Engineering
**Status:** Catalog only — no live connectors in Phase 1. All access subject to `DATA_SOURCE_LEGAL_REGISTER.md`.

This document catalogs the procurement data sources in scope for ProcureAtlas AI. The seven priority sources cover the initial market footprint (Bangladesh, Singapore, World Bank, ADB, UN, EU TED, US SAM.gov). Three expansion sources are listed for Phase 6+ planning.

Each entry documents the official name, URL, owner, content types, format, update frequency, access requirements, and notes. The legal and technical access constraints for each source are governed by `DATA_SOURCE_LEGAL_REGISTER.md`.

---

## Priority Sources (Phase 1–2 scope)

### 1. Bangladesh — CPTU e-Government Procurement (eTender)

| Field | Value |
|---|---|
| Official name | e-Government Procurement (e-GP) system of Bangladesh |
| URL | https://www.eprocure.gov.bd/ |
| Owner | Central Procurement Technical Unit (CPTU), Ministry of Planning, Bangladesh |
| Content types | Tender notices, RFP, RFQ, EOI, contract awards, procurement plans |
| Format | HTML listings; PDF / DOCX attachments; some structured XML exports for registered bidders |
| Update frequency | Continuous (notices published throughout the working day) |
| Access requirements | Anonymous browsing of public notice metadata; e-GP registration for bidder-side documents and downloads |
| Notes | Phase 2 candidate for first live connector. Legal review required before any automated retrieval. CPV codes inconsistent; deadlines in local time (BST, UTC+6). |

### 2. Singapore — GeBIZ

| Field | Value |
|---|---|
| Official name | GeBIZ — Singapore's e-Procurement portal |
| URL | https://www.gebiz.gov.sg/ |
| Owner | GovTech Singapore, for Ministry of Finance |
| Content types | ITQ, ITT, RFP, RFI, award notices |
| Format | HTML listings; JSON-like data embedded in pages; some open data through data.gov.sg |
| Update frequency | Continuous during Singapore business hours |
| Access requirements | Anonymous listing access; CorpPass / Singpass Trading Partner account for bidding |
| Notes | Well-structured data; rate-limited access recommended. Awards sometimes redacted on commercial values. |

### 3. World Bank — Procurement

| Field | Value |
|---|---|
| Official name | World Bank Procurement (STEP + Projects) |
| URL | https://procure.worldbank.org/ and https://projects.worldbank.org/ |
| Owner | The World Bank Group |
| Content types | Procurement plans, specific procurement notices (SPNs), contract awards, project procurement data |
| Format | Open data API (https://api.worldbank.org/v2/), CSV / JSON bulk extracts |
| Update frequency | Daily for STEP; weekly for some bulk extracts |
| Access requirements | None for public datasets |
| Notes | SPNs often reference borrower-side portals (e.g., national e-GP) — those must not be scraped without authorization. Award values sometimes missing or in local currency. |

### 4. Asian Development Bank (ADB)

| Field | Value |
|---|---|
| Official name | ADB Procurement Notices & Project Data |
| URL | https://uxdm.adb.org/ and https://www.adb.org/projects |
| Owner | Asian Development Bank |
| Content types | Goods / works / consulting procurement notices, contract awards, project data |
| Format | HTML; downloadable CSV extracts via uxdm.adb.org |
| Update frequency | Weekly (notices); project data updated as milestones reached |
| Access requirements | None for public browsing |
| Notes | Notices duplicated across ADB and borrower portals; deadlines in Manila time (PHT, UTC+8) for ADB-issued notices. |

### 5. United Nations — UNGM

| Field | Value |
|---|---|
| Official name | United Nations Global Marketplace (UNGM) |
| URL | https://www.ungm.org/ |
| Owner | UN Secretariat, on behalf of UN system organizations |
| Content types | EOI, RFP, RFQ, ITB, contract awards, supplier registration |
| Format | HTML; email alerts; some data exposed via data.un.org |
| Update frequency | Continuous (multi-agency submissions) |
| Access requirements | Free UN supplier registration for full document access; anonymous browsing of public listings |
| Notes | Multi-agency variation in classification; awards sometimes delayed or omitted; values often redacted for security. |

### 6. European Union — TED

| Field | Value |
|---|---|
| Official name | Tenders Electronic Daily (TED) |
| URL | https://ted.europa.eu/ |
| Owner | Publications Office of the European Union |
| Content types | PIN, contract notices, contract awards, design contests, qualification systems |
| Format | TED REST API (eForms-compliant), bulk XML / CSV downloads |
| Update frequency | Daily (TED supplement to OJ published each working day) |
| Access requirements | None for data access; API key required for some endpoints |
| Notes | Best-documented open data source in scope. eForms migration introduces field-level inconsistency. CPV codes reliable. All 24 EU languages. |

### 7. United States — SAM.gov

| Field | Value |
|---|---|
| Official name | SAM.gov (System for Award Management) |
| URL | https://sam.gov/ |
| Owner | U.S. General Services Administration (GSA), Integrated Award Environment |
| Content types | Contract opportunities (synopses, solicitations, awards), contract data (FPDS), entity registration, assistance listings, wage determinations |
| Format | REST API (API key required), bulk data extracts |
| Update frequency | Continuous (FPDS data lags 24–72h) |
| Access requirements | Free account + API key for API access; entity registration to bid |
| Notes | Most mature API in scope. NAICS / PSC codes mostly reliable. Notice attachments sometimes duplicated. |

---

## Expansion Sources (Phase 6+)

### 8. United Kingdom — Find a Tender Service (FTS)

| Field | Value |
|---|---|
| Official name | Find a Tender Service |
| URL | https://www.gov.uk/find-tender |
| Owner | Cabinet Office, UK Government |
| Content types | Public sector tenders above UK threshold |
| Format | HTML listings; bulk CSV / API via Contracts Finder API |
| Update frequency | Daily |
| Access requirements | None for public listings |
| Notes | Post-Brexit successor to OJEU notices for UK thresholds. TED still covers Northern Ireland and EU-related notices. |

### 9. Canada — Buyandsell.gc.ca

| Field | Value |
|---|---|
| Official name | buyandsell.gc.ca |
| URL | https://www.buyandsell.gc.ca/ |
| Owner | Public Services and Procurement Canada (PSPC) |
| Content types | Tender notices, standing offers, supply arrangements, contract awards |
| Format | Open data API; CSV / XML bulk downloads |
| Update frequency | Daily |
| Access requirements | None for public data |
| Notes | Strong open data posture; well-documented API. |

### 10. Australia — AusTender

| Field | Value |
|---|---|
| Official name | AusTender |
| URL | https://www.tenders.gov.au/ |
| Owner | Department of Finance, Australia |
| Content types | ATM (Approach to Market), contracts awarded, annual procurement plans |
| Format | HTML; structured CSV downloads; RSS for some categories |
| Update frequency | Daily |
| Access requirements | None for public data |
| Notes | Commonwealth-level only; state-level portals (e.g., NSW eTendering) require separate handling. |

---

## Cross-Source Notes

- **Normalization:** All sources are normalized to the OCDS-inspired canonical model documented in `DATA_MODEL.md`. Original identifiers (OCID, CPTU tender ID, GeBIZ tender ID, World Bank project ID, ADB project ID, UNGM reference, TED notice ID, SAM notice ID) are preserved as cross-reference fields.
- **Currency normalization:** All financial values converted to USD at ingestion using a daily FX snapshot; original currency + rate preserved.
- **Time zone normalization:** All deadlines converted to UTC at ingestion; original time zone and DST flag preserved.
- **Language preservation:** Original notice language preserved verbatim; English / Bangla summaries are LLM-assisted (Phase 2+) and clearly marked as derived content with a confidence score.
- **Deduplication:** Same-tender notices appearing on multiple portals (e.g., a World Bank-financed tender appearing on the borrower's e-GP and on STEP) are linked via the `ProcurementPlan → Tender → Lot` model in `DATA_MODEL.md`.

---

## Open Items

- Validate all URLs (Q4 2026) and re-confirm API availability per source.
- Build a per-source connector design doc before Phase 2 implementation.
- Confirm TED eForms field coverage with sample data extract.
- Confirm SAM.gov API tier and rate limits.
- Confirm UNGM terms for any listing aggregation restriction.
