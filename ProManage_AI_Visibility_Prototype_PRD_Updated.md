# ProManage AI Visibility / GEO — Updated Interactive Prototype PRD

**Version:** 2.0 — reconciled with the GEO roadmap PDF  
**Status:** Implementation-ready brief for Claude Code; fictional hiring-assignment prototype  
**Product:** AI Visibility, an extension of ProManage Insights & Analytics  
**Timeline depicted:** MVP (weeks 1–4) → V1 (weeks 5–8) → V2 (weeks 9–12); **two-engineer product pod**  
**Design reference:** https://www.promanage.ai/  
**Source documents:** Existing *ProManage AI Visibility — Interactive Prototype PRD* and *Product Strategy & Roadmap: AI Search Visibility / GEO* (four-page PDF)

> **Non-negotiable:** Extend the existing prototype/repository. Do **not** replace working screens, navigation, state or styling without a concrete reason. This is a front-end demonstration, not an operational GEO product. Every response, citation, score, example brand, website and claimed change is **simulated**; no live search, scraping, external publishing or privileged integrations. Do not imply that ProManage can directly control ChatGPT, Gemini, Perplexity or Google AI answers.

---

## 1. Executive product decision

### 1.1 Customer problem
Enterprise brands with hundreds or thousands of physical outlets cannot reliably answer two questions at scale:
1. **Discoverability:** Do our **relevant individual locations** appear in sampled AI-generated answers to local customer questions?
2. **Accuracy:** When AI discusses those locations, are services, contact details, hours and other claims factually correct?

When a discrepancy is found, teams struggle to know whether it relates to source data they control, external websites, or AI retrieval/generation—and whether their remedial work made any observable difference.

**Primary customer journey affected:** Discovery and Consideration; downstream Interest and Engagement may benefit. **Do not claim proven sales lift.**

### 1.2 Product thesis
Use ProManage's existing location/listing/review data to connect **AI-answer observations** to **controlled-source improvements** and **comparable follow-up measurements**.

**Unified journey:** **Audit → Investigate → Optimize → Monitor**.

**Product promise:** “See how your locations appear in sampled AI answers. Check factual claims. Improve business information you control. Monitor changes over time.”

**Business hypothesis:** Existing customers may adopt or pay for an AI Visibility add-on because it reduces monitoring and diagnosis work and helps operationalize existing ProManage listings/content investments. This must be validated, not shown as established ROI.

### 1.3 What is changing from the previous PRD?
- **Keep:** app shell, BrightNest demo account, 150 locations, 10-location pilot, audit wizard, exact sampled answers, metric integrity, issue review, tasks, role switch, roadmap switch, reports and simulated rechecks.
- **MVP addition:** a simple **ProManage-assisted audit mode** and printable executive audit report, consistent with the PDF's sales-diagnostic approach.
- **V1 major addition:** **GEO Readiness Studio** to verify source facts, inspect content gaps, generate appropriate JSON-LD, preview a readable location fact sheet and create approved publication tasks. Retain the existing issue inbox/tasks.
- **V2 expansion:** same-cohort monitoring, historical answer changes, severity alerts and basic competitor mentions; include a **second simulated measurement surface only if comparison labels and denominators remain valid**. Do not promise all major AI platforms.
- **Explicit exclusions:** live AI calls, mass crawler/scraper, guaranteed ranking increases, direct model injection, automatic website or GBP updates, GTM-based crawler guarantees, and real revenue attribution.

---

## 2. Users, buyers and operating model

| Role | Why they use it | Demo permission |
|---|---|---|
| **Enterprise Digital Marketing / SEO Manager (primary user)** | Initiate audits, review findings, approve factual corrections, track outcomes | Full customer-side access |
| **Regional / Location Operations Manager (secondary)** | Validate local information, complete assigned content or listing tasks | Assigned locations only; cannot approve global publication |
| **ProManage Account Executive / CSM (assisted MVP)** | Help configure pilot audits and produce executive reports | Assisted workflow; not final authority on business facts |
| **Head of Marketing / CMO (buyer)** | See risk, operational progress and potential value | Executive reports / read-only summary |

