# PRD v7 (audit-first) + Demo Script v8: implementation report

This is a non-destructive upgrade of the existing app. Baseline tag: `baseline-before-v7`. Everything is simulated: no AI provider calls, CMS/listing writes, crawling or scheduled jobs.

## What changed for the Brand
- **One Brand workspace with three chapters:** `01 · Detect (MVP)`, `02 · Improve (V1)`, `03 · Measure (V2)`. All three are always clickable. The first click on a chapter unlocks it cumulatively, and the unlock persists across refresh and deep links.
  - There's no release toggle and no Brand/ProManage switch in the Brand UI.
  - The internal ProManage workspace and **Reset demo** live in a hidden **Demo settings** panel (⌘ . or Account menu → Demo settings).
- **Status bar** under the header shows:
  - the scope (All locations · All findings · Latest standard check);
  - independent counts of discovery opportunities, accuracy findings and items that need your approval;
  - utility links: Choose locations, View evidence, Download report, Approval history;
  - a "Simulated prototype" label.

### MVP — Detect (`/detect`, the default route)
- The page opens with the headline, then **Questions parents may ask**: curated examples grouped into *Being found (Discoverability)* and *Information accuracy*, labelled "not search-volume data".
- Next comes a 10-centre pilot selector (all preselected, adjustable), then **Run AI Visibility Check** with a "Simulated demo check" label.
- The check uses the existing audit engine and immutable observations, so no new audit database was created.
  - If the selected centres were already checked, the page offers **View latest check** or a clearly labelled **Replay demo**. A replay never creates a fake new sample.
- **Results:**
  - Coverage line and denominators.
  - A Discoverability tile showing eligible n/N. Branded accuracy prompts are never counted in this denominator.
  - An Accuracy tile showing findings and checkable claims.
  - One card per location. Whitefield shows **one discovery opportunity** ("Best Montessori preschools in Whitefield, Bengaluru") and **one accuracy finding** ("Does BrightNest Whitefield offer Saturday campus tours?": AI said "No Saturday tours", the verified record says "Saturday tours 10 AM–1 PM"). Each has a **View original AI answer** link.

### V1 — Improve (`/improve`)
- **ProManage's work is automated (simulated).** On unlock, it investigates the standard check's findings using seeded source snapshots, managed listing data and GEO Readiness, then prepares proposals in one queue grouped by location. Opening the tab never approves or publishes anything.
- **Each proposal walks through:** What we found → What ProManage checked (confirmed source gaps, labelled separately from the hypothesized AI impact) → What we recommend · exact before/after → Expected benefit (not guaranteed).
- **Read-only technical appendix**, "Technical details prepared by ProManage": validated JSON-LD (copy/download), the fact sheet, content/listing diffs, fact provenance, and "What we cannot change automatically".
- **Approve & authorize** works on the selected targets. The approval is frozen as a versioned `ProposalApproval`. The existing approval engine creates the tasks, then the simulated connector applies permission-checked attempts per target:
  - Connected targets → `Updated (simulated)`. Only the source snapshot changes; recorded AI answers never do.
  - Sitemap / crawler change → `Needs access` (site admin). Never changed automatically.
  - Independent directory → `External handoff`. A request is sent; the directory is never marked updated.
  - Seeded connector failure (Marathahalli listing) → `Failed — ProManage follow-up`. A retry runs within the same approval scope.
  - Attempts are idempotent, so the same target/version is never applied twice.
- **Request changes / Decline** publish nothing. After Request changes, **See revised version** simulates ProManage's turnaround as a new version that needs fresh authorization.
- **No confirmed, controllable gap found** lists what was checked, with no invented work (e.g. Koramangala; accuracy issues whose sources already match).
- **Approval history** records every authorization, change request and decline, with version and scope.

### V2 — Measure (`/measure`)
- **What changed on your sources:** per-target publication results, labelled "Demo: simulated publication".
- After a published update, ProManage runs **one matched follow-up check** on the existing recheck engine. It is a new immutable wave with the same questions, centres and surface. Opening Measure before any approval shows **No approved changes to measure yet**: nothing is published or rechecked.
- **Two separate lenses:**
  - **Discoverability:** Whitefield mentioned in **3 of 5 → 5 of 5** matching searches. The counts come from the fixtures, plus a pilot-wide eligible n/N.
  - **Accuracy:** original vs follow-up answer, with an outcome of `No mismatch in latest sampled check`, `Incorrect statement still appears`, `Inconclusive` or `We cannot reliably compare these checks`.
- Unresolved items, a full timeline (check → diagnosis → authorization → publication → follow-up) and links to the report and evidence.
- No causal or guarantee language anywhere.

