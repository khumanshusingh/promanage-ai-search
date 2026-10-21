# ProManage AI Visibility / GEO — Detect-to-Resolution Product PRD

**Version:** 3.0 · **Status:** Proposed specification for an existing interactive hiring-assignment prototype  
**Product placement:** ProManage → Insights & Analytics → AI Visibility  
**Roadmap:** MVP (weeks 1–4), V1 (weeks 5–8), V2 (weeks 9–12); 2 engineers  
**Primary user:** Enterprise Digital Marketing / Local SEO Manager  
**Demo organization:** BrightNest Preschools (fictional), 150 centres; 10-centre pilot  
**Sources reconciled:** the earlier ProManage AI Visibility Prototype PRD, the updated prototype PRD, and the 4-page GEO roadmap proposal.

> **Implementation directive:** Extend the **existing** working ProManage prototype; don't rebuild it. All customer data, sampled AI answers, third-party website snapshots and outputs are clearly **Simulated**. No live AI APIs, actual business access, website publishing or guaranteed corrections to model answers. A source update is **never equivalent** to an AI-answer correction.

---

## 1. Product problem, outcome and boundary

### Customer problem
A business with hundreds of outlets cannot easily know (a) whether an individual relevant outlet is mentioned in sampled AI-generated answers and (b) whether facts in those answers are correct. Even after detecting a wrong answer, the marketing team struggles with the operational next step: **verify the discrepancy → investigate accessible sources → correct the information it controls → check what the AI says later**.

### Product promise
**“Show me the evidence, tell me what I can check, help me correct controlled information, and recheck the same question.”**

### Core workflow
**Detect → Confirm → Investigate → Act on controlled sources → Recheck → Close or continue monitoring.**

ProManage can control its interface, verified business records, tasks, content previews, and changes to sources for which the business grants authorization. ProManage **cannot** dictate ChatGPT/Gemini/Perplexity recommendations, force crawlers to index a page, or see actual private consumer conversations.

**Primary customer outcome:** less time and uncertainty between discovering a material AI-answer discrepancy and resolving a verified issue in an owned or managed information source.  
**ProManage business hypothesis:** greater adoption of Listing Management and Insights, stronger retention, and willingness to pay for an AI Visibility add-on. Revenue impact remains unproven.

### Non-goals (all releases)
- Guarantee mentions, rankings, citations, corrections, traffic or sales.
- Call missing mentions “confirmed errors” without first checking relevance.
- Claim source attribution when a response provides no citation.
- Automatically edit independent third-party sites, publish to AI models, or bypass access controls.
- Assume ProManage data is correct merely because it is stored in the platform.

---

## 2. Users, roles and ownership

| Actor | Main job | Access / responsibility |
|---|---|---|
| **Enterprise Marketing Manager** | Start audits, review evidence, prioritize issues, approve verified facts and publication hand-offs | Organization-wide audit; final customer approval |
| **Regional / Centre Manager** | Verify opening hours, service details and contact information; complete assigned fixes | Assigned locations; propose/confirm facts, not global approval |
| **ProManage CSM / Account Executive** | Set up assisted pilot audit and explain findings | Assisted execution; cannot certify business truth for the customer |
| **Enterprise Head of Marketing** | Assess risk, progress and expansion value | Executive report / read-only overview |
| **AI provider** | Returns answers under provider-owned rules | Outside ProManage's direct control |

**Roles in the prototype:** retain the existing `Demo as` switch; permissions are simulated. Customer fact approval cannot be completed by a ProManage CSM persona. Retain role and release modes throughout the same app.

---

## 3. Release strategy at a glance

