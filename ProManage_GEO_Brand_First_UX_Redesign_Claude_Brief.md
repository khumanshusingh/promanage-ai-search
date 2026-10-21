# ProManage AI Visibility / GEO — Brand-First UX Redesign Brief

**Version:** 1.0  
**Audience:** Claude Code / engineering implementation agent  
**Purpose:** Redesign the **existing, working ProManage AI Visibility prototype** for nontechnical enterprise Brand users while retaining full operational tooling for internal ProManage staff.  
**Source:** Review of the supplied screenshots (Overview, Audit Results, Location Answer Evidence, Issues, Source Comparison, GEO Readiness, Monitoring and Rechecks) and the current Detect → Confirm → Investigate → Correct → Recheck product journey.  
**Status:** UX implementation specification for a **fictional interactive hiring-assignment prototype**, not a production launch plan.

> **MANDATORY FOR CLAUDE CODE:** Inspect the current repository and running app first. **Modify the existing implementation; do not rebuild it.** Preserve existing screens, state, seeded demo data, audit logic, feature gates, routes, exports and functional actions wherever compatible. Keep the same underlying data model for both user roles. Implement all P0 changes before P1/P2. Do not replace actual working interactions with static mockups. Explicitly report which changes are implemented and which remain incomplete.

---

## 1. Product design objective

### The design problem

The app currently provides rich evidence, source comparison, schema tooling, task management and recheck analytics. This is good for a technical operator but places too much cognitive and operational burden on a **Brand employee** who may know nothing about GEO, JSON-LD, LLM citations, crawler behavior or synthetic prompt monitoring.

The redesign must separate **business decisions** from **technical execution**:

- **Brand:** “What is wrong with my store's information? What do you need me to confirm or approve? What is ProManage doing? Did the latest check look better?”
- **ProManage:** “What did the AI answer say? Which sources disagree? What can we update? How do we prepare, assign, validate and track technical corrections?”

### Desired product promise

**Find problematic AI descriptions of your locations → Verify the actual business facts → Approve a recommended correction → Track execution → Review subsequent AI checks.**

ProManage handles source investigation, technical GEO asset generation, monitoring configuration and technical handoffs. The Brand retains ownership of authoritative business facts and approvals.

### Non-negotiable truthfulness

1. An absent brand in one answer is a **sampled non-mention**, not proof of invisibility or an AI error.
2. A mismatch is **potential** until authoritative business data is verified and a reviewer confirms it.
3. A source discrepancy **does not prove** that the source caused the AI's answer, particularly if the answer has no citation.
4. Completing a source update **does not mean** the AI answer has been corrected.
5. A later answer without the mismatch is **an observed improvement in that sample, not causal proof or guaranteed future correctness**.
6. All existing fixtures and results must continue to be visibly labeled **Demo / Simulated**. Never imply real consumer ChatGPT traffic, live integrations, real publishing or actual revenue lift.

---

## 2. Exactly two top-level roles

Replace any **Marketing / Regional / CSM** role selector with the following **two choices only**:

| Role | Display label | What this role is |
|---|---|---|
| Customer organization | **Brand** (default) | Enterprise marketing/operations people working for BrightNest; nontechnical by design |
| Service organization | **ProManage** | Internal customer success, account management, technical and operations staff assisting a client |

Keep a small badge or menu label **“Demo role”** so this switch is not confused with real authentication. Keep the current account selector for BrightNest, and persist the selection across navigation.

### Brand permissions and duties

**Can:**
- View their organization's summarized results and sampled answer evidence.
- Browse their locations and important flagged observations.
- Confirm, correct or dispute their own authoritative business facts.
- Submit a verification request when uncertain.
- Review and approve/reject/ask changes to a proposed correction plan.
- Track status, owner, dates and latest observed results.
- Request an audit / run an available simplified audit, view reports and export business-friendly summaries.

**Cannot:**
- Directly edit technical generated markup, JSON-LD or crawler configurations.
- Directly change third-party AI responses or claim such changes occurred.
- Configure raw AI surfaces, proxy identifiers, synthetic sampling parameters, internal parsing rules or cron jobs.
- Mark third-party correction requests or source publication as successfully completed without evidence.

### ProManage permissions and duties

**Can:**
- Operate assisted audits and configure prompts, sampling and supported measurement surfaces.
- Investigate citations and compare external/owned information sources.
- Prepare proposed corrections, evidence and customer-facing explanations.
- Generate and validate structured-data assets, fact sheets, source updates and technical handoff tasks.
- Coordinate approved work on owned/managed sources, record implementation evidence.
- Configure simulated monitoring and inspect raw results, trends, deduplicated alerts, exceptions and reliability details.

**Cannot:**
- Independently approve factual changes on behalf of the Brand.
- Claim the actual AI platform was changed, that a correction was causally successful, or that third-party data was updated when it wasn't.