**Prototype behavior:** Keep the existing `Demo as` persona selector. Add **Assisted audit** as a workflow option for the ProManage persona rather than creating a separate admin application. Role switching is a simulation, not authentication or real authorization.

**Ownership principle:** The business verifies facts and approves changes; ProManage facilitates observation, generation, tasks and measurement. An external AI platform controls its own answers.

---

## 3. Twelve-week product roadmap and boundaries

| Release | Customer promise | Must ship | Do not ship yet |
|---|---|---|---|
| **MVP / weeks 1–4** | **Detect:** “Show me what sampled AI answers say.” | 10 pilot locations; verified-data status; 8 prompts; 1 simulated AI search surface; audit run; brand/location mentions; potential claim discrepancies; human review; CSV and print-to-PDF report; assisted setup | Autonomous root-cause claims; real-time monitoring; multi-engine parity; website writes |
| **V1 / weeks 5–8** | **Act:** “Help me correct information I control.” | Issue inbox and evidence; severity; assigned tasks; source verification; **GEO Readiness Studio**; JSON-LD preview/export; fact-sheet preview/export; approval and simulated publication task statuses | Automatic GTM/CMS deployment; forced reindexing; guaranteed improvement in AI answers |
| **V2 / weeks 9–12** | **Measure:** “Tell me whether issues persist and how sampled visibility changes.” | Saved monitoring preferences; on-demand simulated recheck; matched observations; location/region trends; critical mismatch alert digest; lightweight competitor observations; executive progress reporting | Unlimited scans, four-provider production integrations, causal sales attribution, autonomous SEO agent |

**Engineering rule:** Reuse existing components, tables, routing, fixtures and state. Treat any extra AI platform as conditional/illustrative—not a committed production integration. Releases are cumulative feature gates in **one app**, not three distinct products.

### Delivery gates (hypotheses, not fabricated results)
- **After MVP:** at least one enterprise pilot can interpret the audit, verify a nontrivial finding and say whether they'd act on it; sample reliability and estimated run cost are acceptable.
- **After V1:** at least one user successfully moves a confirmed source issue through verified facts → approved structured/content export → source-action completion without confusing that action with an AI answer fix.
- **After V2:** a pilot can compare matched observations over time and distinguish real verified issues from normal answer variability; cost per cohort stays within a defined budget.

---

## 4. Core fictional demo story

**Brand:** BrightNest Preschools, **fictional**, 150 centers across India. Default pilot: 10 centers in Bengaluru (Whitefield, HSR Layout, Koramangala, Indiranagar, Sarjapur, Jayanagar, Bellandur, Brookefield, Electronic City, Marathahalli).

1. A ProManage CSM or BrightNest Marketing Manager starts an AI Visibility audit; selects 10 locations and checks completeness of their verified records.
2. Chooses **8 prompts: 5 unbranded discovery and 3 branded factual checks**. The mock runner produces **10 × 8 × 1 = 80** consistent simulated observations.
3. The results show a missing mention for a relevant location in one unbranded response; this is a **sampled non-mention, not automatically a defect**.
4. A branded question about Whitefield's Saturday tours returns “not available.” The business's approved record says tours operate **10 AM–1 PM**. The manager reviews and **confirms a factual mismatch**.
5. V1 unlocks. In the issue detail, the system suggests investigating an outdated website/directory page **as a possible explanation, never a proven cause**.
6. The manager opens **GEO Readiness → Whitefield**, verifies fields and sees that Saturday-tour details are absent or outdated in approved web content. They generate a readable fact sheet and schema markup that contains **only supported, verified properties**, then assign the website/content team to publish an approved update.
7. The correction task moves to **Source updated; awaiting AI recheck**. The observed AI answer must **not** automatically switch to Correct.
8. V2 unlocks. User clicks **Run simulated recheck**. Some answers change, some do not. A matched-cohort chart reports observations and cautions: **“Change observed; causation not established.”**
9. Customer downloads an executive report showing findings, verified corrections, publication statuses and repeat-check results.

**Do not misrepresent Saturday campus-tour slots as the preschool's general opening hours.** Model tour availability as its own validated service/visiting-hours fact. Include it in a human-readable FAQ or structured description only where semantically appropriate; do not invent schema properties.