| Release | Main user question | Must-have | Completion evidence | Explicit exclusion |
|---|---|---|---|---|
| **MVP: Detect & Confirm** (W1–4) | “What is AI saying and is it wrong?” | Select ≤10 locations; 8 curated prompts; 1 simulated measurement surface; 80 observations; exact answers; fact comparisons; review status; CSV/print report | User can **confirm or dismiss** a specific potential discrepancy with preserved evidence | No real source correction or monitoring |
| **V1: Investigate & Act** (W5–8) | “Where might the incorrect information be, and what can we fix?” | Issue inbox; source comparison; GEO Readiness Studio; controlled-source action plan; verified facts; JSON-LD/fact-sheet **preview/export**; assignment, approval and action statuses | User gets an approved, traceable corrective action to an owned/managed source | No automatic CMS/GBP write or model manipulation |
| **V2: Recheck & Learn** (W9–12) | “Is the problem still happening, and what changed?” | Saved limited monitoring schedule preference; on-demand simulated rechecks; identical-cohort comparison; durable status; alert digest; reports | User identifies issue as **no longer observed / persists / inconclusive** in subsequent samples | No 24/7 scans, all-provider parity or causal revenue claim |

**Packaging:** GEO is a capability inside Insights & Analytics; it reuses Listing Management data/workflows. V1 does **not** create a replacement listings platform.

---

## 4. Master scenario (the story across all releases)

**Location:** BrightNest HSR Layout (fictional). **Fact:** business-approved centre hours are **Mon–Fri 8:30 AM–6:30 PM**; Saturday tours, if offered, are a *separate appointment-based service* and must not be conflated with general opening hours.

**Sampled prompt:** “BrightNest HSR Layout phone number and opening hours.”

**Simulated AI answer:** phone number is correct, but states **Mon–Sat 9 AM–6 PM**. The response contains **no citations**. The marketing manager can see an exact answer and the approved record side-by-side.

1. **MVP:** the manager reviews the factual claim, checks whether the centre's official hours were independently approved, and selects **Confirm factual discrepancy**. The product saves the incorrect claim, correct value, timestamp, prompt, sampled source and reviewer. If the facts haven't been independently verified, the CTA becomes **Request verification**, not Confirm.
2. **V1:** the manager opens **Investigate sources**, where the prototype compares *simulated snapshots* of the official website, a managed Google Business Profile listing and a directory. No citations means every possible cause remains a **hypothesis**. If a controlled source shows outdated hours, the manager creates a correction task, confirms correct data with the centre, generates appropriate source content/structured markup where useful, and routes it for business approval and authorized publication. The issue reads **Source action completed — awaiting AI recheck**, not “AI fixed.”
3. **V2:** the manager reruns the same prompt using the same sampling surface and context. If the new AI answer says correct hours, the observation becomes **No mismatch in latest sample**; if unchanged, **Still observed**; if not comparable, **Inconclusive**. The product explicitly says **“Observed change; causation not established.”**

---

## 5. MVP — End-to-end user journeys (weeks 1–4)

### UC-M1: Identify and confirm wrong operating hours (primary flow)
**Actor:** Marketing Manager. **Trigger:** Need a baseline AI-answer audit for 10 pilot centres.  
**Precondition:** BrightNest locations and at least some independently approved facts exist in ProManage.

1. Open **AI Visibility → New Audit**; select 10 centres from the existing location directory.
2. Review field completeness (name, address, phone, general hours, services, website). Any missing/uncertain value shows **Needs verification**.
3. Choose 8 prompts: **5 unbranded discovery, 3 branded fact**. Preview the query with location substituted.
4. Review **10 × 8 × 1 = 80** simulated checks; choose **Run audit**; see status/progress.
5. Open **Results → HSR Layout → Branded fact prompt**; see the full sampled AI answer and claim-check table.
6. System marks hours **Potential mismatch**; phone **Matches verified record**; no citations **Source unknown**.
7. Click **Confirm discrepancy**, **Not an issue**, or **Needs investigation**. On confirmation, store the full evidence and reviewer decision.
8. Export an audit summary/CSV that identifies confirmed versus unreviewed findings.

**Expected end state:** Evidence-backed **Confirmed factual discrepancy / Unactioned**. No claim that the model is corrected.  
**User value:** Quickly identify a concrete potential customer-facing misinformation issue.  
**ProManage value:** Demonstrates usefulness of existing verified location data.