**Underlying application:** Do not create two separate apps or duplicate datasets. Both role views show the same organizations, observations, issues, corrections and rechecks, with different navigation, wording and permitted actions.

---

## 3. Navigation redesign

### Brand sidebar — keep it very simple

1. **Overview** — “What requires my attention?”
2. **My Locations** — find a branch and see plain-language AI information findings.
3. **Needs My Attention** — business-fact verification and approval queue.
4. **Progress** — changes being handled, source update status, latest AI checks.
5. **Reports** — readable executive summaries and exports.

Do **not** show separate top-level Brand entries for `Issues`, `Tasks`, `GEO Readiness`, `Source Comparison`, `Structured Data`, `AI-readable Fact Sheet`, `Monitoring Surface A/B` or technical configurations. Their capabilities should remain accessible through contextual summaries and actions, or in the ProManage role.

The Brand may access the audit history via **Overview → Past checks** or **Reports → Audit history**, rather than having to learn an audit operations section.

### ProManage sidebar — operational view

1. **Client Overview**
2. **Audit Operations**
3. **Investigations**
4. **Data Sources** / **Listings**
5. **GEO Readiness**
6. **Tasks & Publishing**
7. **Monitoring**
8. **Reports**

The current detailed Issues, Tasks, GEO Readiness, Audit and Monitoring screens should be **retained and adapted**, not deleted.

### Routing strategy

Inspect actual routes before editing. Reuse existing internal route components such as `/overview`, `/audits`, `/audits/new`, `/audits/:id`, `/locations/:id/answers`, `/issues/:id`, `/tasks`, `/monitoring`, `/reports` and the existing GEO Readiness route where present. Add friendly Brand aliases/wrappers only if necessary (e.g. `/attention`, `/progress`).

- Role-aware navigation hides irrelevant destinations.
- A Brand opening a deep technical link should see an appropriate simplified customer summary or an access-controlled explanation, **not an empty or broken page**.
- Back links must return to the correct role's entry point.
- Keep MVP/V1/V2 demo gating and persistent state. In normal Brand experience, **do not put engineering release names in the primary information architecture**.
- Future-release locked pages in demo mode should explain availability, not show a dead “Notify me when available” button unless it genuinely performs an available action.

---

## 4. Brand Overview redesign (existing `01-overview-first-run.jpg`)

### Current problem

An empty four-metric dashboard with technical KPI labels and “Create audit” makes customers feel they need to configure the system before receiving value. The meaningful questions — **what's wrong, what needs approval, what is being worked on** — are less visible.

### New first-run state

**Title:** `Your AI Search Overview`  
**Subtitle:** `See how your locations appear in sampled AI answers and what needs your attention.`  
**Primary CTA:** `Request first visibility check`  
**Secondary CTA:** `How this works`  
**Supporting copy:** `ProManage can help set up the first check using your existing location information.`

In demo mode, the CTA should launch the working simplified audit/onboarding flow or create a simulated request visible to ProManage. No fake actions.

### New populated Overview hierarchy

**First panel — Needs your attention:**
- Fact-verification requests waiting for the Brand.
- Correction proposals waiting for approval.
- Urgent wrong address/contact/service issues, only after suitable review.
- Each row: location, issue in plain language, recommended action, due/priority if assigned, one CTA (`Review details`).

**Second panel — What's being handled:**
- Source issues being investigated by ProManage.
- Approved corrections in progress.
- Corrections published/recorded and awaiting a comparable AI recheck.

**Third panel — Small number of understandable metrics:**
- `Locations checked`: pilot scope, e.g. `10 of 150`.
- `Information to review`: flagged/unverified issues, clearly not automatically confirmed errors.
- `Confirmed information problems`: only human-confirmed discrepancies.
- `How often your locations appeared`: sampled discovery mention rate, with numerator/denominator and scope.

**Fourth panel — Recent progress:**
- “Information update completed: HSR Layout website.”
- “AI follow-up check: latest sample no longer showed the incorrect hours.”
- “Issue still observed: Indiranagar phone number.”

**Presentation rules:**
- Action items above charts.
- Avoid large empty charts before a baseline exists.
- Put sampling/methodology details under `How measured` or a tooltip.
- No claims of actual Google/ChatGPT user traffic or sales conversion.
- All values calculated from actual seeded fixtures/state, **not invented hardcoded totals**.

### Suggested visual hierarchy

```text
Your AI Search Overview                  [Brand: BrightNest] [Demo]
What needs your attention                [View all]
  • Verify HSR Layout opening hours                    [Review]
  • Approve Whitefield Saturday-tour correction       [Review]

What's being handled
  • Website information update — In progress
  • Latest AI recheck — Waiting

Locations checked | Facts to review | Confirmed issues | Sampled appearances

Recent progress and past checks
```

