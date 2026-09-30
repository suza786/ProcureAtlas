# UX Specification — ProcureAtlas AI

**Status:** Phase 1 MVP delivered. This document defines the aesthetic principles and per-module specs.
**Last updated:** 2026-09-30

---

## 1. Aesthetic Principles

ProcureAtlas AI combines three design traditions:

1. **Bloomberg-style intelligence terminal** — dense information layout, monospace numeric typography for financial figures, dark sidebar, light canvas, KPI tiles, real-time-feeling status indicators. Information density over whitespace; the user should see the market at a glance.
2. **Modern AI workflow tool** — clean module boundaries, contextual AI surfaces (clearly labeled, never auto-applying consequential changes), progressive disclosure (summary → detail → action), inline evidence chips with hover-to-source.
3. **Enterprise bid management workspace** — kanban + table + matrix views, audit-trail visible on every action, approval badges, role-aware action surfaces.

### 1.1 Design tokens (Tailwind 4 + shadcn New York)

| Token | Value | Use |
|---|---|---|
| Background canvas | `hsl(0 0% 100%)` (light) / `hsl(222 47% 6%)` (dark) | App background |
| Sidebar | `hsl(222 47% 11%)` (dark) regardless of theme | Left navigation, always dark |
| Foreground | `hsl(222 47% 11%)` (light) / `hsl(210 40% 98%)` (dark) | Primary text |
| Muted foreground | `hsl(215 16% 47%)` | Secondary text |
| Primary | `hsl(221 83% 53%)` | Brand blue |
| Success | `hsl(142 71% 45%)` | Eligibility pass / compliant |
| Warning | `hsl(38 92% 50%)` | Conditional / partial / approaching deadline |
| Danger | `hsl(0 84% 60%)` | Fail / gap / past deadline |
| Numeric / mono | `ui-monospace, SFMono-Regular, Menlo, monospace` | All financial values, IDs, deadlines |

### 1.2 Information density rules

- Default list row height: 56px (one row shows title + buyer + value + deadline + scores).
- KPI tile minimum: 4 tiles per row on desktop, 2 on tablet, 1 on mobile.
- Tables show up to 10 rows by default with "show more" expansion; pagination above 50 rows.
- Hover states reveal contextual actions (open twin, create pursuit, view evidence) without leaving the list.

### 1.3 Evidence chips

Every claim that originates from an `Evidence` record is rendered as a chip: `📜 ISO 27001 — verified 2024-11-02`. Hover reveals the evidence card (issuer, expiry, source URL, file). Every claim **without** evidence is rendered as a red gap chip: `⚠ Gap — ISO 27001 not on file`.

### 1.4 AI surface labeling

- AI-assisted UI elements carry a small `✨ AI-assisted` chip.
- AI outputs (suggested mappings, drafts, summaries) are visually distinct from deterministic data — muted background, italic, "AI suggestion" tag, "Accept" / "Reject" controls.
- Consequential actions never originate from AI — only from human-clicked buttons labeled with the action verb.

---

## 2. Layout

### 2.1 Shell

