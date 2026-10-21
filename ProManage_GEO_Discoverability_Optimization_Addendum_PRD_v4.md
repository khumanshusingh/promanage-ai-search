# ProManage AI Visibility — Discoverability Optimization
## PRD v4.0 · Incremental addendum to the existing application

**Status:** Implementation-ready specification for a fictional interactive PM hiring-assignment prototype  
**Intended implementer:** Claude Code, working in the **existing repository**  
**Related specifications:** `ProManage_GEO_Detect_to_Resolution_PRD_v3.md`, `ProManage_GEO_Brand_First_UX_Redesign_Claude_Brief.md`, and any updated core prototype PRD already in the repository.  
**Product placement:** Existing ProManage → Insights & Analytics → AI Visibility. **Do not create a new app or a fifth standalone product.**  
**Primary goal:** Add a **Discoverability Improvement** journey *alongside* the existing **Information Accuracy Resolution** journey.

> **Non-negotiable:** Preserve the working application, its BrightNest demo data, existing audits, issue resolution, GEO Readiness, Brand/ProManage role selection, exports, and MVP/V1/V2 release switch. This document specifies an **addition**, not a replacement. Inspect the actual repository first. Where older instructions conflict about discoverability, this addendum wins; otherwise retain prior working behavior.

---

## 1. Problem, users, and product promises

### Customer problem

An enterprise with hundreds of outlets cannot reliably see whether an eligible local outlet is *mentioned in sampled AI-generated recommendations* for relevant, unbranded customer questions. When an outlet is repeatedly absent, its team lacks a straightforward way to find **controllable discoverability-readiness gaps**, approve truthful improvements, and observe later changes.

**Example (fictional):** A parent asks: “What are the best Montessori preschools in Whitefield, Bengaluru?” BrightNest Whitefield is relevant and has a verified Montessori offering, yet it is missing from several sampled AI answers. This is an **observed non-mention**, not proof of a search-engine defect or lost sales.

### Two journeys inside one product

| Journey | Observation | Brand question | ProManage role | Product outcome |
|---|---|---|---|---|
| **Information Accuracy Resolution** (already exists) | AI mentions outlet but states wrong business facts | “Is this information correct?” | Investigate sources and coordinate factual corrections | Better controlled-source accuracy; later AI answers rechecked |
| **Discoverability Improvement** (**NEW**) | Relevant outlet not mentioned in sampled unbranded recommendations | “Is my store a good match, and can we improve its online information?” | Verify relevance, audit public information, prepare optimization plan and track outcome | Measurable content/listing readiness; later sampled mentions rechecked |

### Business value hypotheses (not claims of observed success)

- **Brand:** Greater visibility into possible discovery gaps; easier-to-approve factual changes; less manual coordination; documented status and follow-up results.
- **ProManage:** Increased use of existing Listing Management + Insights; improved enterprise retention/expansion potential; possible paid GEO optimization service or add-on.
- **Not promised:** Ranking first, inclusion in ChatGPT/Gemini/Claude, guaranteed citation, guaranteed traffic/footfall/revenue lift, access to private user prompts, or proof that content change caused a later recommendation.

### Exactly two top-level roles

**Brand (default; nontechnical).** Enterprise marketing/operations users. Can review relevant missed mentions, answer business questions, verify offering and location, approve/reject proposed factual content, monitor completion and sampled rechecks, access plain-language reporting.

**ProManage (internal).** Customer success, operations and technical staff. Can design prompts, validate relevance and coverage, inspect source evidence, configure technical audits, draft factual content/markup, prepare approvals, record publication evidence, run comparative rechecks and report technical limitations. **Cannot approve business facts on behalf of Brand** or claim any external system has been changed unless supported by simulated evidence and explicitly labeled.

---

## 2. The guiding user journey

**Discover → Qualify → Diagnose → Recommend → Approve → Implement → Recheck.**

1. **Discover:** A sampled answer omits BrightNest Whitefield for a relevant unbranded question.
2. **Qualify:** ProManage checks whether the location/offer actually matches the question. Brand confirms the real services and area served when needed.
3. **Diagnose:** ProManage reviews official location page, connected listing attributes, accessible source information, technical accessibility and relevant competitor evidence.
4. **Recommend:** ProManage offers a *specific, evidence-backed* improvement plan only for supported gaps, with clear ownership and effort.
5. **Approve:** Brand verifies and approves each business claim or explicitly requests changes.
6. **Implement:** ProManage prepares content and technical assets and coordinates publishing on authorized controlled sources; third-party correction requests are tracked separately.
7. **Recheck:** Comparable prompts are rerun; app reports observed mention changes with sample sizes, caveats and next actions.