---

## 5. Replace technical audit results with a readable findings view

**Reference:** `05-audit-results-v2.jpg`.

### Current issue

Metrics like `36% (18 of 50)`, `47 claims`, `32 potential omissions`, `6 factual mismatches`, and `5 unverifiable claims` appear together. These are useful but require an analytical interpretation that is unrealistic for many Brand managers.

### Brand-facing redesign

**Page title:** `Your AI Search Check`  
**Subtitle:** `Results from selected locations and questions — not all customer AI conversations.`

Top callouts:
- `Locations checked`.
- `Information that may be incorrect` (flagged, unconfirmed).
- `Information you confirmed as incorrect`.
- `Locations appearing in sampled discovery answers`.

Separate findings into **two distinctly labeled areas**:

**A. Information accuracy — potential business-information issues**
- Wrong contact number.
- Wrong address.
- Wrong hours.
- Incorrect service, facility or availability claims.
- Unverifiable claims requiring investigation.

**B. Discovery opportunities — visibility observations, not automatic errors**
- Location not mentioned in selected unbranded discovery prompts.
- Location mentioned in some but not other sampled prompts.
- Reasons unknown unless independently investigated; never label all non-mentions red.

**Location rows:** `Location | What we found | Your next action | Status`.

Replace dense debug-style issue counts with useful task language. Keep raw audit table/filter/export in ProManage, and behind an optional `View detailed results` disclosure for authorized users.

**Empty and partial states:**
- No audit: `No AI visibility check has been run yet.`
- Incomplete records: `We need to verify some store details before checking their accuracy.`
- Unsupported platform: `This AI source isn't included in the current check.`

---

## 6. Redesign Location / AI Answer screen into a one-decision flow

**References:** `03-whitefield-answer-evidence.jpg`, `13-hsr-answer-review-confirmed.jpg`.

### Current issue

The three-column evidence UI is technically useful, but displays prompt metadata, extraction rules, hypotheses, timestamps, source-owner data and duplicated information before the Brand can take the obvious next action.

### Brand view — default layout

**Header:** `BrightNest HSR Layout — Information needs checking`  
**Explanation:** `An AI answer gives different opening hours from the information your team has approved.`

**Card 1: Side-by-side factual comparison**

| AI answer said | Your business record says |
|---|---|
| Mon–Sat, 9 AM–6 PM | Mon–Fri, 8:30 AM–6:30 PM |

**Card 2: Exactly one main question**

`Are the hours in your business record correct?`

Options:
- `Yes, these are correct` → Confirm source-of-truth, submit for ProManage investigation.
- `No, our business information needs changing` → Enter corrected facts, require appropriate Brand approval/verification.
- `I'm not sure` → Request verification from internal operations team; no definitive mismatch yet.

**Primary CTA:** `Continue` or a state-specific version (`Confirm hours`, `Request verification`).

**Collapsible section:** `See original AI answer & evidence` — retain full answer, prompt, observed timestamp, surface label, citations when present and uncertainty disclaimer.

### ProManage view

Retain the complete source comparison, rule evaluation, answer text, reviewer notes, hypotheses and technical evidence. Keep technical tools in the ProManage role.

### Important specifics

- The whitefield Saturday-tour example is an **appointment/service fact** and must never be merged with the centre's normal business opening hours.
- If there is **no citation**, show `This sampled answer did not cite a source` and **do not invent source attribution**.
- If approved business facts are unverified, prompt for verification rather than showing `Confirmed mismatch`.
- Preserve ability to mark `Not an issue` (with optional reason) and `Needs more information`.
- A Brand confirmation of a verified discrepancy creates/updates the same underlying Issue object; do not create disconnected duplicate tasks.

---

## 7. P0: Turn confirmed issues into guided, role-aware next steps

**References:** `06-issue-with-source-surfaces.jpg`, `14-hsr-source-comparison.jpg`, `15-hsr-issue-recheck-closed.jpg`, `16-indiranagar-still-observed.jpg`.

### Brand journey — should feel linear

**Stage 1 — Check the fact**
- Brand sees the discrepancy and confirms the correct fact or requests verification.
- Status: `Waiting for your verification` → `Information confirmed`.

**Stage 2 — ProManage investigates**
- Automatically route confirmed discrepancies to ProManage investigation queue.
- Brand sees: `ProManage is checking where this information may be outdated.`
- ProManage sees raw source comparisons and investigation tasks.

**Stage 3 — Proposal for Brand approval**
- ProManage prepares clear action plan in plain language.
- Brand sees a summary of **what would change**, **where**, **who will do it**, and **what cannot be guaranteed**.
- Brand can `Approve plan`, `Request changes`, or `Decline`.

**Stage 4 — Execution by the appropriate owner**
- ProManage coordinates technical handoff and updates managed sources only when authorized and feasible.
- Brand's website team may own publishing to their website.
- Independent directories require a request to the external directory owner; do not fake direct control.