### UC-M2: The AI omits a relevant centre (discovery observation)
1. Run an **unbranded** query such as “Best preschools near HSR Layout.”
2. The sampled answer does not mention BrightNest.
3. Show **Not mentioned in this sampled response**, plus the query/context/time. Do **not** label it a hallucination, confirmed defect or proof of real-world market share.
4. User may tag **Worth monitoring / Not relevant** after checking whether the centre genuinely fits the query.

**End state:** Sampled discovery observation, not a correction task by default.

### UC-M3: ProManage record is not independently verified
1. A phone-hours claim is extracted, but the platform's own “correct” record was last verified too long ago or is incomplete.
2. Show **Cannot evaluate against verified truth** and CTA **Request centre verification**.
3. Do not count the observation in the **confirmed mismatch** metric until verification occurs.

**End state:** **Awaiting source-of-truth verification**.

### UC-M4: Assisted audit for ProManage CSM
1. CSM selects an existing fictional customer or previews a small CSV of pilot locations; invalid rows are flagged.
2. CSM runs the same audit and prepares a **printable executive baseline report**.
3. Customer must still approve any asserted business facts; CSM cannot certify them.

**End state:** Sales-assisted report with explicit sample and method limitations.

---

## 6. V1 — End-to-end action journeys (weeks 5–8)

### UC-V1-1: Official website has outdated hours (primary correction flow)
**Trigger:** Confirmed HSR Layout mismatch from MVP; marketer selects **Investigate sources**.

1. Open **Issues → Opening hours → Investigate**. Display the exact AI claim and independently verified BrightNest record.
2. Open **Source comparison**. Show labeled simulated snapshots: **ProManage approved record / official website / managed listing / independent directory**, each with last-known check time, owner and comparison status.
3. Website snapshot says **Mon–Sat 9–6** while verified record says **Mon–Fri 8:30–6:30**. Display **Verified source inconsistency (website)**. **Do not say it caused the AI output** unless supported evidence actually demonstrates that.
4. CTA **Create correction task** → select **Owned website** → assign Content Manager → attach diff, correct value and website target → due date.
5. Open **GEO Readiness → HSR Layout → Verified Data**. Centre manager reconfirms true hours and Marketing Manager approves.
6. In **Structured Data**, preview JSON-LD built from approved supported fields; general opening hours use appropriate opening-hours properties. In **Fact Sheet**, preview readable centre details; keep Saturday tour availability separate.
7. **Copy / Export** safe HTML or JSON-LD and **Create publication handoff task**. No live website write is performed.
8. Assignee marks **Content prepared → Business approved → Source updated (simulated)** with evidence/notes.
9. Issue displays **Awaiting AI recheck**. **Never** change the original observed AI response or mark the AI issue resolved on source update.

**End state:** Controlled-source correction documented; pending V2 measurement.  
**User value:** A clear route from evidence to a corrective action they can own.  
**ProManage value:** Deeper usage of Listings/Content/Insights; potential premium workflow value.

### UC-V1-2: Managed Google Business Profile listing is outdated
1. Source comparison shows correct master record but outdated connected GBP snapshot.
2. CTA **Open managed listing** reuses an existing ProManage Listing Management route if available; otherwise opens a clearly labeled simulated listing detail.
3. Create **Update managed listing** task; only an authorized business user can approve a change.
4. Mark simulated listing update done; record channel, responsible party and timestamp.
5. Issue remains **Awaiting AI recheck**.

**Important:** Do not build a second GBP editor inside GEO; deep-link to existing listing functions.

### UC-V1-3: An independent directory is outdated
1. Official website and GBP agree with verified record; third-party directory snapshot is outdated.
2. Product shows **External source — not directly editable**.
3. CTA **Prepare correction request** creates a draft with the correct facts, source URL, evidence and intended owner.
4. Manager marks **Request sent (simulated)**; issue remains **External correction pending** or **Awaiting recheck** only after evidence of the change.

