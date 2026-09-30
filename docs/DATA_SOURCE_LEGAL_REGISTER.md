# Data Source Legal Register

**Last updated:** 2026-09-30
**Owner:** Legal + Engineering
**Status:** Authoritative register for all automated access to procurement data sources.

---

## Policy Statement

ProcureAtlas AI operates under four non-negotiable principles with respect to procurement data sources:

1. **We only access public procurement data through permitted methods.** Permitted methods are: official APIs, public REST / GraphQL endpoints, public RSS / Atom feeds, official open-data bulk downloads, and public HTML pages accessed at reasonable rates.
2. **We never bypass authentication, CAPTCHAs, paywalls, or access controls.** Scraping of bidder-only or authenticated pages is strictly prohibited. We do not use CAPTCHA-bypass services, credential sharing, browser-automation to defeat login walls, or any technique whose primary purpose is to defeat access controls.
3. **We respect every source's terms of service and robots directives.** Each source's ToS and `robots.txt` are reviewed before any automated retrieval and re-reviewed at least quarterly. Where ToS prohibit automated retrieval of public pages, we use only the official API or open-data feeds.
4. **We attribute and we rate-limit.** Where attribution is required, we display it on the source's data within the product. We rate-limit all automated retrieval to conservative per-source limits well below any documented ceiling.

No source is accessed programmatically until this register has an entry for it AND legal review has signed off. Phase 1 has zero live connectors. Phase 2 begins live connector implementation only after each source's entry below is complete and signed off by Legal.

---

## Register Entries

### 1. Bangladesh — CPTU eTender (e-GP)

| Field | Value |
|---|---|
| URL | https://www.eprocure.gov.bd/ |
| Terms of service URL | https://www.eprocure.gov.bd/ (site terms; see footer + e-GP manual) |
| Permitted access method | Public HTML notice listings at conservative rate; e-GP registered bidder account for bidder-side documents (manual retrieval only in Phase 2) |
| Prohibited methods | Bypass of e-GP authentication; CAPTCHA bypass; automated retrieval of bidder-only pages; scraping with credentials shared across tenants |
| Authentication requirements | None for public notice metadata; e-GP account for bidder documents |
| Rate limits | Conservative self-imposed: ≤ 1 request / 3 seconds, ≤ 1000 requests / day |
| Attribution requirements | "Source: CPTU e-GP, Government of Bangladesh" on every tender detail |
| Last review date | 2026-09-30 |
| Legal sign-off | Pending (Phase 2 prerequisite) |
| Notes | No official public API. Legal must confirm automated retrieval of public listing pages is permitted before connector implementation. |

### 2. Singapore — GeBIZ

| Field | Value |
|---|---|
| URL | https://www.gebiz.gov.sg/ |
| Terms of service URL | https://www.gebiz.gov.sg/ (site terms) |
| Permitted access method | Public HTML listings at conservative rate; data.gov.sg open data sets where available |
| Prohibited methods | Bypass of CorpPass / Singpass authentication; automated retrieval of bidder-only pages; CAPTCHA bypass |
| Authentication requirements | None for public listings; CorpPass / Singpass Trading Partner account for bidding (manual) |
| Rate limits | Conservative self-imposed: ≤ 1 request / 2 seconds, ≤ 2000 requests / day |
| Attribution requirements | "Source: GeBIZ, GovTech Singapore" |
| Last review date | 2026-09-30 |
| Legal sign-off | Pending (Phase 2 prerequisite) |
| Notes | Confirm data.gov.sg coverage of GeBIZ procurement data; prefer data.gov.sg open data over HTML scraping where available. |

### 3. World Bank — Procurement