**Stage 5 — Source changes complete**
- Brand sees `Information update completed — waiting for an AI follow-up check`.
- Do **not** say `ChatGPT corrected`.

**Stage 6 — Follow-up AI check**
- Brand sees `Looks correct in latest sampled check`, `Still incorrect in latest sampled check`, or `Inconclusive — more checks needed`.
- If error persists, CTA `Request another investigation` (ProManage queue) or `Keep monitoring`.

### Brand correction proposal design

```text
Suggested information updates — BrightNest HSR Layout

Why we're recommending this:
An AI answer gave the wrong opening hours. We found inconsistent
hours on your official website and an independent directory.

Recommended updates
 ✓ Update the official centre page — Owner: BrightNest website team
 ✓ Request a correction from the independent directory — Owner: ProManage
 ✓ Prepare search-readable store information — Owner: ProManage

What this can do: Make published information more consistent.
What it can't guarantee: That an AI assistant will change its answer.

[Approve proposed updates]  [Request changes]  [Decline]
```

### One CTA per state

| Current Brand state | Main CTA |
|---|---|
| Potential issue, facts unverified | `Verify business information` |
| Business facts verified; investigation not started | `Send to ProManage for review` |
| Investigation in progress | `View progress` |
| Proposal ready | `Review proposed updates` |
| Plan approved, source update pending | `Track update` |
| Source updated, no recheck | `View follow-up check status` |
| Latest AI check still incorrect | `Request further investigation` |
| Latest AI check no mismatch | `View latest evidence` |

Avoid presenting `Open GEO Readiness`, `Create task`, `Investigate sources`, and `Mark as not-issue` as four equal primary buttons on every screen.

---

## 8. P0: GEO Readiness must be ProManage-led

**References:** `07-geo-verified-facts.jpg`, `08-geo-jsonld.jpg`, `09-geo-fact-sheet.jpg`, `10-geo-publication.jpg`.

### Why

The existing screens include `JSON-LD`, schema.org validation, source content readiness, markup completeness, AI fact sheets, export instructions and publication mechanics. This is not a reasonable default job for a Brand marketer.

### Brand-facing surface: **Business Information Updates**

Do not put a `GEO Readiness` destination in the Brand sidebar. From a flagged issue or location, Brand can access **Business Information Updates** with:

1. **Verified facts** — simple business fields, last confirmed by and whether confirmation is required.
2. **Proposed corrections** — human-readable before/after changes.
3. **Approvals** — `Approve`, `Request changes`, `Decline`.
4. **Progress** — investigation, preparation, publishing ownership, latest AI check.

No raw JSON, machine-readable markup, schema types, crawler checks or deployment settings in the default Brand interface. A read-only `What was changed?` summary may show human-readable details.

### ProManage-facing surface: **GEO Readiness Studio**

Preserve/extend:
- Verified location data, field-level verification and provenance.
- Source discrepancy analysis and source ownership.
- Generated JSON-LD preview/validation and safe copy/export.
- AI-readable fact-sheet generation and preview.
- Technical readiness checks and export evidence.
- Publication task creation, ownership and approval gate.
- Explicit states for `Prepared`, `Approved`, `Exported`, `Implementation pending`, `Source update confirmed`, `Awaiting AI recheck`.

### Publication and approval safety

- **Only Brand** can approve authoritative business facts and approve the correction plan.
- **ProManage** can draft, validate and execute only permitted/simulated implementation steps.
- Any `Copy JSON-LD`, `Download`, or `Generate fact sheet` action must perform its advertised function; don't create dead buttons.
- In the prototype, no real publishing to BrightNest websites, Google Business Profile, search engines or third parties. All write actions must be clearly shown as `Simulated`.
- Never imply that schema validation equals AI-search visibility improvement.

---

## 9. P1: Unified Brand “Progress” tracker

**References:** `10-geo-publication.jpg`, `15-hsr-issue-recheck-closed.jpg`, `16-indiranagar-still-observed.jpg`.

Make **Progress** the single source of understandable status for each issue. It is an aggregation of existing Issue, Task, Approval, Publication and Recheck data — not a new disconnected status system.

### Recommended Brand progress model

1. `Information confirmed` (Brand).
2. `Sources investigated` (ProManage).
3. `Plan approved` (Brand).
4. `Information updates completed` (responsible owner; evidence recorded).
5. `Latest AI check reviewed` (ProManage analysis visible to Brand).

Some steps may be skipped when no correction is needed; show `Not needed` with a reason rather than blocking completion.

### Outcome is separate from process

Keep three independent dimensions in data and UI:

| Dimension | Examples |
|---|---|
| **Fact verification** | Needs verification / Verified / Disputed |
| **Source correction** | Not started / In progress / Completed / Not controllable |
| **AI observation** | Not rechecked / Still observed / No mismatch in latest sample / Inconclusive |