**End state:** Guided escalation, not a fake “fix.”

### UC-V1-4: All known sources correct; AI answer still wrong
1. The exact AI answer contains an incorrect claim but **no citations** or traceable faulty source.
2. Owned and managed source snapshots match independently verified truth.
3. Show **No verified controllable-source discrepancy found**; possibilities include stale indexes, uncited external content, model generation or entity confusion.
4. Actions: **Preserve evidence**, **Log provider feedback option (if supported)**, **Monitor / recheck**. Do **not** generate unnecessary schema or pretend the model can be patched.

**End state:** **Unresolved externally / monitor**. This is a valid, honest product outcome.

### UC-V1-5: Wrong store entity or unverified services
1. AI answer mentions BrightNest but appears to mix HSR Layout with Whitefield, or claims a service not in the business record.
2. System shows **Possible entity confusion / Needs verification**, not automatic “confirmed mismatch”.
3. Marketing Manager requests verification from the relevant centre; once validated, create a targeted content/listing task if a controlled gap is found.

**End state:** Evidence-based investigation, without false certainty.

---

## 7. V2 — End-to-end monitoring journeys (weeks 9–12)

### UC-V2-1: Recheck after a source update (primary measurement flow)
1. In **Monitoring**, see HSR Layout issue **Source updated — awaiting recheck**.
2. Choose **Run matched recheck** on the same normalized prompt, location, provider/proxy, locale, sampling context, and evaluation rules.
3. Compare original and new **exact** sampled answers side-by-side and show each timestamp.
4. Classify: **No mismatch in latest sample** / **Still observed** / **Inconclusive**. Require evidence before changing issue disposition.
5. If correct in the latest sample, show **Observed improvement (not proven causation)**. If wrong, maintain issue open and offer a new investigation task.
6. Export matched comparison, source-action timeline and limitations.

**End state:** Action outcome becomes observable; not a promise of lasting correction.

### UC-V2-2: Repeated critical misinformation
1. Saved **weekly monitoring preference** (simulated—no real background worker in prototype) includes high-impact branded fact prompts.
2. A recheck again states **Permanently closed** or provides an incorrect critical phone number, conflicting with independently verified facts.
3. Put it in **Critical findings requiring review**; deduplicate repeated alerts for the same location/fact/source and require manual confirmation before external escalation.
4. Assign urgent verification task to the responsible region; preserve screenshots/answer text from the sample.

**End state:** High-risk issue routed to a human owner.

### UC-V2-3: Discoverability remains low
1. Compare **unbranded** mention rates over an identical 10-location × relevant-prompt cohort, separately from factual accuracy rates.
2. Show “not mentioned” changes and competitor entities observed in **these sampled answers**, not genuine consumer market share.
3. Flag candidate areas for content/listing investigation without asserting the AI algorithm's reasons.

**End state:** Prioritized research opportunity; no promise of rank gains.

### UC-V2-4: Recheck is not methodologically comparable
1. A provider or prompt definition changes, or a location's verified facts are revised.
2. Show **Not comparable** (different cohort/proxy/rules) and start a new baseline rather than plotting a misleading percentage-point improvement.

---

## 8. Interface and route specification (extend existing UI)