| Field | Value |
|---|---|
| URL | https://procure.worldbank.org/ and https://projects.worldbank.org/ |
| Terms of service URL | https://www.worldbank.org/en/about/legal/terms-of-use |
| Permitted access method | World Bank open data API (https://api.worldbank.org/v2/); STEP bulk extracts; Projects API |
| Prohibited methods | Scraping of borrower-side portals referenced in SPNs without their own legal review; bypass of any authentication |
| Authentication requirements | None for public datasets |
| Rate limits | API documentation: per World Bank API guidelines (default 5 requests/second self-imposed) |
| Attribution requirements | "Source: World Bank Group Open Data" |
| Last review date | 2026-09-30 |
| Legal sign-off | Pending (Phase 2 prerequisite) |
| Notes | World Bank is the most open data source in scope. Ensure attribution per World Bank terms of use. |

### 4. Asian Development Bank (ADB)

| Field | Value |
|---|---|
| URL | https://uxdm.adb.org/ and https://www.adb.org/projects |
| Terms of service URL | https://www.adb.org/terms-conditions |
| Permitted access method | ADB open data downloads (CSV) from uxdm.adb.org; public project pages at conservative rate |
| Prohibited methods | Bypass of authentication; automated retrieval of bidder-only pages; CAPTCHA bypass |
| Authentication requirements | None for public data |
| Rate limits | Conservative self-imposed: ≤ 1 request / 2 seconds, ≤ 2000 requests / day |
| Attribution requirements | "Source: Asian Development Bank" |
| Last review date | 2026-09-30 |
| Legal sign-off | Pending (Phase 2 prerequisite) |
| Notes | Confirm ADB open data URL stability for programmatic access before connector design. |

### 5. United Nations — UNGM

| Field | Value |
|---|---|
| URL | https://www.ungm.org/ |
| Terms of service URL | https://www.ungm.org/Public/Terms |
| Permitted access method | Public tender listings at conservative rate; data.un.org open data where applicable |
| Prohibited methods | Bypass of UN supplier registration; automated retrieval of registered-supplier-only documents; CAPTCHA bypass |
| Authentication requirements | Free UN supplier registration for full document access; anonymous for public listings |
| Rate limits | Conservative self-imposed: ≤ 1 request / 3 seconds, ≤ 1000 requests / day |
| Attribution requirements | "Source: United Nations Global Marketplace (UNGM)" |
| Last review date | 2026-09-30 |
| Legal sign-off | Pending (Phase 2 prerequisite) |
| Notes | Confirm UNGM terms for any listing aggregation restriction. Multi-agency variation; some UN agencies publish notices only on their own portals. |

### 6. European Union — TED

| Field | Value |
|---|---|
| URL | https://ted.europa.eu/ |
| Terms of service URL | https://ted.europa.eu/en/legal-notice and https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R1630 (eForms Regulation) |
| Permitted access method | TED REST API (eForms-compliant); bulk XML / CSV downloads |
| Prohibited methods | Bypass of authentication (none required for public data); circumventing rate limits |
| Authentication requirements | API key required for some endpoints (free, self-service) |
| Rate limits | Per TED API documentation (self-imposed well below ceiling) |
| Attribution requirements | "Source: TED, Publications Office of the European Union" |
| Last review date | 2026-09-30 |
| Legal sign-off | Pending (Phase 2 prerequisite) |
| Notes | Best-documented open data source in scope. Reuse permitted under EU Public Procurement Directive. |

### 7. United States — SAM.gov

| Field | Value |
|---|---|
| URL | https://sam.gov/ |
| Terms of service URL | https://sam.gov/content/terms-of-use |
| Permitted access method | SAM.gov REST API (API key required); bulk data extracts |
| Prohibited methods | Bypass of authentication; scraping of authenticated pages; circumventing rate limits; use of entity-sensitive data beyond permitted scope |
| Authentication requirements | Free account + API key |
| Rate limits | Per SAM.gov API documentation (default 10 requests / minute for some endpoints — verify per endpoint) |
| Attribution requirements | "Source: SAM.gov, U.S. General Services Administration" |
| Last review date | 2026-09-30 |
| Legal sign-off | Pending (Phase 2 prerequisite) |
| Notes | Most mature API in scope. Confirm API rate limits and quota for the planned tier. |

---

## Expansion Sources (Phase 6+ — placeholder entries)

| Source | URL | Permitted method | Last review |
|---|---|---|---|
| UK Find a Tender | https://www.gov.uk/find-tender | Contracts Finder API; FTS RSS | TBD |
| Canada buyandsell | https://www.buyandsell.gc.ca/ | Open data API; bulk CSV | TBD |
| Australia AusTender | https://www.tenders.gov.au/ | HTML; CSV extracts; RSS | TBD |

Expansion sources require their own register entries (mirroring the structure above) and legal sign-off before any automated access.

---

## Prohibited Practices (Universal)

The following practices are prohibited across all sources, regardless of perceived permissibility:

- **CAPTCHA bypass** — never. If a source protects pages with CAPTCHA, we do not access those pages programmatically.
- **Authentication bypass** — never. Credentials are never shared across tenants; we never automate access to authenticated-only pages on behalf of a tenant.
- **Credential sharing** — never. Each tenant's bidder account credentials, where used, are stored encrypted, scoped to that tenant, and used only with explicit tenant authorization for that tenant's own workflows.
- **robots.txt violations** — never. We honor every source's robots directives.
- **Aggressive rate-limiting abuse** — never. We rate-limit conservatively, exponential backoff on 429/503, and we never intentionally distribute scraping across IPs to evade limits.
- **Scraping private portals without authorization** — never. Private / invitation-only procurement portals are out of scope.
- **Reselling raw source data** — never. ProcureAtlas AI's product is the intelligence + operations layer built on top of source data, not redistribution of raw source data.

---

## Review Cadence

- Each register entry re-reviewed at least quarterly by Legal + Engineering.
- Re-reviewed immediately on any ToS change notification from a source.
- Re-reviewed before any Phase gate that introduces a new connector.
- All reviews recorded in the `Last review date` field with an audit log entry.

---

## Sign-off Log

| Source | Reviewer | Date | Decision |
|---|---|---|---|
| All seven priority sources | (Pending) | (Pending) | Pending Phase 2 legal review |

No live connector is implemented in Phase 1. This register must be signed off before Phase 2 implementation begins.