Do **not** close an issue automatically because a task was completed. Do **not** change old AI evidence after a recheck. Preserve original and subsequent answer snapshots.

### Example

For the HSR Layout hours issue:
- `Website update completed` is the source task status.
- `Latest sampled AI answer no longer shows the old hours` is an observation.
- `Causation not established` is a small explanatory note.

For the Indiranagar phone mismatch:
- `Still incorrect in latest sample` remains actionable.
- Primary CTA: `Request further investigation`.

---

## 10. P1: Plain-language Monitoring and reporting for Brand

**References:** `04-coming-soon-monitoring.jpg`, `11-monitoring-surface-b.jpg`, `12-monitoring-surface-a.jpg`.

### Brand monitoring screen

**Title:** `How your AI information is changing`  
**Subtitle:** `Review comparable follow-up checks for your selected locations.`

Show:
- Locations checked and date.
- Issues no longer observed in the **latest sampled answer**.
- Issues still observed.
- Locations needing review.
- Simple trend of sampled mentions **with denominator and an accessible “How measured” explanation**.
- Latest progress entries and a clear CTA to review outstanding issues.

Hide from normal Brand view:
- Surface A/Surface B terminology.
- Proxy labels and sampling implementation details.
- Raw cohort IDs, rules versions and technical evaluation labels.
- Cron schedules, query-generation settings, parser outputs.
- Technical source cards used only by ProManage.

If multiple platforms are truly simulated, show a plainly named supported surface as `Demo AI search check — Source A` and mark the comparison `Conceptual, not a live integration`. Do not relabel an unknown simulated proxy as an actual consumer ChatGPT screen.

### ProManage monitoring screen

Keep the existing detailed matched-cohort comparison, surface separation, operational monitoring controls, alert deduplication and technical diagnostics. Only compare repeated samples with matching settings; never aggregate mismatched tests into a misleading trend.

### Brand reporting

A concise executive report should answer:
1. What locations/questions did we check?
2. What information needs Brand verification?
3. Which confirmed issues are being resolved and by whom?
4. What source updates were completed?
5. What did the latest comparable AI samples show?

Keep one-click CSV/print export where already working. Render customer language in exported summaries; optionally attach technical evidence for ProManage internal use.

---

## 11. UI wording and status language — precise replacement dictionary

| Old / technical label | Brand-facing label | Notes |
|---|---|---|
| `AI Visibility` | `AI Visibility` | Keep product name; explain in subtitle |
| `Create audit` | `Run visibility check` or `Request a check` | Depends on whether Brand can self-serve this flow |
| `Sampled discovery mention rate` | `How often your locations appeared` | Always show numerator / denominator / sampling scope |
| `Claim conflicts with verified record` | `Information may be incorrect` | Before manual confirmation |
| `Confirmed factual mismatch` | `Confirmed incorrect information` | Only after authoritative verification |
| `Potential omissions` | `Not mentioned in selected searches` | Not an error by default |
| `Source comparison` | `Where information may be outdated` | Findings can be uncertain |
| `Possible explanations / hypothesized cause` | `What ProManage is investigating` | Don't imply proved causality |
| `GEO Readiness` | `Business Information Updates` | Brand; keep GEO Readiness in ProManage |
| `JSON-LD / schema validated` | `Technical information prepared` | Brand receives summary only |
| `Fact sheet` | `Verified store information` | Brand-facing description |
| `Publication checklist` | `Update progress` | Separate preparation from live implementation |
| `Source action closed` | `Information update completed` | Only with implementation evidence |
| `Awaiting AI recheck` | `Waiting for a follow-up AI check` | Never imply guaranteed correction |
| `No mismatch in latest sample` | `Looks correct in the latest AI check` | Add “in this sample” disclosure |
| `Still observed` | `Still incorrect in the latest AI check` | If verified discrepancy persists |
| `Surface A / Surface B` | `AI check source` | Technical detail hidden or in info tooltip |
| `Matched sample cohort` | `Comparable follow-up check` | Explain same questions/locations where needed |
| `Rule v1 / parser confidence` | `System check — reviewed by ProManage` | Don't fabricate certainty |
| `Issues` | `Needs My Attention` | Brand queue includes facts and approvals |
| `Tasks` | `Progress` | Brand sees outcomes; ProManage sees task controls |

### Tone rules

- Prefer verbs customers recognize: `Review`, `Confirm`, `Approve`, `Request help`, `Track`, `See latest check`.
- Avoid technical jargon, excessive reassurance, jargon-heavy tooltips or long compliance disclaimers in primary cards.
- Keep important limits in a short, honest secondary explanation: `These findings come from selected AI searches. AI responses can vary.`
- Never use `Fixed in ChatGPT`, `100% GEO optimized`, `Guaranteed ranking`, `AI error eliminated`, or `Revenue recovered`.