**Important causal boundary:** Even a confirmed website/listing gap does **not** prove that this gap caused the original AI non-mention. An observed improvement does not prove the intervention caused it.

---

## 3. Release strategy and boundaries

| Phase | Promise | ADD to existing app | Deliberately OUT |
|---|---|---|---|
| **MVP (Weeks 1–4)** | “Show where eligible locations are/aren't mentioned.” | Discoverability observation card, unbranded-query breakdown, location relevance review, `Worth investigating` / `Not relevant` actions, scoped export | Algorithmic root-cause diagnosis, AI ranking manipulation, automated content publishing |
| **V1 (Weeks 5–8)** | “Show what we can improve and help get it done.” | ProManage Readiness Audit, evidence-backed checks, content/technical recommendations, plain Brand approval screen, optimization task + approval + publication handoff, documented status | Auto crawl/edit every enterprise site, mandatory 40–60-word formula, paid backlinks/review manipulation, forced AI ingestion |
| **V2 (Weeks 9–12)** | “Track changes and learn from comparable checks.” | Saved small-cohort monitoring, matched recheck, before/after mention counts, action annotations, persistent-gap outcomes, simple Brand report, internal technical breakdown | Exhaustive multi-engine tracking, guaranteed causal attribution, frequent unlimited crawling, direct visibility into real end-user queries |

**Capacity realism:** The hiring-assignment constraints are two engineers and four weeks per phase. The prototype itself remains **deterministic, fully simulated, and frontend-only** unless the existing repository already has safe infrastructure. Build no real API integrations, web crawlers, listing updates, or public-content publication as part of this change.

**Prioritization for V1:** Build **source/listing completeness → evidence-backed content suggestions → approval & task execution** first. Crawler checks / schema generation should reuse existing GEO Readiness functionality rather than introducing a second implementation. Advanced off-site authority research and competitor deep-dives may be clearly labeled optional/internal if time allows.

---

## 4. Full end-to-end scenarios (scriptable in the app)

### UC-D1 — MVP: Whitefield is absent from a relevant unbranded AI answer

**Actor:** Brand marketer; **supported by:** ProManage; **preconditions:** BrightNest Whitefield exists in seeded master locations; verified Montessori service and Whitefield location are available.

1. Open **Brand → Overview → Discoverability opportunities** (or `My Locations → Whitefield → Visibility`).
2. See the exact **simulated** customer question and recorded AI answer: “Best Montessori preschools near Whitefield, Bengaluru.”
3. See `BrightNest Whitefield was not mentioned in this sampled response` and a contextual note: `Not mentioned is not necessarily an error.`
4. Open `Why this might matter` (optional): eligible local parents could miss the brand *through this answer*, but real customer impact is unknown.
5. Brand selects `Worth investigating` or `Not relevant to this search`. If eligible verified facts are missing, choose `Confirm this service` / `Ask ProManage to review`.
6. Persist a **Discovery Opportunity**, linked to the audit observation and location. It is **not** counted as a confirmed factual mismatch.

**Result:** Discovery candidate saved for review; visible in ProManage Investigations. **No error severity implied merely by omission.**

### UC-D2 — MVP: Not an eligible match (negative control)

1. Prompt says `Best international boarding schools in Whitefield` (or another service BrightNest does not provide).
2. BrightNest is not recommended.
3. ProManage/Brand mark `Not relevant to this search` and choose the reason: service mismatch, geography mismatch, closed/inactive location, ambiguous query or other.
4. Exclude the observation from *eligible mention-rate denominator* and recommendation queue, while retaining raw sample evidence.

**Result:** No fabricated discovery issue, no generated content claiming BrightNest offers unsupported services.

### UC-D3 — V1: Official location page omits a verified service (primary optimization case)

**Actor:** ProManage prepares; Brand approves. **Trigger:** Whitefield Discovery Opportunity is marked Worth investigating.