| Existing / new route | Release | Screen & primary actions |
|---|---|---|
| `/overview` | MVP | AI Visibility summary; **New audit**; recent audits; data coverage; simulated badge |
| `/audits/new` | MVP | Location picker; verification indicators; prompts; review; **Run audit**; optional CSM CSV preview |
| `/audits/:id` | MVP | Unbranded mentions and branded accuracy **separate**; click location; export report |
| `/locations/:id/answers` | MVP | Three-column existing layout: prompt list, exact answer/claims, verified record. **Confirm / Dismiss / Needs verification**; V1 CTA **Investigate sources** |
| `/issues` and `/issues/:id` | V1 | Issue inbox; per-claim evidence; severity; confidence/uncertainty; **Investigate / Create task / Open GEO Readiness** |
| **`/issues/:id/sources`** (new pane or nested route) | V1 | Source comparison with last-seen snapshots, owner, control classification, evidence, **Act on this source** |
| `/geo-readiness/:locationId` | V1 | Verified facts; source differences; JSON-LD preview/export; fact-sheet preview/export; approval and publishing handoff |
| `/tasks` | V1 | Tasks by source channel/owner; approval; source correction statuses; activity trail |
| `/monitoring` | V2 | Saved schedule preference; **Run simulated recheck**; matching cohort and answer comparison; alerts |
| `/reports` | MVP/V2 | Baseline PDF-print/CSV; V2 progress and persistent discrepancies |

**Context preservation:** A user entering via HSR Layout's answer screen should land on an issue-specific source comparison, not an empty generic dashboard. Keep `issueId`, `locationId`, prompt and sampled observation context in navigation and back links. Keep existing ProManage account shell, visual style, role switch and release gate.

### Answer-detail screen: required new V1 panel under `Review`
- **Issue:** Opening hours conflict — **Confirmed by user** / **Not yet confirmed**.
- **Evidence:** AI answer, approved hours, observation date, provider proxy; **No citations** if absent.
- **What you can do:** `Investigate sources` (primary), `Assign verification`, `Mark not an issue`.
- **Potential cause:** “No source citation in this sample. Source inconsistencies are hypotheses, not confirmed causes.”
- **V1 continuation:** A source comparison → source-channel-specific action → task → GEO Readiness (only when useful).
- **V2 continuation:** `Run matched recheck` → before/after observed answers → disposition.

### Source comparison matrix

| Source | Example content | Control | Product CTA |
|---|---|---|---|
| Business-approved master record | Mon–Fri 8:30–6:30 | Owned by business | Verify / approve fact |
| Official BrightNest location page | Mon–Sat 9–6 (simulated) | Brand-controlled | Prepare website update |
| Connected GBP listing | Mon–Fri 8:30–6:30 (simulated) | Authorized managed listing | Open existing listing record |
| Independent directory | Mon–Sat 9–6 (simulated) | Third party | Draft correction request |
| AI answer | Mon–Sat 9–6, no citations | External model | Preserve and recheck; cannot directly edit |

**Warning:** Agreement between incorrect website and AI answer does not prove the website caused the answer.

### GEO Readiness tabs
1. **Verified data:** Field/value, who verified, when, and whether source content agrees. Separate general hours from tours/appointments.
2. **Structured markup:** JSON-LD preview using **only verified supported schema.org properties** (e.g., name, PostalAddress, URL, phone, genuinely applicable opening hours). Warn about missing fields. Copy/download buttons function. Local rules validation is **not** crawler validation.
3. **Readable fact sheet:** Safe HTML preview/export with centre details and approved FAQs. No magical “AI indexing endpoint” claims.
4. **Approval & handoff:** Assign to authorized content/listing owner; record business approval and simulated publication evidence; **Awaiting recheck** status.

No direct write into external systems in this prototype. A simulated source snapshot can change upon authorized completion **without rewriting past observations**.

---

## 9. State machines, rules and edge cases

### Separate four different status objects

| Object | Allowed states |
|---|---|
| **Sampled observation** | Captured; Extracted; Human review needed |
| **Factual issue** | Potential → Needs business verification → Confirmed / Dismissed / Unverifiable |
| **Source action** | Not started → Assigned → In progress → Prepared → Approved → Source updated (simulated) / External request pending |
| **AI outcome (post-recheck)** | Not rechecked → Still observed / No mismatch in latest sample / Inconclusive |