```
┌─────────────────────────────────────────────────────────────────┐
│ Topbar: Logo • Tenant switcher • Search • Alerts • User menu     │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                       │
│ Sidebar  │              Module Canvas                            │
│ (dark)   │  (breadcrumbs + module view + sticky footer)          │
│          │                                                       │
│ - Cmd    │                                                       │
│ - Disc   │                                                       │
│ - Twin   │                                                       │
│ - Brain  │                                                       │
│ - Purs.  │                                                       │
│ - Bid    │                                                       │
│ - Matrix │                                                       │
│          │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

- **Sidebar:** always dark, fixed on desktop (240px), collapsible to icon-rail (72px) on tablet, hidden on mobile (hamburger).
- **Topbar:** 56px tall. Tenant switcher (top-left), global search (center, `⌘K`), alert bell with unread count, user menu (top-right).
- **Sticky footer:** visible on every module view. Shows: current tenant plan + quota usage, last data sync timestamp, status indicator (live / demo mode), keyboard shortcut hint. The footer is the persistent "system state" surface.

### 2.2 Module view structure

Every module view follows: **Breadcrumbs → Page title + actions → Filter bar (where applicable) → Content → Module-level footer actions.**

---

## 3. Module Specs

### 3.1 Command Center

The executive dashboard. First screen after login. Designed to answer "what matters this week?" in 60 seconds.

**Layout (top to bottom):**

1. **KPI tiles (4-up):** Active pursuits count; Submissions due this week; Eligibility pass rate (rolling 30d); Total tracked opportunity value (USD).
2. **Deadline timeline (full-width chart):** horizontal timeline of next 30 days; each bar is a pursuit deadline; color-coded by stage; click → pursuit detail.
3. **Market pulse (left half):** line chart of new tender publications per market per week (last 12 weeks). Toggle markets.
4. **Eligibility vs. Opportunity Fit scatter (right half):** each dot is a tracked tender; x = eligibility, y = fit; quadrant highlight for "bid now" (top-right). Click → Tender Digital Twin.
5. **Active alerts (left half):** list of top 5 unacknowledged alerts; severity-colored.
6. **Recent pursuits (right half):** last 5 updated pursuits with stage badge + days-to-deadline.

### 3.2 Discover

The tender radar.

- **Filter bar (sticky):** market multi-select, sector multi-select, status multi-select, deadline range, value range, search input. Applied filters render as removable chips below the bar.
- **Table columns:** Title (with buyer subtitle), Market (flag chip), Sector, Value (mono, USD), Deadline (mono, with countdown), Status, Eligibility (chip: pass / conditional / fail / unknown), Fit (numeric 0-100), Actions (open twin, create pursuit).
- **Row interactions:** click row → Tender Digital Twin; hover → quick actions.
- **Empty state:** "No tenders match your filters. Try widening the deadline range or clearing sector filters."
- **Bulk actions:** select rows → "Add to watchlist" / "Create pursuits" (Phase 2+).

### 3.3 Tender Digital Twin

The canonical tender record. Tabbed.

**Tabs:**

1. **Overview** — title, description, buyer card, value, publication date, deadline (with countdown + timezone), procedure type, funding source, status badge, amendment count.
2. **Lots** — list of lots with lot number, title, value, delivery window, status. Click → lot detail.
3. **Requirements** — table: section, clause, text, type chip (mandatory / preferred / scoring), category chip, source citation (document name + page, hover → snippet), extraction confidence (chips for LLM-extracted). Filter by type / category / review status.
4. **Amendments** — chronological list with amendment number, date, summary, source link. Diff against prior version (Phase 2+).
5. **Eligibility** — deterministic assessment: overall status banner (pass / conditional / fail), then per-gate list (criterion, threshold, status, matched evidence, reason).
6. **Awards** — list of related awards (where tender has closed / been awarded): awardee, value, date, source link.
7. **Documents** — list of source documents with type, size, source link, ingested-at. (File viewer deferred to Phase 2+.)

**Twin-level actions:** Create pursuit, Add to watchlist, Share (internal), Export (PDF).

### 3.4 Company Brain

The tenant's evidence graph.

- **Header:** Company name, country, registration number, capability tags.
- **Evidence tiles (grid):** one tile per Evidence item. Tile shows type icon, title, issuer, issue date, expiry (color-coded), verification badge, tags. Click → evidence detail drawer.
- **Expiry tracking (sidebar card):** list of evidence sorted by days-to-expiry. Color-coded: green >30d, yellow 7-30d, red <7d, black expired.
- **Capability map (visualization):** sectors × capabilities matrix with strength scores (deterministic, based on evidence count + recency + verification). Color intensity = strength. Gaps highlighted.
- **Certifications sub-tab:** table of certifications with status (active / expiring / expired).
- **Project references sub-tab:** cards with client, value, role, dates, sectors.
- **Employees sub-tab:** table with name, role, qualifications, certifications.
- **Partners sub-tab:** cards with partner organization, type (JV / OEM / Subcontractor), agreement dates, linked evidence.

### 3.5 Pursuits

Pipeline kanban.

- **Columns (default):** Discovering, Qualifying, Bidding, Submitted, Won, Lost. (Withdrawn collapses into Lost with a "withdrawn" tag.)
- **Card:** tender title (truncated), buyer, deadline countdown (color-coded), estimated value, owner avatar, compliance snapshot bar (compliant / partial / gap proportions), priority badge.
- **Card interactions:** click → Bid Room; drag → change stage (with audit log entry); hover → quick actions (assign owner, change priority, withdraw).
- **Header:** pursuit count per stage, total pipeline value, filter bar (owner, market, priority).

### 3.6 Bid Rooms

The bid workspace for a single pursuit.

- **Header:** Pursuit name, tender title, buyer, deadline countdown, stage badge, owner, team avatars, "Open Tender Digital Twin" button.
- **Layout (tabs):**
  1. **Overview** — pursuit summary, decision rationale, estimated win probability, estimated contract value.
  2. **Compliance Matrix** (see §3.7 — also accessible standalone).
  3. **Tasks** — bid-prep task list (assignee, due date, status); drag to reorder; quick add.
  4. **Team** — team members with roles; assign / unassign.
  5. **Documents** — bid documents (cover letter, technical proposal, financial proposal, declarations). (File upload deferred to Phase 2.)
  6. **Activity / Audit** — chronological audit log of pursuit changes.
  7. **Approvals** — approval chain status (Phase 4+).
- **Sticky footer:** next deadline, next required approval, submission readiness score.

### 3.7 Compliance Matrix

The requirement × evidence coverage table.

- **Rows:** Requirements (filtered by tender / lot). Each row shows requirement text, type, category, source citation.
- **Columns:** Compliance status (compliant / partial / gap / not applicable), Evidence (chip with evidence ID + hover card), Notes, Last updated by, Last updated at.
- **Gap visualization:** rows with `GAP` status have a red left border + a "Suggest evidence" button (Phase 2+ LLM-assisted suggestion, clearly labeled as AI).
- **Matrix-level summary bar:** total requirements, compliant count, partial count, gap count, completion percentage.
- **Actions per row:** Map evidence (opens evidence picker), mark gap, mark not applicable (with reason), add note.
- **Export:** "Export compliance matrix" → CSV / PDF (Phase 2+).
- **Sticky footer:** completion percentage, "Open in Bid Room" button, last-saved timestamp.

---

## 4. Responsiveness

| Breakpoint | Behavior |
|---|---|
| Desktop (≥1280px) | Full layout: sidebar + topbar + module canvas. Multi-column dashboards. |
| Tablet (768–1279px) | Sidebar collapses to icon-rail; dashboards stack to 2-up KPI tiles; tables hide secondary columns. |
| Mobile (<768px) | Sidebar hidden (hamburger); single-column everything; tables → card lists; kanban → vertical stack with column selector. |

All module views are designed mobile-down. No module is desktop-only; mobile users can perform all critical workflows (view tender, check eligibility, update pursuit stage, mark compliance).

---

## 5. Accessibility

- **Target:** WCAG 2.1 AA. axe-core checks run in CI from Phase 2.
- **Keyboard:** every interactive element is keyboard-reachable; `⌘K` opens global search; `Tab` order is logical; visible focus ring on every focusable element.
- **Screen readers:** semantic HTML; ARIA labels on icon-only buttons; live regions for alerts and score updates; table headers associated with cells.
- **Color contrast:** all text meets 4.5:1 contrast; status colors (success / warning / danger) are also distinguished by icon + text, not color alone.
- **Motion:** respect `prefers-reduced-motion`; Framer Motion transitions disabled when reduced-motion is set.
- **Localization:** all strings externalized; layout tested for RTL (Arabic) at Phase 6.

---

## 6. Sticky Footer Rules

The sticky footer is the persistent "system state" surface. It appears on every module view at the bottom of the viewport.

**Footer contents (left to right):**

1. **Tenant plan + quota usage:** "Professional plan • 47 / 100 pursuits • 312 / 1000 tenders tracked" (Phase 3+).
2. **Data sync status:** "Last sync: 2 min ago" (Phase 2+) or "Demo mode — seeded data" (Phase 1).
3. **System status indicator:** green dot (healthy) / yellow (degraded) / red (outage) with hover-for-detail.
4. **Keyboard shortcut hint:** "Press `?` for shortcuts" (Phase 2+).

The footer never blocks content; module content has bottom padding equal to footer height. The footer is always visible regardless of scroll position.

---

## 7. Empty + Loading + Error States

| State | Pattern |
|---|---|
| Empty (no data) | Illustration + clear statement + primary action button ("Add your first evidence item") |
| Loading (initial) | Skeleton placeholders matching final layout shape (no spinners for full-page loads) |
| Loading (refetch) | Inline spinner on the affected component; existing data remains visible (stale-while-revalidate) |
| Error (transient) | Toast notification with retry action; existing data remains visible |
| Error (fatal) | Full-card error with error code + "Contact support" link; audit log entry auto-created |
| 404 | Friendly "not found" with link back to Command Center |
| 403 | Friendly "you don't have access" with link to request access (Phase 2+) |

---

## 8. Phase 1 Deviations

- **Sidebar nav uses Zustand view-state, not URL routing** (sandbox constraint, ADR-001). Module views are not deep-linkable in Phase 1; deep-linking arrives Phase 2.
- **No live AI surfaces** — all AI-assisted UI elements are hidden behind feature flags or labeled "AI-assisted (planned)".
- **No file upload UI** — evidence tiles show seeded data; upload flow is Phase 2.
- **No approval workflow UI** — approval chain model is defined; UI is Phase 4.
- **No mobile optimization testing** — Phase 1 targets desktop / tablet; full mobile QA is Phase 2.

---

## 9. Open UX Questions

- Should the Command Center support user-customizable widgets, or stay opinionated? (Leaning: opinionated default + 1-2 configurable slots in Phase 3.)
- Should the Compliance Matrix support custom requirement rows (beyond extracted)? (Leaning: yes, Phase 3 — bid teams often track internal requirements.)
- Should the Tender Digital Twin support side-by-side comparison? (Leaning: yes, Phase 3.)
- Dark mode default or light mode default? (Leaning: light default, dark optional, sidebar always dark.)