1. ProManage clicks `Investigate discoverability` from the existing linked issue/observation.
2. ProManage sees verified location + Montessori offering, sample omission evidence, current official landing-page snapshot and connected listing fields.
3. The **simulated official page** lists preschool admission information but omits the verified Montessori programme. Mark `Confirmed on-page information gap`; NOT `Confirmed cause of AI omission`.
4. ProManage selects `Prepare improvement plan` with a human-readable explanation and checks: add truthful Montessori description, add parent-relevant FAQ, include accurate opening/contact/service details, ensure service appears in managed listings if supported.
5. Internal editor generates a concise introductory answer (length flexible; 40–60 words is an **optional editorial test**, never mandatory), H2/H3 questions derived from true customer intents, factual paragraphs, and citations **only for real verifiable claims**. Existing GEO Readiness can prepare appropriate structured-data snippets.
6. Brand receives a plain-English side-by-side `Current info` / `Proposed info`, plus exact business claims requiring approval. **Approve / Request edits / Decline** must work.
7. After approval, create `Website content handoff` and `Managed listing update` tasks with owners. Simulate authorized implementation only after status/evidence confirmation.
8. Plan moves to `Updates recorded — awaiting next AI check`, not `Discoverability fixed`.

**Result:** An approved, specific, published-or-handoff improvement plan recorded against the relevant location; downstream AI results not auto-altered.

### UC-D4 — V1: Connected listing missing a verified service

1. ProManage compares approved Montessori offering to simulated connected Google Business Profile service/category fields.
2. Finds a missing relevant *supported* listing attribute. Mark `Managed listing incomplete` (not evidence the AI omitted BrightNest because of it).
3. Open/extend **existing Listing Management** via deep-link/contextual task; do not build a duplicate editor.
4. ProManage prepares update; Brand approves verified facts; authorized source task is marked updated **only with simulated handoff evidence**.
5. Await recheck.

**Result:** Reuses ProManage's location-data advantage; service availability remains verified, not invented.

### UC-D5 — V1: Website content is accessible but lacks helpful answers

1. Prompt: `Which preschools offer Saturday visits near Whitefield?` Brand confirms that Whitefield offers Saturday *appointments* from 10 AM–1 PM, distinct from regular centre hours.
2. Simulated location webpage mentions the centre but omits visiting policy.
3. ProManage drafts a `Can I visit on Saturday?` section with the **actual** booking restriction and approved hours. The text clearly distinguishes tours from normal operating hours.
4. Brand reviews/approves exact details. ProManage exports a content handoff.
5. Publishing changes source readiness; the original AI answer is untouched until V2 recheck.

**Result:** Accurate, parent-friendly content—not keyword stuffing or a fabricated opening-hours claim.

### UC-D6 — V1: Technical accessibility or structured-data problem

1. ProManage opens `Technical readiness` on a Discovery Opportunity.
2. A **seeded, simulated** technical check finds one of: non-indexable location page, stale/incorrect sitemap metadata, missing supported local-business structured attributes, or relevant crawler access policy restrictions.
3. Show evidence type and `Needs site-owner confirmation` for cases a static mock cannot validate. Explain that crawlers/providers differ; never say that an FAQPage tag or an AI-only facts endpoint guarantees inclusion.
4. ProManage proposes a scoped technical fix or structured-data export **reusing GEO Readiness**. Verify URL/indexability facts before recommending action; validate markup with existing logic where supported.
5. Brand sees only: `Make the Whitefield location page easier for supported search systems to access`, expected team owner, and approval if business content changes. ProManage performs technical handoff.

**Result:** Technical readiness improved (simulated), separate from AI recommendation outcome.

### UC-D7 — V1: External directory or third-party mention gap

1. ProManage finds an inaccurate or missing listing on an accessible third-party directory, or that a cited source references an old branch.
2. Distinguish: **managed source** (may update with authorization), **third-party source** (request correction), and **uncontrolled user-generated source** (do not manufacture mentions).
3. Prepare legitimate correction request with verified details, owner, and submission status; no fake confirmed publication.
4. If considering genuine reviews, case studies, or media, suggest **truthful customer experience and outreach**, never buying reviews, posting fake Reddit/Quora mentions, paying for undisclosed endorsements, or fabricating citations.
5. Brand approves factual details; ProManage tracks request status.