### Optional — Target a specific question (secondary, after the results)
- **Placement:** a "Want to focus on one particular AI question?" card below the standard results, with a **Target a specific question** button (centre + exact question + optional label → **Save visibility goal**).
- **Seeded goal:** "Whitefield Priority Question" links to the existing exact-question evidence: 0/1 baseline, 1/1 at follow-up 1. Related variants and accuracy checks are kept separate.
- **Arbitrary question:** shows **Awaiting first check — no demo sample for this question**. No result or fix is invented.
- **Lifecycle:** goals can be paused, archived and restored, and changing the question creates a new version with history kept.
- **Navigation:** a selected goal filters the three chapters and shows **Back to standard check**. A fresh visit defaults to the standard view.

## Files
- **New:**
  - Pages: `pages/brand/Detect.tsx`, `pages/brand/Improve.tsx`, `pages/brand/Measure.tsx`
  - Components and libraries: `components/goals.tsx`, `lib/publishing.ts`, `lib/plans.ts` (moved from `components/promanage.tsx`, which re-exports it)
  - Tests: `e2e/harness.mjs`, `e2e/v8-demo.e2e.mjs`
- **Changed:**
  - Data: `data/types.ts` (ProposalApproval, PublicationAttempt, PrioritySearchGoal, DemoChapter) and `data/seed.ts` (v8 prompt wording; Whitefield Montessori programme verified per PRD §4)
  - Store and logic: `store/AppStore.tsx` (openChapter, prepareImprovements, authorizeProposal, rejectProposal, reviseProposal, retryPublication, goals; additive persisted fields, no version bump), `lib/discovery.ts`, `lib/useDiscovery.ts`
  - Shell and routing: `components/layout/AppShell.tsx`, `PresenterPanel.tsx`, `App.tsx`
  - Shared UI and old test: `components/discovery.tsx` (mobile wrapping), `e2e/discovery.e2e.mjs` (updated for v7 fixtures)

## Preserved (still routed and tested)
- **Brand routes:** `/overview`, `/locations`, `/locations/:id/answers`, `/attention`, `/attention/:id`, `/attention/discovery/:id`, `/progress`, `/reports`, `/audits/:id`.
- **Internal ProManage workspace** (via Demo settings): `/issues` (accuracy + discoverability tabs), `/issues/:id`, `/issues/:id/sources`, `/discovery/:id`, `/tasks`, `/geo-readiness/:id` (all tabs incl. JSON-LD and content improvements), `/monitoring`, `/reports`, exports.

## Tests run
- `tsc -p tsconfig.app.json`: 0 errors.
- `eslint src e2e`: 0 errors.
- `npm run build`: passes. The chunk-size warning was already there.
- `npm run test:e2e`:
  - **v8 rehearsal: 86/86** (every scene in order, plus V2-first, decline, request changes → revision, partial failure → retry, refresh persistence, deep link/back, 19 legacy/internal routes). No console errors.
  - **Previous discoverability suite: 52/52.**
- **Phone width (390 px):** Detect, Improve (incl. technical appendix and post-approval) and Measure have no horizontal overflow.

## v8 scene checklist
| Scene | Status |
|---|---|
| 1 Detect landing, curated Discovery + Accuracy questions, 10-centre pilot | ✓ |
| 2 Run AI Visibility Check → progress → findings | ✓ |
| 3 Whitefield: separate unbranded non-mention + branded Saturday-tour finding | ✓ |
| 4 02 Improve unlocks V1; both proposals ready | ✓ |
| 5 Before/after + technical appendix (JSON-LD) | ✓ |
| 6 Approve & authorize → per-target simulated publication, follow-ups shown | ✓ |
| 7 03 Measure unlocks V2; separate Discovery n/N and Accuracy outcomes | ✓ |
| 8 Target a specific question → Awaiting first check | ✓ |
| 9 Back to standard check; everything retained after refresh | ✓ |

## Limitations and gaps
- **v6 didn't exist in this repo.** The v6 "Priority AI Search Questions" feature the PRD calls "preserved" wasn't in this repository, so it was built new here as the optional feature. Its lifecycle covers save, select, pause/archive/restore and versioning. Goal-scoped proposals reuse the standard proposals filtered to the goal's centre. There's no question-specific diagnosis beyond the seeded findings.
- **Seeded fixtures:** recheck outcomes come from deterministic fixture waves and don't depend on which changes were approved. The UI therefore states whether updates were recorded before a check and never claims causation.
- **Retry:** "ProManage follow-up: retry" is a simulated affordance exposed in the Brand view for the demo. In a real product it would be an internal ProManage action.
- **Rollback:** an `Undo / request rollback` action (PRD §6 step 5) isn't implemented. Published attempts are kept as history only.
- **Sensitive changes:** heightened review for sensitive changes isn't modelled separately. Crawler/security settings are never changed automatically (site-admin handoff).
- **Not deployed:** the hosted GitHub Pages site only updates when these changes are pushed to `main`.