**Non-negotiable invariants:**
- Editing a master record is not verification by itself.
- A potential conflict becomes confirmed only when a reviewer approves an independently checked truth value.
- “No citation” must not become “cited website X” through inference.
- An action on the brand's website or GBP cannot auto-flip the answer from wrong to correct.
- A single missing brand mention is an observation, not a hallucination or verified recommendation defect.
- Archived sample evidence remains immutable. Rechecks create a **new** observation.
- `Closed` means the enterprise has completed its handling and recorded its disposition, not guaranteed permanent AI accuracy.
- Sensitive service/financial/health claims receive **Needs specialist/business verification** and are not blindly auto-corrected.

**User-facing fallback states:** Data missing → “Cannot evaluate”; all sources correct → “No verified source inconsistency found”; no AI citation → “Source unknown”; external site inaccessible → “Unable to inspect; manual check required”; incompatible recheck → “New baseline required”.

---

## 10. Data model & prototype architecture

Extend existing deterministic fixtures/state rather than rewriting them.

- `Organization`: id, name, industry, count.
- `Location`: id, region, geo context, manager, verified facts/verification timestamps.
- `Audit`: id, locations, normalized prompts, simulated surface, locale, timestamp, cohort fingerprint.
- `Observation`: immutable sampled answer, claims, mentions, citations **if actually in fixture**, exact prompt, source, timestamp, confidence limits.
- `FactReview`: field, extracted claim, independently verified reference, reviewer, outcome, reviewedAt.
- `Issue`: claim reference, issue type, severity, owner, status, evidence, possible explanations.
- **`SourceSnapshot` (new)**: location, channel (`owned_website`, `managed_listing`, `third_party`), URL/record ref, observed value, retrievedAt, simulation flag, access/control type, assessment.
- **`VerifiedFact` (extended)**: field, value, verification status, verifying role, verifiedAt, applicable service context.
- **`ContentAsset` (new)**: location, format (`jsonld`, `html_fact_sheet`), verified field provenance, generated payload, version, approval status.
- **`SourceAction` (new)**: issue, source channel, assignee, planned change, approval, completion evidence, status, timestamps.
- `Recheck`: original cohort id, fresh immutable observations, comparability result, outcome.

**Implementation:** keep current React/Vite/TypeScript/routing/state solution and visual tokens. Use seeded snapshots and deterministic simulated AI replies; client-side data only; localStorage persistence if already used. Add a **mockSourceAuditService** and **geoMarkup generator** that operates exclusively on approved fields. No scraping, API keys, server infrastructure or real third-party access in the demo. CSV import/exports and JSON/HTML downloads must work. Use only safe `.example` URLs and sanitization for previews.

**Backend/product feasibility distinction:** the interactive prototype can simulate every stage. The proposed real 12-week product should use one permitted provider access path, limited pilot locations and manual approval. Actual source retrieval, official integrations and automated schedules require separate access/engineering validation; do not present these as already implemented.

---

## 11. Metrics: customer impact, business impact and safety

| Release | Customer-facing measure | ProManage measure | Guardrail |
|---|---|---|---|
| MVP | Reviewed useful findings / findings reviewed; % confirmed mismatches with defensible evidence | Pilot acceptance; willingness to proceed; CSM setup effort | False positive rate; no unverified “truth”; bounded queries |
| V1 | % confirmed **controllable** issues with assigned action; time to approved source-action completion | Adoption of existing listings/content workflows; add-on paid interest | Source action accuracy; approvals; no external unauthorized writes |
| V2 | % high-priority issues rechecked; share **no longer observed** / persist / inconclusive in matched samples | Pilot renewal/expansion intent; repeat meaningful use | Comparability, API/monitoring cost, alert noise |

**North-star candidate:** **Verified, actionable AI-information discrepancies advanced to a documented controlled-source resolution per active pilot account**. Keep sampled discovery mention rate and factual accuracy separate; do **not** blend them into a single unqualified “AI Visibility Score.”

**Pilot success thresholds:** to be agreed as *targets* with stakeholders, not shown as actual ProManage outcomes. Check reliability and user understanding before monetization. Show `n/N` and sample scope beside percentages.

---

## 12. Build plan and hand-off to Claude Code