**Result:** Source coverage work recorded without implying third-party acceptance or ranking benefits.

### UC-D8 — V1: No actionable gap is found

1. ProManage inspects owned page, structured data, linked listings, genuine service information and available sources.
2. All inspected materials are complete and consistent; the location still is not mentioned in sampled AI recommendations.
3. Mark `No controllable information gap found` and `Monitor this query` rather than inventing work.
4. Brand sees a simple explanation: `Your published information looks complete in the sources we checked. AI engines choose their own recommendations, so we'll keep tracking.`

**Result:** Honest no-op, optionally an experiment proposal; no dubious recommendation.

### UC-D9 — V2: Positive sampled mention change after approved updates

1. ProManage runs `Recheck` against the same eligible location, normalized unbranded prompts, language, geographical context, measurement surface/proxy and evaluation rules, to the degree supported by the simulated source.
2. An example *fictional* matched cohort shows BrightNest mentioned in **1/4 before** and **3/4 after**. Show the counts alongside percentages; use a repeated-run caveat because N=4 is small.
3. ProManage records which content/listing changes were approved, when they were reported published, and whether a matching recheck exists.
4. Brand sees: `BrightNest appeared in more of the selected AI checks`, with date, exact scope and `This is an observed change, not proof the updates caused it.`
5. Never mark `Guaranteed GEO success`, and don't infer increases in customers or revenue.

**Result:** An observed, scoped improvement for the same cohort.

### UC-D10 — V2: No improvement after source updates

1. Recheck finds the location still absent across the same selected prompts.
2. Brand sees `Still missing from the latest sampled answers` and `ProManage is reviewing next steps`; no red “failure” badge implying platform defect.
3. ProManage can inspect additional source candidates or create a **new, separately approved** experiment; retain original observations and previous plan history.
4. If conditions aren't comparable, mark `Inconclusive — measurement conditions changed` instead of showing a misleading trend.

**Result:** Honest persistent observation with next actions rather than a false success state.

### UC-D11 — Cross-journey: Both facts are wrong AND recommendations are limited

1. An outlet has a **confirmed incorrect phone number** in a sampled AI answer and low mention rate in eligible unbranded prompts.
2. Create **two linked but independent records**: Factual Mismatch Issue and Discovery Opportunity.
3. Brand sees one location page with two understandable cards: `Correct contact information` and `Improve discovery readiness`.
4. ProManage may bundle an *authorized source correction* into one execution task if the same webpage needs updating, but must keep **separate metric accounting** and recheck outcomes.
5. Closing the factual correction never automatically closes the discovery observation, and vice versa.

**Result:** Shared implementation work; independently truthful outcomes.

---

## 5. Product information architecture and UI requirements

### Brand view (default; simple, nontechnical)

**Preserve top-level navigation from the Brand-first redesign:** `Overview · My Locations · Needs My Attention · Progress · Reports`. Do not add “SEO”, “GEO Optimization”, “JSON-LD”, “Prompt Runner”, or “Crawler Settings” as Brand sidebar destinations.

**Brand Overview:** Add a small `Discovery opportunities` card *separate from factual errors*:

- `Selected searches where locations were not mentioned` (include counts and scope; show “opportunity” not “issue”).
- `Locations worth reviewing` (only eligible and reviewed/qualified, not all omissions).
- `Improvements awaiting approval` and `Updates being handled`.
- One next-action CTA: `Review suggested improvements` when a proposal awaits approval, or `Ask ProManage to investigate` when not yet diagnosed.

**Brand Location detail:** Use two distinct cards/tabs: `Information accuracy` and `Being found in AI search`.

- `Being found in AI search` shows exact selected question, time/source label, `mentioned / not mentioned`, short caveat, optional examples of competing mentions if evidence exists.
- Plain controls: `Worth investigating`, `Not relevant`, `Confirm our services`, `View improvement plan`, `Track updates`, `View latest check` according to state. Exactly one dominant CTA per state.

**Brand Improvement Plan detail:** Summary: `What we noticed` → `What we found` → `What we recommend` → `What we need from you` → `Progress`.