---

## 5. App information architecture and routes

**Placement:** Existing ProManage platform → Insights & Analytics → **AI Visibility**. Keep ProManage shell and account context.

| Route | View | Release | Implementation action |
|---|---|---|---|
| `/overview` | AI Visibility overview | MVP | Preserve and polish |
| `/audits/new` | Guided audit creation | MVP | Extend with assisted mode / CSV option |
| `/audits/:id` | Audit results | MVP | Preserve and add printable summary |
| `/locations/:id/answers` | Answer/evidence review | MVP | Preserve; add navigation to optimization |
| `/issues`, `/issues/:id` | Issue inbox and diagnosis | V1 | Preserve; connect to Readiness Studio |
| `/tasks` | Correction task tracking | V1 | Extend with source/publication statuses |
| **`/geo-readiness/:locationId`** | **NEW: GEO Readiness Studio** | **V1** | Build new view within current shell |
| `/monitoring` | Matched rechecks, trends and alerts | V2 | Extend |
| `/reports` | Audits and progress reports | MVP / V2 | Add print-to-PDF; expand V2 report |

Suggested navigation: **Overview; Audits; Locations & Answers; Issues (V1); Tasks (V1); GEO Readiness (V1); Monitoring (V2); Reports.** Existing future tabs may be disabled with explicit “Available in V1 / V2” hints. Avoid an unnecessary “fifth M-branded product.”

### S1. Overview (`/overview`)
- Summary cards: **Sampled unbranded discovery mention rate**, **Pilot locations tested**, **Confirmed factual mismatches**, **Items needing review**; show denominators and run timestamp.
- Recent audits and location performance tables, main CTA **New audit**.
- Visible badge **Simulated AI-search observations**, not real private ChatGPT usage.
- Release-mode and role selector remain globally accessible.

### S2. Audit wizard (`/audits/new`) — MVP
**Locations:** Select up to 10 pilot locations from 150; show verification status and missing address/phone/hours/services/website fields. Unknown fact means **Cannot evaluate**.

**Assisted audit:** In ProManage persona, optionally upload a small `.csv` (columns `location_name,neighborhood,city,address,phone,website`), validate in-browser, preview parsing/invalid rows and select sample locations. No server upload or external syncing; do not let CSV facts silently become verified truth. Prefer existing fixture selection when in Customer mode.

**Prompts:** Select/edit from 8 templates. Categories: 5 unbranded discovery; 3 branded factual. Show substituted `{neighborhood}` preview, relevant category/service, and prompt provenance. Do not count branded answers in discovery mention rate.

**Review and Run:** Show source = **Simulated AI search surface A**, exact sampling scope, and max observations. Simulate 3–6 seconds of progress; outputs deterministic fixtures. No fake live ChatGPT API call.

### S3. Audit results (`/audits/:id`) — MVP
- Filters by location/prompt intent/status; sort by sampled mention and verified discrepancies.
- Results separate **Unbranded discovery mention**, **Branded fact checks**, **Potential discrepancies**, **Unverifiable claims**.
- A store omitted from one answer displays “Not mentioned in this sampled response,” never “AI has suppressed this store.”
- **Download CSV** (actual browser download) and **Print / Save as PDF** (print-optimized HTML; no backend PDF service).
- Assisted-mode report title: **Executive AI Visibility Baseline Audit** with methodology and limitations.

### S4. Location & answer evidence (`/locations/:id/answers`) — MVP
- Prompt list; full simulated answer; exact sampled timestamp; source label; mention detection; evidence/citations only if seeded.
- Side-by-side **AI claim | business-verified record | review status**. Show owner/last verification date.
- Human review: **Confirmed discrepancy / Not an issue / Needs investigation**; do not auto-confirm against unverified data.
- In V1, include CTA **Investigate source / Open GEO Readiness**.