### Weeks 1–4 — MVP
- W1: Inspect current repository; reuse location data; verify pilot facts and prompt taxonomy.
- W2: Deterministic one-surface audit runner and answer review, with immutable evidence.
- W3: Review decisions, uncertain data fallback, correct metrics, reports.
- W4: CSM-assisted setup, pilot usability, bug fixes, baseline acceptance.

### Weeks 5–8 — V1
- W5: Issue model + source comparison using simulated stored snapshots.
- W6: Corrective action plans, roles, approvals and deep link to existing listings experience.
- W7: GEO Readiness verified-facts tab, JSON-LD/HTML preview and export.
- W8: End-to-end HSR correction workflow, statuses, audit trail and test pass.

### Weeks 9–12 — V2
- W9: Comparable recheck and immutable second observation model.
- W10: Limited scheduled-preference UI and location trends.
- W11: Critical misstatement digests and executive progress report.
- W12: Full regression, quality checks and 4–6-minute polished demo.

**Prioritization under pressure:** Never cut verification correctness, evidence preservation, source/AI status separation, or functional end-to-end flow. Cut extra providers, decorative dashboards, automated website updates, and speculative competitor scoring first.

### Acceptance criteria / QA scenarios
- [ ] Existing MVP audit, roles, navigation, fixtures and export still work.
- [ ] 10 locations × 8 prompts × 1 simulated surface = **80** observations; totals and filters reconcile.
- [ ] Branded fact checks never inflate unbranded discovery mention rate.
- [ ] Selecting an HSR opening-hours conflict → confirming it → source comparison → owned-site task → verified facts → preview/export → approval → source updated → awaiting recheck works with no dead controls.
- [ ] Missing/unverified facts never create confirmed mismatches.
- [ ] An uncited AI answer has no invented citation or guaranteed root cause.
- [ ] GBP correction routes to existing listing workflow or a labeled simulation, not a new disconnected editor.
- [ ] External directory creates a request, not a fake publication success.
- [ ] All-known-sources-correct scenario stays unresolved/monitor without prescribing meaningless markup.
- [ ] JSON-LD contains appropriate, verified properties only; previews and exports are safe, functional and versioned.
- [ ] Completed source task does not change saved AI answer or set “AI corrected.”
- [ ] Matched recheck shows “No mismatch in latest sample / Still observed / Inconclusive,” with new immutable answer and explicit context.
- [ ] If context varies, UI creates a new baseline instead of showing invalid improvement percentages.
- [ ] Monitoring alerts deduplicate and require human review for materially wrong claims.
- [ ] Simulated badges visible, role/release gates function, files export, keyboard focus/accessibility and production build pass.

### 5-minute hiring-demo route
**MVP (~1 min):** `/overview` → `/audits/new` → `/locations/hsr-layout/answers` → **Confirm discrepancy**.  
**V1 (~2.5 min):** `/issues/:id/sources` → **Official website differs** → `/geo-readiness/hsr-layout` → **Verify & approve** → **Export / assign source update** → `/tasks` → **Awaiting recheck**.  
**V2 (~1 min):** `/monitoring` → **Run matched recheck** → compare before/after → `/reports`.  
**Closing line (~20 sec):** “ProManage can't edit ChatGPT, but it can help enterprises systematically find wrong claims, correct the source information they own, and verify whether comparable AI samples improve.”

---

## 13. Instructions to coding agent

Read this entire PRD and inspect the **existing repository first**. Do not regenerate a new app, overwrite working modules or break existing role/release controls. Implement the user journey from the provided HSR screenshot, retaining its 3-column layout and contextual issue detail. Add source comparison, actionable fixes, GEO Readiness, approvals and rechecks in their release gates; reuse the existing Listings experience by navigation, not duplication. Use fictional seeded facts and simulated observations. **Never claim a model answer was fixed when only a source task completed.** All primary buttons must work. Run type checks, build, and click-test the primary and edge-case flows. Report changed routes, files, gaps and limitations.