- Use cards with **specific pages/listings and factual changes**, before/after business copy, owner and expected outcome; do not surface schemas or raw JSON by default.
- Brand-only buttons: `Approve plan`, `Request changes`, `Decline` and `Confirm facts`.
- Do not label recommendations “Fix AI ranking.” Show `Make accurate information easier to find and understand`.

**Brand Progress:** Existing unified progress feed includes both tracks, but each record displays `Accuracy` or `Discovery` category. Business task state and later AI observation are shown separately.

**Brand Reports:** Add separate sections `Information accuracy` and `Discoverability checks`, with exact sample sizes and dates, completed controlled-source improvements, unmatched or inconclusive checks. Don't hide denominators.

### ProManage view (technical work remains internal)

Keep existing ProManage sidebar and add a **contextual sub-tab** under current `Investigations` / `GEO Readiness` called `Discoverability` or `Optimization opportunities` (reuse navigation where possible). **Do not add an entire duplicate module tree**.

**ProManage Investigation:** Show source evidence with provenance, owner, last-inspected stamp and verification state. Separate:

- `Observed AI result`: not mentioned / mentioned / ambiguous.
- `Eligibility`: eligible / not eligible / unknown, with reason and reviewer.
- `Verified gap`: a documented content/listing/technical gap.
- `Cause of non-mention`: **unknown unless there is genuinely direct evidence**.

**ProManage Discoverability Readiness checks** (phase-gated V1):

| Check | Evidence/result | What to recommend if confirmed | Notes |
|---|---|---|---|
| Official location page exists, contains correct business facts | Page snapshot / verified facts | Add missing, truthful location and service details | Do not promise indexing |
| Direct answers and helpful FAQ coverage | Selected intent vs page text | Short factual summary + genuine question headings | 40–60 words optional, not rule |
| Clear, simple language and factual proof | Content diff; verified source | Edit for clarity; support claims with real evidence | Never invent stats/prices/reviews |
| Connected listing service/category completeness | Listing attributes vs verified business fact | Reuse Listing Management handoff | No duplicate GBP editor |
| Location entity / structured data | Existing GEO Readiness validation | Generate suitable JSON-LD preview/export | Only applicable verified fields; schema type appropriate |
| Website accessibility and indexability | Simulated crawler/sitemap/robots evidence | Recommend site-owner audit/handoff | No fake live index checks |
| Recency and publication evidence | Actual/simulated last approved/updated dates | Correct timestamps or sitemap metadata if truly warranted | Do not forge freshness signals |
| Genuine off-site information | Inspect supported directories/citations | Request fact corrections or real editorial outreach | No manufactured authority/reviews |
| Competitors in sampled AI answers | Parsed mentions with raw answer | Context for investigating content differences | Not causal proof or fake share of market |

**Internal Recommendation Composer (V1):** Choose only findings with evidence and controllable action; for each recommendation capture title, affected location/URL, verified factual claim(s), current state, proposed replacement, effort band, intended owner, confidence in **gap observation**, uncertainty on AI impact, and publication dependency. Permit generated copy with editorial review. A CTA `Send to Brand for approval` creates/reuses the existing approval record and task system.

**GEO Readiness:** Reuse existing verified-data + JSON-LD + fact sheet + publication status screens. Add a `Content improvements` section with a diff and approved FAQs/answer text, not a second schema generator.

**No automatic one-click live web changes** in the prototype. All sources and changes remain labeled demo/simulated.

---

## 6. Status model and permissions

**Keep the existing accuracy `Issue` and `Task` statuses. Do not reuse error states for non-mentions.**

### Discovery Opportunity status (new, separate)

`Observed → Eligibility review → Qualified / Not relevant / Insufficient evidence → Investigating → Proposal ready → Awaiting Brand approval → Approved / Changes requested / Declined → Implementing → Source update recorded → Awaiting recheck → Rechecked (mention observed / still absent / inconclusive) → Monitor / Archived`

Implement as **one underlying status + subsidiary review/plan/action/recheck facts**, if simpler; do not create contradictory parallel state flags. The UI must derive Brand-friendly progress from those facts.

| Action | Brand | ProManage |
|---|---|---|
| Mark sampled omission worth investigating | Yes | Yes |
| Verify business service and location facts | Yes | Request only |
| Mark eligibility after verifying business facts | Confirm service facts | Yes, with recorded evidence |
| Run technical/source-readiness checks | See summarized result | Yes |
| Draft plan/content/technical assets | Provide source facts & request changes | Yes |
| Approve/reject final factual claims and plan | **Yes** | No |
| Record simulated publication/technical handoff | See status, not falsely certify external completion | Yes, evidence required |
| Configure recheck and technical comparison | Request/review | Yes |