### S5. Issues (`/issues`, `/issues/:id`) — V1
- Filters: location, severity, issue type, status, assignee.
- Categories: Factual mismatch; potential discovery gap; unsupported claim; inconsistent source content; unknown fact.
- Prioritize material inaccuracies (wrong phone/address, misleading services, false closed status). Non-mentions require relevance checks and are neutral/amber observations until substantiated.
- Show exact evidence, approved source, **possible explanations**, affected source surfaces and CTA **Open GEO Readiness**.

### S6. Tasks (`/tasks`) — V1
- Create task from issue; specify controlled channel (`Owned website`, `Managed listing`, `External site — request only`), owner, due date and notes.
- State progression: **Open → In progress → Content/markup prepared → Approved → Source updated (simulated) → Awaiting AI recheck → Closed**.
- Only enterprise Marketing Manager can approve source changes in prototype. Regional manager can verify local facts/complete assigned work. ProManage CSM can assist but not approve facts.
- Audit log persists. A source update must not automatically mark AI representation corrected.

### S7. **NEW GEO Readiness Studio** (`/geo-readiness/:locationId`) — V1

**User goal:** From an observed mismatch, identify a correctable source-content gap and prepare safe, reviewable information for authorized publication.

**Tab A — Verified Business Data**
- Display all location facts with `value`, `status (verified/unverified/missing)`, `source owner`, `last verified`, and `where used`.
- Separate general operating hours from **Saturday tours / appointment hours** and other service-specific attributes.
- Show diff vs simulated owned-website content and simulated connected listing content. Do not imply ProManage can see live external content.
- CTA **Request verification** for unclear facts; editing unverified data requires approval before generation.

**Tab B — Structured Data (JSON-LD)**
- Create a **preview from approved facts only** using relevant schema.org types/properties: name, URL, PostalAddress, GeoCoordinates where verified, phone, suitable openingHoursSpecification if true for general opening hours, and safe `description`/services when semantically valid.
- For preschools select an appropriate Schema.org educational/child-care type as supported by the chosen schema vocabulary; **do not invent properties** for tours. Store a transparent mapping from each output field to the verified business record.
- Highlight missing fields and omitted/unverified fields; show validation status and clear warnings. Local validation is a **prototype rules check**, not Google's Rich Results Test or crawler validation.
- Buttons: **Copy JSON-LD**, **Download `.json`**, **Create implementation task**. Ensure functional.

**Tab C — AI-Readable Fact Sheet**
- Preview a plain, accessible **HTML location fact sheet**: name, address, contact, hours, verified services, FAQ, last-updated date and source context. Simulated `.example` URL only; no actual hosted public page.
- Explain: this may improve information clarity for compatible crawlers **if published, accessible and discovered**, but does **not** ensure indexing or AI recommendations.
- Buttons: **Export HTML**, **Copy content**, **Create CMS update task**. Never say “Publish to ChatGPT.”

**Tab D — Publication & Checks**
- Publication checklist: **Facts verified → Business approval → Snippet/content exported → Implemented on owned site / managed listing (simulated) → Awaiting independent AI recheck**.
- Indicate delivery channel (owned site CMS, connected listing, request to independent directory), status, owner and date.
- V1 only simulates publication *task completion*. No GTM injection, reverse-proxy rewrite, real API write, forced crawl or ranking promise.
- Display source-content readiness status separately from AI-answer correctness.

