# Discoverability Improvement: implementation report (PRD v4)

This adds a Discoverability Improvement journey next to the existing Information Accuracy journey, in the same app, on the same BrightNest dataset, with the same two roles (Brand by default, ProManage). Everything is fictional and simulated: no AI provider calls, no scraping, nothing is published.

## Routes
| Route | Role | Purpose |
|---|---|---|
| `/attention/discovery/:id` | Brand | Plain-language opportunity page: what we noticed → what we found → what we recommend → what we need from you → progress |
| `/discovery/:id` | ProManage | Investigation page: observed results, eligibility, readiness checks, recommendation composer, plan, implementation handoff, matched recheck |
| `/issues?tab=discovery` | ProManage | Sub-tab of Investigations. Available in MVP; the accuracy tab stays V1-gated |
| `/geo-readiness/:id?tab=content` | ProManage | New "Content improvements" tab |
| Existing `/overview`, `/locations/:id/answers`, `/attention`, `/progress`, `/reports`, `/tasks/:id`, `/monitoring` | Both | Discovery cards and sections added inside existing destinations |

The Brand sidebar keeps its five items (Overview · My Locations · Needs My Attention · Progress · Reports). The "Needs My Attention" badge now also counts discovery items that need the Brand.

## Files
- **New:** `src/lib/discovery.ts` (eligibility rules, seeded readiness snapshots, status model, matched recheck, metrics), `src/lib/useDiscovery.ts`, `src/components/discovery.tsx`, `src/components/ContentImprovements.tsx`, `src/pages/brand/BrandDiscovery.tsx`, `src/pages/DiscoveryInvestigation.tsx`, `e2e/discovery.e2e.mjs`.
- **Changed:** `data/types.ts` (new types; `Task.opportunityId` / `recommendationId`), `data/issues.ts` (non-mentions no longer become `discovery_gap` issues), `data/answers.ts` (one wave-1 fixture flip: Whitefield, Montessori prompt), `store/AppStore.tsx` (persisted `discoveryEligibility` and `discovery`, plus 15 actions and 2 permissions), `App.tsx`, `AppShell.tsx`, `Issues.tsx`, `Tasks.tsx`, `GeoReadiness.tsx`, `Monitoring.tsx`, `Reports.tsx`, `LocationAnswers.tsx` (old tags replaced by eligibility), and the Brand Overview / Locations / Attention / Progress / Reports pages.

## Reused, not rebuilt
- Plan approval → `Task` records → the Tasks page.
- GEO Readiness JSON-LD assets: approved with the plan and attached to the website task.
- `/listings/:id` deep link instead of a second listing editor.
- The verified-fact workflow for "Confirm our services": Brand verifies; ProManage can only propose or request.
- `runRecheck` waves, `EvidenceDisclosure`, `PermButton`, `Dialog`, `Segmented`, `Badge`.

## Data model
- **Opportunity:** one per centre per audit, grouping its unbranded non-mentions. It is derived from the observations and never stored as an error.
- **Status:** one underlying status, derived from the decision, investigation, plan and task records.
- **Eligibility:** stored per centre + question, so the same decision applies to every recheck. Unreviewed questions are decided by the verified record (e.g. Montessori must be in the approved programmes).
- **Metrics:** each has its own denominator. Eligible outlet mention rate counts the correct outlet only; brand-only mentions are excluded; "awaiting review" and "not relevant" are shown separately.

## Test and build results
- `tsc -p tsconfig.app.json`: 0 errors.
- `npm run lint`: 0 errors. The 18 warnings are fast-refresh and hook-dependency notes, mostly in files that already had them.
- `npm run build`: passes. The chunk-size warning was already there.
- `npm run test:e2e` (headless Chrome against the dev server): **53/53 checks pass, 0 console errors.**

## End-to-end use cases (all covered by the e2e script)
- [x] **UC-D1** Whitefield non-mention shown with the exact question and the caveat "not an error". The Brand confirms the Montessori service, then marks it worth investigating (MVP).
- [x] **UC-D2** Electronic City "Saturday tours" marked Not relevant with a reason. It leaves the eligible denominator and the evidence is kept.
- [x] **UC-D3/D4/D6/D7** ProManage runs readiness checks and sees: page content gap, managed listing gap, structured data gap, a sitemap date that needs site-owner confirmation, and a third-party directory (request only). The composer uses verified claims only; the plan goes to the Brand.
- [x] **UC-D5** Whitefield "Can I visit on Saturday?" answer uses the verified tour times and is kept separate from normal opening hours.
- [x] **UC-D8** Koramangala: no controllable gap, so "monitor only" with no invented work.
- [x] Brand sees current vs proposed info with no code, then Approves / Requests changes / Declines. Declined and changes-requested plans create no tasks.
- [x] ProManage records a simulated publication on each task, with evidence required. AI answers are never rewritten. The Brand sees "update recorded — waiting for the next AI check", not "fixed".
- [x] **UC-D9** Whitefield matched recheck: 3/5 → 5/5 from the fixtures, with the counts and the causal caveat.
- [x] **UC-D10** Indiranagar still absent; an honest "start new investigation round" is offered.
- [x] Jayanagar: a changed measurement context makes the recheck Inconclusive, with no delta shown.
- [x] **UC-D11** HSR accuracy issue confirmed separately while the HSR discovery plan was declined. Outcomes stay independent.

## Simulated behaviour and limits
- Source snapshots, readiness findings, competitor names, publication evidence and recheck answers are deterministic fixtures. The six seeded scenarios are Whitefield, HSR Layout, Indiranagar, Jayanagar and Koramangala, plus Electronic City as the negative control. Other centres get generic "no gap / linked accuracy item" findings.
- Recheck outcomes come from the existing wave-flip fixtures and do not depend on whether improvements were approved. The UI therefore says whether updates were recorded before the check and never claims causation.
- Matched cohort = the centre's eligible unbranded prompts in the same audit, on Surface A. The sample is one answer per prompt (small N).

## Remaining gaps
- Real Listing Management editing, CMS publishing and crawler checks are outside the prototype (deep links and simulated evidence only).
- Discovery opportunities aren't created for custom prompts until a person reviews their relevance (they start as "unknown").
- The exported Brand CSV includes discovery rows. The ProManage internal exports (tasks/issues CSV) don't yet have a discovery-specific export.
- The deck's slide 6 progress screenshot shows the old "19 of 50" follow-up figure. With the new Whitefield fixture flip the app shows 20 of 50.