**Release gating:** MVP includes observed/eligibility states; V1 adds investigation, proposal, approvals and implementation; V2 adds recheck/history/monitoring. Maintain persistent role switch and release-mode control from current prototype, without making release labels the Brand's production information architecture.

---

## 7. Data model additions (extend, do not replace)

Use existing entity IDs and relationships where possible. Suggested TypeScript shape:

```ts
type DiscoveryOpportunity = {
  id: string;
  organizationId: string;
  locationId: string;
  observationIds: string[];
  intentCategory: string;
  promptGroupId: string;
  eligibility: 'eligible' | 'not_relevant' | 'unknown';
  eligibilityReason?: string;
  reviewedBy?: string;
  status: string; // constrained enum in implementation
  createdAt: string;
  lastUpdatedAt: string;
  readinessFindingIds: string[];
  planId?: string;
};

type ReadinessFinding = {
  id: string;
  opportunityId: string;
  category: 'content' | 'listing' | 'structured_data' | 'crawl_access' | 'freshness' | 'offsite';
  surfaceLabel: string;
  inspectedAt: string;
  evidenceType: 'simulated_snapshot' | 'verified_business_fact' | 'user_confirmed';
  sourceOwner: 'brand' | 'promanage_managed' | 'third_party' | 'unknown';
  observation: string;
  confirmedGap: boolean;
  factualEvidenceIds: string[];
  certainty: 'confirmed_gap' | 'potential_gap' | 'unknown';
  recommendedAction?: string;
};

type OptimizationPlan = {
  id: string;
  opportunityId: string;
  createdBy: string; // ProManage actor
  status: 'draft' | 'awaiting_brand_approval' | 'approved' | 'changes_requested' | 'declined' | 'in_progress' | 'source_update_recorded' | 'awaiting_recheck';
  recommendations: Array<{
    id: string;
    findingId?: string;
    controlledSource: string;
    owner: string;
    title: string;
    currentText?: string;
    proposedText?: string;
    businessFactIds: string[];
    requiresBrandApproval: boolean;
    technicalAssetIds?: string[]; // reuse existing GEO Readiness assets
  }>;
  brandApprovalBy?: string;
  brandApprovalAt?: string;
  approvalComment?: string;
  taskIds: string[];
  publicationEvidenceIds: string[];
};

type DiscoveryRecheck = {
  id: string;
  opportunityId: string;
  baselineAuditId: string;
  recheckAuditId: string;
  normalizedPromptKeys: string[];
  locationId: string;
  measurementSurface: string;
  comparable: boolean;
  nonComparabilityReason?: string;
  baselineMentionCount: number;
  baselineEligibleCount: number;
  recheckMentionCount: number;
  recheckEligibleCount: number;
  sampledAt: string;
  outcome: 'mention_observed' | 'still_absent' | 'mixed' | 'inconclusive';
  simulated: true;
};
```

**Reuse** existing `Location`, `BusinessFact`, `PromptTemplate`, `Audit`, `Observation`, `Issue`, `Task`, `Approval`, `SourceSnapshot`, `Publication` and monitoring records where present. Prefer selectors and a small feature slice over major state migration.

### Metrics: separate the denominators

- **Eligible unbranded location mention rate:** eligible, completed unbranded discovery observations that mention the correct **outlet** / eligible, completed unbranded discovery observations. Show `n/N`, prompts, locations, sample surface and timeframe. **Brand mention only** ≠ outlet mentioned.
- **Discovery opportunities:** reviewed eligible omissions worth investigating; NOT total absent mentions, and NOT factual mismatches.
- **Confirmed controllable gaps:** readiness findings supported by observed source evidence, separate from missing AI mentions.
- **Approved plan implementation:** approved recommendations with recorded source completion / total approved recommendations; not an AI success metric.
- **Matched recheck:** compare same normalized prompt + outlet + surface + geo context + language + evaluation rules, display `before n/N → after n/N`, or `inconclusive` if not comparable.
- **Do not create** an ungrounded AI ranking score, market share estimate, real-user visibility share, or sales attribution estimate.