### S8. Monitoring (`/monitoring`) — V2
- Saved monitoring scope and “Weekly” preference (persisted UI only; not an actual background job).
- **Run simulated recheck now** creates a deterministic second snapshot for identical prompts, selected locations, evaluation rules and source context.
- Comparable before/after summaries show **numerator and denominator**, uncertainty and unchanged answers; no fabricated attribution.
- Location/region trend table, alerts for **human-verified critical inaccuracies**, and basic competitor co-mention summary (the competitor's presence is not a market-share claim).
- **Optional second simulated surface** labeled **Surface B — conceptual multi-engine expansion**. Any trend comparison must be within a like-for-like source; do not merge surfaces into a misleading headline percentage. Do not present four production AI integrations as delivered.

### S9. Reports (`/reports`)
- **MVP:** executive audit snapshot: sample scope, platforms/proxy, prompt mix, observed mentions, verified issues, methodology and limitations; functional CSV download and print-friendly PDF through browser print.
- **V1:** source validation, generated markup/fact-sheet status, approvals and correction tasks.
- **V2:** matched recheck table, source-change annotations, critical issues and unresolved risks.
- Separate **Observed AI result**, **Verified source action**, and **Hypothesized business value** visually.

---

## 6. Data contracts and reproducible demo behavior

Use deterministic local fixtures and browser state. Preserve existing types; extend where needed:

```ts
Organization { id, name, sector, totalLocationCount }
Location { id, organizationId, name, neighborhood, city, region, verifiedFields, verificationStatus, lastVerifiedAt }
BusinessFact { id, locationId, key, value, verificationStatus, verifiedBy?, verifiedAt?, sourceOwner, applicability }
SourceRecord { id, locationId, channel, content, observedAt?, simulated: true, managedByCustomer: boolean }
PromptTemplate { id, intent, category, text, includeInDiscoveryMetric, eligibleLocationIds? }
Audit { id, createdAt, locationIds, promptIds, surface, status, mode: 'self-serve'|'assisted' }
Observation { id, auditId, locationId, promptId, sampledAt, answerText, mentionedBrand, mentionedLocation, extractedClaims[], citations[], reviewStatus, simulated: true }
Issue { id, observationId, locationId, category, severity, state, reviewNotes, possibleSourceIds[] }
Task { id, issueId, locationId, assignee, controlledChannel, status, dueAt, approvedBy?, activity[] }
StructuredAsset { id, locationId, kind: 'json-ld'|'fact-sheet', generatedFromFactIds[], payload, validationWarnings[], approvalStatus }
PublicationRecord { id, assetId, channel, owner, state, approvedAt?, updatedAt?, simulated: true }
Recheck { id, priorAuditId, cohortFingerprint, source, sampledAt, observations[] }
```

**Metric definitions:**
- **Sampled unbranded location mention rate** = eligible, completed, unbranded local-discovery observations mentioning the correct location / all eligible completed unbranded local-discovery observations. Show `n/N` and exact scope.
- **Brand mention** and **specific location mention** are separate fields; do not treat a brand-only mention as branch-level visibility.
- **Locations mentioned** = locations included in at least one relevant unbranded sampled response, not the total network covered.
- **Confirmed factual mismatches** = user-reviewed claims conflicting with independently verified facts. If source truth is incomplete, use **Needs verification**, not Wrong.
- **Markup readiness** = percentage of eligible, approved fields correctly represented in a valid generated output, **not** GEO/AI ranking success.
- **Source-correction completion** = approved tasks marked Source updated; **not** proof an AI answer changed.
- **Recheck delta** = comparison of the **same location + normalized prompt + surface/proxy + contextual settings + evaluation version**. Exclude unmatched records, show denominators, and label variance/unknowns.
- **Competitor observations** = count/share of mentions **within the sampled answer set only**, never actual market share or audience reach.

**Fixtures:** 150 fictional locations; default audit of 10 centers × 8 prompts × 1 surface = **80 observations**. Maintain consistent data across screens. Seed a mix of mention, omission, correct facts, factual mismatch, uncertain claims, missing source facts, suspected source conflicts and post-recheck persistence/change. All sample source URLs use `.example`. No real preschool customer records.

---

## 7. Product success and business validation

**North-star candidate (pilot):** **Number of verified, actionable AI-representation issues progressed to a documented controlled-source resolution per active pilot account**, accompanied by a coverage/quality guardrail. This is a product-value hypothesis—not evidence of ranking improvements.

| Phase | Customer success evidence | Business success evidence | Delivery / quality guardrail |
|---|---|---|---|
| MVP | Users can review findings, identify useful issues, and distinguish observation from confirmed error | Enterprises agree to run/expand pilot; sales demos convert to next step | Matched factual checks accurate against verified seed; run/report functional; cost estimate documented |
| V1 | Users publish/hand off an approved source correction with valid, traceable outputs | Existing listing/content workflows used; customers express willingness to pay | No unverified fields presented as truth; no external writes without authorization |
| V2 | Users detect whether confirmed errors persist and compare equivalent rechecks | Pilot repeat usage, expansion discussions, paid intent | Same-cohort methodology, no causal attribution, bounded monitoring cost |

For the hiring deck, include **success thresholds only as explicit pilot targets to validate**, not as fabricated outcomes. Collect basic qualitative feedback on willingness to pay, discoverability concerns, and effort saved. Actual customer revenue impact is outside the prototype's measurable scope.

---

## 8. Design system and usability

- Respect existing repository styling and components first. New GEO screens should feel like the **same ProManage product**, not a second standalone UI.
- Brand inspiration from `promanage.ai`: calm light-first enterprise dashboard, turquoise/teal cues, actionable blue, white/soft-gray surfaces, restrained borders/shadows and concise copy. **Tokens are approximations**, not verified official color values.

```css
:root {
  --brand-teal: #11B7C6;
  --brand-blue: #286FE8;
  --ink: #16243A;
  --body: #45546B;
  --muted: #738097;
  --canvas: #F6F9FC;
  --surface: #FFFFFF;
  --border: #E3EAF1;
  --success: #16845D;
  --warning: #B7791F;
  --danger: #CD4B59;
}
```

- Main desktop targets: **1440×900 and 1280×800**; usable tablet/mobile layout.
- Preferred UI: clear 8px spacing rhythm, 12px cards, 48–56px rows, real focus states, accessible semantics and keyboard interactions.
- **Color semantics:** verified errors can be red; unreviewed omissions are neutral/amber; verified source updates green; **Awaiting AI recheck** amber, not green-success.
- Always show **Simulated** status. Display raw generated markup in a readable, copyable code editor/preview pane.
- Avoid fabricated precision, dead buttons, overdecorated gradients, illegible microtext, overloaded dashboards and copy-heavy descriptions.

---

## 9. Engineering plan for the existing codebase

**Suggested stack if not already implemented:** React + Vite + TypeScript + Tailwind + shadcn/ui + Lucide + Recharts + React Router. If existing repo uses equivalent libraries, **reuse them**. No platform re-scaffold.

**Before coding:** inspect package manager, routes, component library, current `seed` data, metrics calculation, existing role/release gating, tasks and export behavior. Identify reusable modules. Preserve data/localStorage migrations where safe; provide a reset option for old fixtures.

**Suggested modules/extensions:**
- `src/features/geoReadiness/` — business-fact review, source diff, markup preview, fact-sheet preview, publication status.
- `src/lib/geoMarkup.ts` — deterministic output from verified facts; escaping/HTML-safe output; validation warnings; appropriate schema type mapping.
- `src/lib/metrics.ts` — preserve/extend audited KPI calculations and cohort comparisons.
- `src/services/mockAuditService.ts` — deterministic observations, no external calls.
- `src/data/seed.ts` — BrightNest scenarios, source snapshots, missing fields, issue/task/recheck snapshots.
- Existing route config — add `/geo-readiness/:locationId`; connect issue/action navigation.

**Functional contract:** selected-location filters, prompt edits, role switch, feature gating, upload validation, start audit/progress, evidence review, create task, approval, markup generation, copy/export JSON-LD, export fact-sheet HTML, simulated source completion, recheck, CSV, printable report and reset must work. No inert primary buttons.

**Safety/security:** do not execute AI-generated HTML as code; use safe rendering/escaping; limit CSV input size; do not store actual client data; use only fictional assets/URLs; do not expose API keys or call real external endpoints.

**Suggested build sequence for Claude Code:**
1. Confirm the existing prototype runs; take baseline screenshots.
2. Extend shell navigation, user roles and release gates **without regressing MVP**.
3. Extend MVP with assisted audit workflow and print-friendly executive output.
4. Connect issue review and tasks to verified/source record models.
5. Implement new GEO Readiness tabs, safe JSON-LD/fact-sheet exports and approval states.
6. Extend V2 rechecks, source annotations, basic competitor observations and reports.
7. Test all buttons, route changes, metrics, states and exports. Fix regression bugs.

**No backend is required for the prototype.** `npm install && npm run dev` (or the existing repo's equivalent) must work locally.

---

## 10. Definition of done / acceptance checks

### Preserve existing prototype
- [ ] Existing navigation, location fixtures, audit flow, role/release controls and results still work.
- [ ] All roadmap modes run within one app and show intended feature availability.
- [ ] Existing user states migrate or reset cleanly; no duplicate dashboards or disconnected data.

### MVP
- [ ] 10 × 8 × 1 audit generates 80 reproducible demo observations with consistent KPIs.
- [ ] Branded factual checks are excluded from discovery mention rate.
- [ ] Non-mentions are observations, never automatic verified errors.
- [ ] Data gaps are **Cannot evaluate**, not contradictory false facts.
- [ ] Assisted persona can choose seed locations or preview a valid/invalid CSV locally.
- [ ] CSV export downloads; printable HTML executive report opens and prints cleanly.

### V1
- [ ] Issue detail links to **GEO Readiness** for the correct location.
- [ ] Verified/unverified/missing business facts and source diffs display correctly.
- [ ] General hours are not confused with Saturday-tour availability.
- [ ] JSON-LD includes **only verified, appropriate fields**, with safe escaping; Copy and Download actions function.
- [ ] Fact sheet previews approved information and exports as safe HTML.
- [ ] Business approval and source publication-task state transitions are functional.
- [ ] Marking **Source updated** does not automatically mark the AI answer fixed.

### V2
- [ ] Baseline and recheck use the same cohort and report `n/N` consistently.
- [ ] Some results improve, others persist, without asserting cause.
- [ ] Critical alerts are limited to verified materially wrong claims; repeated alerts are deduplicated.
- [ ] Competitor observations are labeled sampled, not market share.
- [ ] Optional second simulated source is not combined into invalid cross-platform comparisons.

### Experience and delivery
- [ ] Working routes, loading/empty/error states, responsive interface and keyboard accessibility.
- [ ] End-to-end demo reliably fits **4–6 minutes**.
- [ ] No misleading live-API claims, guaranteed crawl/indexing, ranking lift or sales attribution.
- [ ] Type check and production build pass; primary paths are clicked through in a browser if tooling is available.
- [ ] Final handoff includes updated route map, run command, screenshots, what is simulated, known limitations and changed files.

---

## 11. Recommended 4–6 minute walkthrough

1. **MVP (60–90 seconds):** Open Overview → create 10-location audit → choose prompts → run → identify Whitefield mismatch → print executive report.
2. **V1 (2 minutes):** Review evidence → open **GEO Readiness** → validate tour schedule vs website info → generate JSON-LD/fact sheet → create and approve a content update task → mark source updated **awaiting recheck**.
3. **V2 (60–90 seconds):** Open Monitoring → run matched recheck → show observed changes and unchanged answers → export executive progress report.
4. **Wrap (20 seconds):** Customer gets observable, actionable findings; ProManage extends existing data/listings workflows; no claim to control the AI engine.

### Suggested one-line summary for the six-slide hiring deck
**MVP: Detect AI representation gaps → V1: Optimize verified, controlled source information → V2: Monitor comparable AI-answer outcomes at enterprise scale.**

---

## 12. Instructions to Claude Code (read this last)

You are modifying an **existing interactive ProManage AI Visibility prototype**, not building from scratch. Read this document and inspect the repository before editing. Preserve working code and interactions, reuse the app's current stack, and follow MVP → V1 → V2 feature gates.

The **new V1 centerpiece is the GEO Readiness Studio**. Implement its complete verified-facts → JSON-LD / fact sheet preview → approval → publication-task workflow, connect it to the existing issue inbox and task system, and retain clear uncertainty around AI results. Add the MVP assisted executive audit and the V2 monitoring enhancements as scoped above.

Use deterministic **fictional** BrightNest data; no live AI API calls, real business data, website writes, scraper/proxy rotation, guaranteed indexing or direct AI-model control. All primary UI actions must work. Test the app locally and provide changed files, route map, screenshots if available and limitations.

**Demo path:** `/overview` → `/audits/new` → `/audits/demo-001` → `/locations/whitefield/answers` → select **V1** → `/issues/issue-saturday-tours` → `/geo-readiness/whitefield` → `/tasks` → select **V2** → `/monitoring` → `/reports`.