---

## 12. Visual system and interaction polish

Retain the current ProManage-inspired light, professional SaaS design (white/light-grey content canvas, teal/blue accents, quiet borders and status colors). Do not replace the design with a flashy landing page, heavy gradients or a dark enterprise theme.

### Typography and density

- Important labels/body text should be comfortably readable in the actual application; avoid relying on very pale 11px-style microcopy.
- Strengthen contrast on light grey descriptions and small labels.
- Keep primary section headings short and descriptive.
- Use one clear primary action per page/state, plus secondary text links.
- Use table rows with enough vertical spacing for scanning without wasting excessive screen space.
- Where information is dense, start with summaries and reveal details in accordions, drawers or the ProManage role.

### Components

- Consistent cards, badges, timestamps, tables and confirmation dialogs across roles.
- Red only for confirmed high-risk errors; amber for needs-review; neutral for sampled non-mentions and unknown status; green for verified/completed.
- Distinguish color states with icons/labels, not color alone.
- Accessible focus states and keyboard navigation.
- Confirm modals for consequential Brand approvals, rejections and source-change authorizations.
- Loading, no-data, error, partial-data, permission-denied and empty-results states should be designed intentionally.
- Show evidence timestamps and `Simulated` disclosure near actual AI answer evidence, not only as one global footer.
- Responsive enough for tablets; desktop remains primary.

### Avoid unnecessary duplication

Do not replicate full AI answers, source lists and same KPI across multiple Brand screens when a summary plus expandable evidence link would suffice. Keep technical evidence available through the underlying record.

---

## 13. Detailed end-to-end use cases and expected outcomes

Use these for both implementation and testing. **All examples are fictional/simulated.**

### UC-01: HSR Layout — wrong opening hours, Brand facts already verified

1. Audit detects response `Mon–Sat 9 AM–6 PM` versus BrightNest approved record `Mon–Fri 8:30 AM–6:30 PM`.
2. Brand opens `Needs My Attention`, chooses HSR Layout, reads plain-language comparison.
3. Brand confirms approved record is correct.
4. ProManage investigation shows the official website and third-party directory may contain old information; any asserted source contribution remains a hypothesis unless evidenced.
5. ProManage proposes website correction and optional external directory request.
6. Brand approves plan.
7. Appropriate source owners record completion of actions; Brand tracks progress.
8. V2 recheck shows `Looks correct in latest AI check` or `Still incorrect` based on seeded result; original sample remains unchanged.

**Acceptance:** The user can identify the next step at every point; Brand never sees raw JSON-LD and never performs technical publishing.

### UC-02: Whitefield — incorrect Saturday tour availability

1. AI sample says `No Saturday tours`.
2. Approved BrightNest record says `Saturday tours 10 AM–1 PM`.
3. Brand confirms centre policy.
4. ProManage reviews site copy and listing content; prepares human-readable correction proposal.
5. Brand approves the plan; website team implements it.
6. Latest AI recheck is recorded without asserting causation.

**Acceptance:** Saturday tours are correctly modeled separately from ordinary centre operating hours.

### UC-03: Source data unverified

1. AI answer appears to conflict with an internal field marked `Needs verification`.
2. Brand sees `Please confirm the actual information` rather than `Confirmed incorrect AI answer`.
3. Brand requests operations confirmation or edits the proposed record for approval.
4. No confirmed mismatch is counted until verified and reviewed.

**Acceptance:** No false confirmed-error counts or auto-generated public correction.

### UC-04: External directory wrong; Brand cannot edit it directly

1. ProManage detects conflicting information at a non-owned directory.
2. Shows `External website — request a correction` and identified site/contact if known.
3. ProManage prepares/sends only a **simulated** request and records status.
4. Brand sees `Correction requested` rather than `Information updated` until completion evidence exists.

**Acceptance:** No implication of third-party write access.

### UC-05: All visible sources correct; AI still wrong

1. Verified records and available source pages match.
2. AI sample still states a wrong phone number or service claim.
3. ProManage records `No confirmed source discrepancy found`; unknown retrieval/generation cause.
4. Brand sees `Information is accurate in the sources we checked. We'll continue monitoring this AI answer.`
5. Recheck and follow-up remain possible; no manufactured fix.

**Acceptance:** Correct handling of a problem outside direct ProManage control.

### UC-06: Store absent from discovery results

1. A relevant unbranded prompt does not mention BrightNest.
2. Brand sees `Not mentioned in this selected AI answer`, grouped as a **discovery opportunity**, not confirmed misinformation.
3. ProManage may investigate information gaps, but any suggested improvement is a hypothesis.
4. Reporting uses sampled mention rate with denominator, never implied market share or real-user reach.