---

## 8. Demo fixtures and deterministic interactions

Keep original demo: **fictional BrightNest Preschools; 150 locations; 10 selected Bengaluru locations; 8 prompts per location (5 unbranded + 3 branded); 1 simulated audit source = 80 observations.** Reuse existing observation IDs and KPI calculations when possible; don't invent a separate audit dataset that contradicts existing cards.

Add controlled fixture records:

1. **Whitefield (primary):** eligible Montessori + local geography; not mentioned in selected unbranded simulated answers; official centre page lacks Montessori details; GBP service field incomplete; Brand can approve appropriate content/managed-listing improvement. An example matched four-prompt subset can show **1/4 → 3/4** only if the underlying observation fixture and rendered metric agree. Otherwise show exactly the data the fixtures produce.
2. **HSR Layout (existing accuracy):** incorrect hours answer; unchanged existing accuracy correction journey. Can also have discovery observation but must remain separate.
3. **Indiranagar (persistent):** relevant location still absent or only inconsistently mentioned despite documented update; show `Still absent in latest sampled checks`.
4. **Nonrelevant case:** a prompt for a service the centre does not provide; mark Not relevant and exclude from eligible metric.
5. **All sources correct:** no verified controllable gap; present `Monitor only` without fabricated action.
6. **Inconclusive recheck:** changed prompt/service/model context; hide percent change and show explanation.

All simulated documents/URLs use `.example`; no real brand ratings, real customer data, actual search results, real public pages or fabricated citations presented as factual. No `fetch` to external websites for the demo, no provider API key requirements, no real publishing.

---

## 9. UI text dictionary (Brand-first)

| Technical/internal | Brand wording |
|---|---|
| AI non-mention detected | `Your centre wasn't mentioned in this selected AI answer` |
| Potential discovery gap | `Opportunity to improve how your centre is found` |
| Eligibility validation | `Does this search match what your centre offers?` |
| Readiness audit | `We checked the information available about this centre` |
| Content optimization | `Make your centre information more complete and helpful` |
| Structured data / JSON-LD | `Technical information prepared by ProManage` |
| Crawlability / robots.txt | `Page accessibility check` |
| AI citation investigation | `Where the information may be coming from` |
| Remediation plan | `Suggested improvements` |
| Publish task | `Update in progress` |
| Source updated | `Website or listing update recorded` |
| Matched cohort recheck | `Latest follow-up AI check` |
| Still missing | `Still not mentioned in the selected searches` |
| No controllable gap found | `We didn't find a clear information change to make` |

The Brand UI must include lightweight methodological context (`Sampled responses; not every customer's AI search`) without drowning the user in technical details.

---

## 10. Engineering implementation guidance

### Do not rebuild

Inspect current file tree, dependencies, state management, route map, feature flags and existing issues/tasks/GEO assets. Preserve the current visuals and functioning Brand-first design. Build reusable **DiscoveryOpportunityCard**, **DiscoverabilityPlanSummary**, **RelevanceVerification**, **ReadinessFindings**, **OptimizationPlanEditor** (ProManage only), **OptimizationApproval**, and **DiscoveryRecheckComparison** only where they genuinely reduce duplication.

### Suggested route additions (adapt to actual route structure)

- Brand: existing `/overview` card; `/locations/:id/visibility` optional; `/attention?type=discovery`; `/progress?type=discovery`; `/plans/:planId` for friendly approval view only if needed.
- ProManage: contextual discovery tab in `/issues/:id` or `/investigations/:id`; reuse `/geo-readiness/:locationId`; `/monitoring` existing route, add discovery cohort panel.
- Forbidden: creating a new app shell, parallel location dataset, a separate `geo-ai-optimizer` product tree, duplicate task approval system, or dead `Optimize now` controls.

### Work order

1. Read all related PRDs/UX brief. Inspect current app. Produce a short change map first.
2. Confirm existing audited observations and correct unbranded location-level mention computation.
3. Add Discovery Opportunity records and eligible/not-relevant review without marking non-mentions errors.
4. Add ProManage source/readiness inspection and plan composer based on existing GEO Readiness.
5. Add simplified Brand fact confirmation and plan approval, existing task/publishing handoff.
6. Add matched recheck and comparison with explicit uncertainty and independently tracked accuracy outcomes.
7. Reconcile metrics, preserve state, test role/release gates, run build, click through complete demo.

