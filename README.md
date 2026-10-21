# ProManage · AI Visibility / GEO — Brand-first prototype

A clickable prototype of an **AI Visibility / GEO** capability inside ProManage *Insights & Analytics*, built for a PM hiring assignment. It has two demo roles over **one shared dataset**:

- **Brand** (default): a nontechnical BrightNest marketer who confirms facts, approves plans and tracks outcomes.
- **ProManage**: operators who investigate, prepare GEO assets, run tasks and monitor.

The demo brand, **BrightNest Preschools** (150 centres, 10 Bengaluru pilots), is fictional and **all data is simulated**.

Specs:
- [Brand-First UX Redesign Brief (current)](ProManage_GEO_Brand_First_UX_Redesign_Claude_Brief.md)
- [PRD v3.0](ProManage_GEO_Detect_to_Resolution_PRD_v3.md)
- [PRD v2.0](ProManage_AI_Visibility_Prototype_PRD_Updated.md)
- [PRD v1](ProManage_AI_Visibility_Prototype_PRD.md)

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build
```

State lives in `localStorage` (v7 schema; older saved state resets automatically).

**Presenter controls** (sliders icon in the top bar, or ⌘ . / Ctrl .):
- **Release:** MVP · V1 · V2
- **Role:** **Brand** · **ProManage**. Also available under *View as* in the avatar menu, labelled "Demo role".
- **Simulation labels:** off by default; turn on to label sampled answers and actions "Simulated".
- **Load pilot audit**, **Reset data**

Switching role or release never erases records.

## Two roles, one dataset

| | Brand (default) | ProManage |
|---|---|---|
| Sidebar | Overview · My Locations · Needs My Attention · Progress · Reports | Client Overview · Audit Operations · Investigations · Data Sources & Listings · GEO Readiness · Tasks & Publishing · Monitoring · Reports |
| Can | Request or run a check, confirm/correct/dispute business facts, request verification, approve / request changes / decline correction plans, record their own website update with evidence, mark resolved or keep monitoring, export summaries | Run assisted audits, configure prompts, investigate sources, draft correction plans, prepare JSON-LD / fact sheets, create and execute tasks, run rechecks, monitor |
| Cannot | See JSON-LD, schema, surfaces, cohort IDs or task internals; mark third-party changes complete | Approve business facts or correction plans for the Brand |

Technical deep links opened as Brand land on the matching Brand view:
- `/issues/:id` and `/issues/:id/sources` → `/attention/:id`
- `/tasks` and `/monitoring` → `/progress`
- `/geo-readiness/:id` → Business Information Updates
- `/listings/:id` → a "handled by ProManage" explanation

## Guided flow (both roles see the same records)

1. **Check the fact (Brand).** One question: *"Are the opening hours in your business record correct?"*
   - **Yes** confirms the discrepancy and sends it to ProManage.
   - **No** saves the corrected fact; if the AI answer then matches, the issue is closed as "not an issue".
   - **I'm not sure** asks the operations team, and nothing is counted as an error.
   - If the business record isn't verified yet, the Brand is asked to confirm the actual value first.
2. **ProManage investigates.** It appears in ProManage's Client requests queue. The source comparison sits on Investigations. ProManage either drafts a **correction plan** (auto-suggested from the source differences, with owners) or records *No source discrepancy found* / *Inconclusive*.
3. **Proposal (Brand).** *Suggested information updates*: why, what changes, where, who does it, what it can do, and what it can't guarantee. The Brand can **Approve**, **Request changes** (with a comment; returns to ProManage's queue) or **Decline** (with a reason).
4. **Execution.** Approval creates the tasks (website team / ProManage listing / external request) and approves the prepared GEO assets. The Brand's website team records their update with evidence. ProManage records listing changes and sent requests. External sites show **Correction requested**, never "updated".
5. **Source updates complete** → *Waiting for a follow-up AI check*.
6. **Follow-up (V2).** *Looks correct in the latest AI check* / *Still incorrect* (→ **Request further investigation**, which starts round 2 in ProManage's queue) / *Inconclusive*. The original evidence is never changed.

The Brand sees three independent statuses — **Your information · Information updates · Latest AI check** — plus a 5-step tracker. One CTA is shown per state, e.g. *Verify business information*, *Review proposed updates*, *Track update*, *Request further investigation*.

## 5-minute demo

1. As **Brand**, on `/overview`, click **Request first visibility check** → **Ask ProManage to set it up**.
2. As **ProManage**, Client Overview shows **Configure & run** → run the 10 × 8 audit.
3. Switch to **V1** and **Brand**. *What needs your attention* shows **HSR Layout — opening hours may be incorrect** → *Yes, these are correct* → Confirm.
4. As **ProManage**, open Investigations → HSR → **Draft correction plan** (website, search-readable info, directory request) → **Send to Brand for approval**.
5. As **Brand**, **Approve proposed updates**, then **Record website update**. As **ProManage**, mark the directory request sent.
6. Switch to **V2**. As **ProManage**, run a matched recheck on Monitoring.
7. As **Brand**:
   - HSR shows **Looks correct in the latest AI check** → **Mark as resolved**.
   - Indiranagar shows **Still incorrect** → **Request further investigation**.
   - Progress and Reports summarise everything.

## Brief use cases

| UC | Behaviour | ✅ |
|---|---|---|
| UC-01 HSR wrong hours, facts verified | confirm → investigate → plan → approve → website + directory → recheck "Looks correct" | ✅ |
| UC-02 Whitefield Saturday tours | modelled separately from opening hours (note on page, excluded from JSON-LD hours) | ✅ |
| UC-03 Unverified record (Bellandur phone, Electronic City hours) | "Please confirm the actual …"; no confirmed error until verified; AI match closes it | ✅ |
| UC-04 External directory | "Request a correction — owner ProManage"; Brand sees "Correction requested" | ✅ |
| UC-05 All sources correct (Jayanagar) | ProManage records "No source discrepancy"; Brand sees "accurate in the sources we checked — we'll keep monitoring" | ✅ |
| UC-06 Absent from discovery | "Discovery opportunities", neutral, n of N, never counted as an error | ✅ |
| UC-07 Update done, AI still wrong (Indiranagar) | "Correction requested" + "Still incorrect"; **Request further investigation** → ProManage queue | ✅ |
| UC-08 Inconclusive follow-up (Brookefield) | "Inconclusive — more checks needed", not "corrected" | ✅ (same logic; seeded) |
| UC-09 Request changes / decline | comment → ProManage queue → revise → resend; decline records the reason, nothing executed | ✅ |
| UC-10 Assisted onboarding | Brand request → ProManage queue → audit run completes the request → Brand results | ✅ |

## Route map

| Route | Screen | Release |
|---|---|---|
| `/overview` | Brand: Your AI Search Overview (attention → handled → 4 metrics → progress/past checks). ProManage: Client Overview + Client requests | MVP |
| **`/attention`, `/attention/:id`** | Brand: Needs My Attention; one-decision issue page with proposal, updates, tracker | MVP/V1 |
| **`/progress`** | Brand: Progress tracker + plain-language follow-up checks | V1/V2 |
| `/audits`, `/audits/new` | Audit list; wizard. CSM assisted mode + CSV import | MVP |
| `/audits/:id` (`/audits/demo-001` → first audit) | Results: discovery vs branded separate, filters, CSV, Print/PDF, methodology | MVP |
| `/locations`, `/locations/:id/answers` | Three-column evidence: prompts · exact answer + claims · verified record. **Review panel** with saved evidence, history, verification CTAs, discovery tags. V1: **Investigate sources / Assign verification**. V2: **Run matched recheck** + side-by-side | MVP |
| `/issues`, `/issues/:id` | Inbox; issue detail with **Factual issue / Source action / AI outcome** status, evidence, **Investigate sources**, dispositions | V1 |
| **`/issues/:id/sources`** | **Source comparison:** master record, official website, managed GBP, independent directory, AI answer; assessment, control type, last checked; recommended next steps | V1 |
| **`/listings/:locationId`** | Read-only managed-listing record (stand-in for Listing Management deep link); create listing update task | V1 |
| `/tasks`, `/tasks/:id` | Channel-specific source actions: owned website, managed listing, external request, business verification; evidence; approvals; audit trail | V1 |
| `/geo-readiness`, `/geo-readiness/:locationId` | Verified data (verify/reconfirm/approve) · JSON-LD · fact sheet · publication & checks | V1 |
| `/monitoring` | Awaiting-recheck queue, matched recheck, new-baseline handling, trends, critical findings, competitor co-mentions, Surface B, comparison export | V2 |
| `/reports` | Observed result / source action / hypothesis sections; persistent discrepancies; action timelines | MVP → V2 |

## PRD v3 use-case checklist

| Use case | Where to see it | Status |
|---|---|---|
| **UC-M1** Wrong opening hours confirmed with evidence | `/locations/hsr-layout/answers` (p7) | ✅ |
| **UC-M2** Missing mention = observation; *Worth monitoring / Not relevant* | any discovery prompt with "Not mentioned" (e.g. Marathahalli p1) | ✅ |
| **UC-M3** Unverified record → *Cannot evaluate* + **Request centre verification** → *Awaiting source-of-truth verification* | Bellandur p7 (phone), Electronic City p7 (hours) | ✅ |
| **UC-M4** CSM assisted audit, CSV preview, executive report; CSM can't certify facts | Sign in as CSM → `/audits/new` | ✅ |
| **UC-V1-1** Outdated official website → website task → GEO → approval → source updated → awaiting recheck | HSR Layout (primary demo) | ✅ |
| **UC-V1-2** Outdated managed GBP → **Open managed listing** (deep link) → listing update task | Marathahalli ("Temporarily closed" on listing) | ✅ |
| **UC-V1-3** Outdated independent directory → **Prepare correction request** → *Request sent — external correction pending* → evidence of change → awaiting recheck | Indiranagar (phone) | ✅ |
| **UC-V1-4** All known sources correct, AI still wrong → *No verified controllable-source discrepancy*; preserve evidence / provider feedback / monitor; *Unable to inspect* directory | Jayanagar (hours) | ✅ |
| **UC-V1-5** Possible entity confusion / unsupported service → *Needs verification* + verification task | Brookefield (address of Whitefield); Indiranagar "in-house pediatrician" | ✅ |
| **UC-V2-1** Matched recheck after source update; side-by-side; *No mismatch / Still observed / Inconclusive* | HSR (no mismatch), Indiranagar (still observed), Brookefield (inconclusive) | ✅ |
| **UC-V2-2** Repeated critical misinformation → deduplicated *Critical findings requiring review*, **Assign urgent verification**; unconfirmed ones need review first | Marathahalli "permanently closed", Indiranagar phone (once confirmed) | ✅ |
| **UC-V2-3** Discoverability tracked separately; competitor co-mentions (not market share); *Investigate content* flag on 0-mention centres | `/monitoring` trends | ✅ |
| **UC-V2-4** Verified facts revised → *Not comparable — new baseline required* → **Start new baseline** | Verify Electronic City hours, then recheck | ✅ |

## Status model (PRD §9)

- **Sampled observation** is immutable. A recheck creates a new observation and never edits the original.
- **Factual issue:** Potential → Needs business verification → Confirmed / Dismissed. Unverified records stay *Cannot evaluate* and are never counted as mismatches.
- **Source action (task):**
  - Website or listing: Assigned → In progress → Content prepared → Business approved → Source updated → **Awaiting AI recheck** → Closed.
  - External directory: … → *Request sent — external correction pending* → evidence of change → Awaiting AI recheck.
  - Verification: Assigned → In progress → Fact verified → Closed.
- **AI outcome:** Not rechecked → No mismatch in latest sample / Still observed / Inconclusive / New baseline required.
- **Issue disposition:** Close issue (after a recheck), Keep monitoring, or Start new investigation.

## What is simulated

- AI answers, citations, competitor names, website, listing and directory snapshots are all deterministic fixtures with `.example` URLs.
- "Source updated", "Request sent" and approvals only change in-app state. A completed website or listing task updates the **simulated snapshot**, never the AI answer or any real system.
- Listing Management is represented by a read-only record page; there's no GBP editor.
- Provider feedback is logged to activity only; there is no provider integration.
- The weekly schedule is a saved preference with no background job. Rechecks run on demand.
- Exports (CSV, comparison CSV, JSON-LD, HTML) are real browser downloads, labelled simulated in their header rows.

## Known limitations

- One sample per prompt on one surface. Surface B is illustrative only.
- Rechecks are deterministic waves: HSR and Jayanagar improve at Recheck 1, while Indiranagar's phone persists. Outcomes don't depend on task completion, which is deliberate because causation isn't established.
- Review decisions apply per observation; seeded observations have at most one flagged claim.
- Only two demo roles (Brand, ProManage). Centre managers (Priya Raman, Arjun Mehta) and the website team (Kavya Nair) are assignees, not selectable personas. The Brand records its own website team's update.
- The Brand can't run follow-up checks; ProManage runs them (as specified).
- *View detailed results* on the Brand results page shows the full technical table for authorized users.
- Simulation labels stay off by default, per your earlier instruction; the brief asks for them visible. Turn them on in presenter controls.
- Roles are a demo switch, not authentication. Persistence is per browser.
- The bundle is about 1 MB minified and not code-split.

## Files changed for the Brand-first redesign

**New:**
- `src/lib/brandStatus.ts` (derived Brand stage and the three dimensions)
- `src/components/brand.tsx`, `src/components/promanage.tsx`, `src/components/ClientRequests.tsx`
- `src/pages/brand/BrandOverview.tsx`, `BrandAttention.tsx`, `BrandProgress.tsx`, `BrandLocations.tsx`, `BrandAuditResults.tsx`, `BrandInfoUpdates.tsx`, `BrandReports.tsx`

**Extended:**
- `data/types.ts` (Role, Investigation, CorrectionPlan, CheckRequest), `data/seed.ts`
- `store/AppStore.tsx` (two roles, permissions, investigations/plans/check requests, plan approval creates tasks and approves assets)
- `App.tsx` (role-aware routes and redirects)
- `components/layout/AppShell.tsx`, `PresenterPanel.tsx`, `components/domain.tsx`
- `pages/Overview.tsx`, `Issues.tsx`, `NewAudit.tsx`, `Tasks.tsx`, `GeoReadiness.tsx`, `Audits.tsx`, `Locations.tsx`, `LocationAnswers.tsx`
- `index.css` (darker secondary text)

## Files changed for v3

**New:**
- `app/src/pages/IssueSources.tsx`
- `app/src/pages/ListingRecord.tsx`
- `app/src/lib/issueActions.ts`

**Extended:**
- `data/types.ts`, `data/seed.ts`, `data/answers.ts`, `data/issues.ts`
- `store/AppStore.tsx`
- `lib/metrics.ts`, `lib/aiStatus.ts`
- `components/domain.tsx`, `components/layout/AppShell.tsx`
- `App.tsx`
- `pages/LocationAnswers.tsx`, `Issues.tsx`, `Tasks.tsx`, `GeoReadiness.tsx`, `Monitoring.tsx`, `Reports.tsx`

## Screenshots

[`docs/screenshots/`](docs/screenshots). The Brand-first screens are 17–20 (HSR one-question review, Brand Overview, Whitefield progress, Progress). The v3 additions are 13–16: the HSR review with saved evidence, the HSR source comparison, the HSR recheck closed, and Indiranagar "Still observed".