**Acceptance:** Non-mentions are not counted as confirmed factual mismatches.

### UC-07: Correction completed but AI error persists

1. Approved website update is recorded complete.
2. Recheck still shows the incorrect information.
3. Brand sees both independently: `Website update completed` and `Still incorrect in latest AI check`.
4. CTA `Request further investigation` routes back to ProManage with both snapshots.

**Acceptance:** No premature issue closure or fake success.

### UC-08: Follow-up answer differs, but evidence is inconclusive

1. A subsequent response omits the disputed fact or changes its wording without stating verified hours.
2. Label `Inconclusive`, not `Corrected`.
3. Keep monitoring/inspection available.

**Acceptance:** No unsupported accuracy improvement claim.

### UC-09: Brand requests plan changes / rejects proposal

1. ProManage submits a correction proposal.
2. Brand can `Request changes` with a comment or `Decline` with a reason.
3. ProManage sees returned work in queue; status updates on both role views.
4. No publication or implementation marked complete from a rejected plan.

**Acceptance:** Approvals are not decorative; state updates must persist.

### UC-10: Internal ProManage-assisted onboarding

1. Brand has not run an audit.
2. They click `Request first visibility check`.
3. ProManage sees an onboarding request and can configure existing audit tooling.
4. A simulated audit is run and becomes visible in Brand `Overview`/`Reports`.

**Acceptance:** The first-run experience works without requiring Brand to understand prompt configuration or APIs.

---

## 14. Release compatibility and scope control

The application is a demonstration of **MVP → V1 → V2** in one codebase. Keep feature gates accurate:

| Release | Brand experience | ProManage experience |
|---|---|---|
| **MVP (Weeks 1–4)** | Request/run basic audit, inspect results, verify business facts, export summary | Configure and run audits, inspect results, help verify evidence |
| **V1 (Weeks 5–8)** | Review corrections, approve plans, see progress | Investigate sources, create/update tasks, prepare GEO assets, coordinate authorized corrections |
| **V2 (Weeks 9–12)** | See comparable rechecks, understandable monitoring and progress reports | Configure rechecks, inspect matched samples and operational details |

- Do not pretend future gated features already exist in earlier demo modes.
- In Brand mode, **hide technical navigation in every phase**.
- In ProManage mode, surface the technical operations that belong to the selected phase.
- Reuse existing simulated seeded audit data, including BrightNest's 150 fictional centres and pilot locations.
- Do not broaden into live third-party API automation, real publishing or enterprise SSO/authentication work; this is a local interactive prototype.

---

## 15. Data, state and permissions safeguards

**Keep the existing underlying entities where possible** (`Organization`, `Location`, `Audit`, `Observation`, `Issue`, `Task`, `Recheck`, verified facts, source snapshots, publishing artifacts, approvals). Add fields only where necessary, not duplicate parallel state.

Minimum logical fields to enforce:

- `role: 'brand' | 'promanage'` (demo view state, not real auth).
- `factVerificationStatus: needs_review | verified | disputed`.
- `issueReviewStatus: potential | confirmed | not_an_issue | needs_information`.
- `sourceInvestigationStatus: not_started | in_progress | completed | inconclusive`.
- `correctionPlanStatus: draft | awaiting_brand_approval | approved | changes_requested | declined`.
- `sourceImplementationStatus: not_started | in_progress | completed | not_controllable`.
- `aiRecheckStatus: not_run | still_observed | no_mismatch_in_latest_sample | inconclusive`.

Use a **derived Brand summary** instead of inventing a new conflicting overall `status` field. A task can be completed while an AI issue remains active.

**Rules:**
- A ProManage user can draft but cannot set `correctionPlanStatus = approved` as the Brand.
- No simulated “source updated” record without an explicit authorized action/evidence event.
- Every decision should be timestamped and attributed to a demo user role.
- All counts and charts should recalculate from fixture/state records.
- The role switch must not erase audits, issue review, approvals, source updates or rechecks.
- Previously sampled answers are immutable historical evidence.
- Existing export/download and reset-demo behavior must remain functional.

---

## 16. Prioritized implementation plan for Claude Code

### P0 — Must implement first

- [ ] Inspect repo and map existing files/routes/components/state to requested changes.
- [ ] Commit/back up the current working app before making changes, if repository permissions allow.
- [ ] Replace role selector with **Brand (default)** and **ProManage**.
- [ ] Implement role-aware sidebar/routes/actions using one shared dataset.
- [ ] Redesign Brand Overview around attention, approvals and progress.
- [ ] Redesign Brand location/answer issue review into a simple business-fact verification question.
- [ ] Implement guided Brand → ProManage investigation → Brand approval → action progress flow.
- [ ] Keep JSON-LD, schema, fact-sheet and publishing mechanics out of Brand UI; available in ProManage.
- [ ] Separate business fact, source correction and AI recheck statuses.