### Release demo gating

- **MVP:** sampled mention observations + relevance qualification only.
- **V1:** internal readiness checks, content improvement plan, approval, assets and simulated publishing handoff.
- **V2:** scheduled recheck preference and matched before/after samples, never pretending actual background jobs run.

---

## 11. Acceptance tests — must pass

**Core journeys**

- [ ] Whitefield: unbranded search omits BrightNest; records opportunity, **not** confirmed factual error.
- [ ] Brand can mark query Not relevant; observation excluded from eligible mention metric, with evidence retained.
- [ ] Brand can confirm Whitefield offers Montessori; ProManage can use it, but not edit the business fact as approved without Brand.
- [ ] ProManage inspects source gap and can prepare plan based on supported evidence.
- [ ] Brand sees plain-language current/proposed content; can Approve / Request changes / Decline.
- [ ] A declined/changes-requested plan cannot be marked implemented until later valid approval.
- [ ] ProManage records **simulated** controlled-source completion with owner/date and evidence; original AI observation remains unchanged.
- [ ] GEO Readiness JSON-LD/fact-sheet outputs remain available to ProManage and hidden from Brand's default UI.
- [ ] Linked existing Accuracy Issue (HSR) and Discovery Opportunity (Whitefield or HSR) maintain **separate** outcomes and metrics.
- [ ] Recheck before/after uses identical eligible prompt cohort; `1/4 → 3/4` only if fixture data supports it.
- [ ] Recheck with changed provider/context is inconclusive, not a positive or negative delta.
- [ ] No controllable gaps found → no forced recommendation; user can Monitor only.

**Product quality / safety**

- [ ] Exactly two roles: **Brand** and **ProManage**, Brand default.
- [ ] Nontechnical Brand navigation remains at five items; no new technical sidebar entries.
- [ ] MVP/V1/V2 release switches progressively gate interactions, preserving state.
- [ ] All primary buttons, dialogs, filters and export actions function; no dead links or decorative controls.
- [ ] Existing accuracy resolution, task approvals, monitoring, exporting and sample data continue to work.
- [ ] No invented citations, prices, statistics, reviews, unsupported service claims or guaranteed AI ranking language.
- [ ] UI is light, ProManage-aligned, desktop-polished, responsive and keyboard accessible.
- [ ] `npm run build` succeeds; applicable unit/UI tests pass; end-to-end manual walkthrough of both roles is documented.

---

## 12. Pilot-value metrics and rollout assumptions

For the hiring presentation, label these as **targets to validate**, not actual results:

| Release | Customer-value signal | ProManage business signal | Guardrail |
|---|---|---|---|
| MVP | Eligible discovery opportunities reviewed and accepted as worth investigating | Pilot customers agree findings are useful | False omission claims / nonrelevant prompts |
| V1 | Percentage of recommended, fact-verified improvements approved and executed | Existing Listings/GEO workflow adoption, willingness-to-pay interviews | Claim factual accuracy; no unapproved publications |
| V2 | Percentage of monitored opportunities with valid rechecks and understandable outcomes | Repeated product use, pilot-to-paid interest | Consistent sampling cost and methodology; avoid causal overclaim |

Track time saved only with a credible baseline, not fabricated efficiency claims. Pricing, conversion, revenue and retention are future hypotheses until validated with actual customers.

---

## 13. Definition of done for Claude Code

The **existing working application** must demonstrate both customer problems side-by-side, not just an attractive screen:

**Accuracy:** Wrong opening hours → Brand verifies → ProManage checks sources → Brand approves correction → source update recorded → comparable AI recheck.

**Discoverability:** Eligible Whitefield not mentioned → relevance confirmed → ProManage identifies *evidenced* information gap → drafts a safe improvement plan → Brand approves → controlled source update recorded → sampled discovery recheck.

Both stories must use one consistent account, location registry, task/approval architecture and report system. Brand never sees raw markup by default; ProManage never approves business facts. No action can pretend to change external AI answers. The final implementation report must list route changes, reused/new components, seeded scenarios, automated/manual test results, simulated limits and any PRD requirements not completed.