### P1 — Next highest impact

- [ ] Brand-facing correction-proposal screen with Approve / Request changes / Decline.
- [ ] Unified Brand `Progress` view aggregating existing tasks, sources and rechecks.
- [ ] Friendly audit-results summary splitting information accuracy vs discovery opportunities.
- [ ] Plain-language monitoring with accurate matched rechecks and denominators.
- [ ] Brand executive reports and first-run onboarding/request-check experience.
- [ ] Proper uncertain/no-citation/unverified/continued-error states.

### P2 — Polish

- [ ] Typography/contrast improvements and clearer table density.
- [ ] Progressive-disclosure panels for original AI answers and technical evidence.
- [ ] Empty/loading/error states, action toasts, confirm dialogs, mobile/tablet usability.
- [ ] Add tooltips/“How measured” explanations only where needed.
- [ ] Maintain consistent buttons, colors, labels and activity history across screens.

**No unnecessary features.** Prioritize understandable end-to-end behavior over visual decoration or additional dashboards.

---

## 17. Acceptance tests — run manually or automate in browser

### AT-01 — Role simplification
- [ ] Only **Brand** and **ProManage** appear in the role selector.
- [ ] Brand is the default on a fresh demo session.
- [ ] Brand cannot access technical JSON-LD editing or raw monitoring settings.
- [ ] ProManage can still access existing technical screens.
- [ ] Switching roles preserves demo records.

### AT-02 — First run
- [ ] Brand Overview has a meaningful no-audit state and working first-check CTA.
- [ ] After simulated audit results exist, actionable attention items appear above metrics.
- [ ] No displayed KPI contradicts results or underlying observations.

### AT-03 — HSR Layout hours problem
- [ ] Brand sees AI hours versus approved hours and can confirm/correct/ask for verification.
- [ ] Confirmation creates or updates the underlying issue, not a duplicate.
- [ ] ProManage sees investigation evidence and can create a proposed correction.
- [ ] Brand can approve or request changes; approvals persist.
- [ ] Authorized source-completion step moves case to awaiting recheck, **not “AI fixed.”**
- [ ] Later matched recheck shows truthfully whether the claim is still observed.

### AT-04 — Whitefield Saturday tours
- [ ] Saturday tour appointments are never represented as ordinary operating hours.
- [ ] A corrected website/FAQ fact may be prepared and approved without pretending AI output instantly changes.

### AT-05 — Persistent Indiranagar phone mismatch
- [ ] Recheck still shows wrong number when the seeded result remains wrong.
- [ ] Brand sees `Still incorrect in latest check` and a working escalation/follow-up CTA.

### AT-06 — Source ownership
- [ ] Owned website, connected listing and independent directory have clearly different control/approval language.
- [ ] With no citations, cause remains unknown.
- [ ] No real external writes occur; fixture actions show `Simulated`.

### AT-07 — Monitoring and reporting
- [ ] Brand sees comprehensible progress/trends without technical surface or proxy identifiers.
- [ ] ProManage retains full matched-sample and technical analytics.
- [ ] Recheck comparisons preserve original evidence and use matching samples/denominators.
- [ ] Existing working CSV/print report functionality still works.

### AT-08 — Quality
- [ ] No dead primary buttons, broken sidebar links or hidden-role routing failures.
- [ ] A brand-new user can complete their responsibilities without understanding GEO/JSON-LD.
- [ ] All labels, states and numbers remain consistent after refreshing and switching roles/releases.
- [ ] Build passes and main flow works at desktop viewport; tablet layout remains usable.

---

## 18. Final delivery instructions to Claude Code

1. **First** inspect the current codebase and produce a concise `Current state → Needed modification → Reusable component` mapping.
2. Make changes incrementally and **reuse existing app logic/components**.
3. Implement P0 fully, then P1, then P2 as time allows; do not declare incomplete work as complete.
4. Preserve the look/feel of the existing ProManage UI unless improving readability or interaction clarity.
5. Run typecheck/build and launch the app; test the complete Brand and ProManage workflows in a browser wherever tooling allows.
6. Show how the new **Brand** interface handles the HSR, Whitefield and Indiranagar cases from beginning to end.
7. Provide an implementation summary: files changed, routes changed, states/permissions updated, tests run, unresolved issues, and what remains simulated.

### Definition of Done

> A nontechnical Brand manager can open ProManage, understand why a location needs attention, confirm or correct the business fact, approve a clearly explained update, track what ProManage and source owners did, and check whether the latest sampled AI answer still shows the problem — **without using technical GEO tools**. A ProManage operator can perform all corresponding investigation, structured-data preparation, technical task coordination and monitoring within the same underlying application.

**Do not rebuild the application. Do not stop after planning. Deliver a working, tested enhancement of the existing prototype.**
