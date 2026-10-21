# ProManage AI Visibility — Interactive Prototype PRD

**Status:** Prototype specification for Claude Code  
**Purpose:** Demonstrate a credible MVP → V1 → V2 product journey for an enterprise multi-location GEO capability.  
**Reference:** https://www.promanage.ai/  
**Output:** A polished, locally runnable, interactive web application—not a landing page or static Figma-style image.

> **IMPORTANT:** This is a fictional prototype for a PM hiring assignment. No live AI searches, production ProManage integration, or real customer claims are required. Every demo data point and sampled AI response must be clearly labeled *Illustrative / simulated*. Do not claim the product can control ChatGPT, Gemini or Perplexity recommendations.

## 1. Product mission

**Product name:** ProManage / AI Visibility  
**Placement:** An extension within the existing ProManage *Insights & Analytics* experience, using underlying location and listing data. Do not introduce a fifth separately branded AI tool by default.

**Customer problem:** Enterprises with hundreds of physical locations lack a reliable way to know whether AI-generated answers mention relevant outlets and accurately describe their hours, contact information, services and locations. They also struggle to identify which observed issues are actionable and assess outcomes after correcting controlled information sources.

**Product promise:** “Understand how your locations appear in sampled AI answers. Investigate inaccuracies. Correct the information you control. Recheck the results.”

**Four-stage workflow:** **Audit → Review → Act → Recheck**.

**Business intent:** Increase adoption of ProManage's existing listings/insights workflows and create a potential paid AI Visibility add-on. Treat incremental revenue and better AI ranking as unproven hypotheses, not outcomes shown as fact.

## 2. Users and permissions (demo roles)

- **Primary:** Enterprise Digital Marketing / Local SEO Manager. Starts audits, reviews organization-wide issues, assigns tasks and exports results.
- **Secondary:** Regional Operations Manager. Views only assigned locations and marks correction tasks complete.
- **Support:** ProManage Customer Success Manager. Can help configure audits and explain findings, but does not own the customer's factual decisions.
- **Buyer, not necessarily daily user:** Head of Marketing / CMO. Wants an executive-level summary of risk, work completed and measurable value.

Provide a top-bar **Demo as** selector for Marketing Manager / Regional Manager / ProManage CSM. This is a prototype-only permission demonstration, **not production authentication**. The regional persona should see a narrower filtered scope; only the Marketing Manager can approve source-data corrections. Actions must never modify real business listings.

## 3. Release model: interactive feature gate

Add a persistent segmented control in the app header: **MVP · V1 · V2** with sublabels **Weeks 1–4 · Weeks 5–8 · Weeks 9–12**. Switching changes accessible features while retaining simulated audit data. Show a small "Prototype roadmap mode" label so it is clear this is for demonstration.

| Release | User promise | Includes | Explicitly excludes |
|---|---|---|---|
| **MVP (W1–4)** | "Show me what sampled AI answers say." | Select up to 10 outlets; verified data status; curated prompts; one simulated AI search surface; run audit; mention detection; factual discrepancy flags; manual review; export | Automated publishing, exact root-cause certainty, live multi-provider tracking, full-scale monitoring |
| **V1 (W5–8)** | "Help me handle important discrepancies." | MVP + issue inbox; issue severity; evidence comparison; possible source discrepancies; assign/track corrective tasks; completion status; approval before source changes | Guaranteed corrections to AI answers, actual third-party publishing |
| **V2 (W9–12)** | "Make improvements measurable and repeatable." | V1 + simulated weekly rechecks; stable prompt cohort; location/region rollups; before-vs-after trend; alert summary; exportable progress reporting | Unlimited real-time scans, full AI-platform parity, unsupported attribution to sales |

All future-release tabs should be visible but disabled/locked in earlier modes, with a helpful "Available in V1/V2" explanation. Avoid building three separate apps.

## 4. Main user story (the demo script)

Use a **fully fictional** multi-location preschool brand called **BrightNest Preschools**, with 150 total centers and 10 selected pilot centers in Bengaluru. Use realistic neighborhoods: Whitefield, HSR Layout, Koramangala, Indiranagar, Sarjapur, Jayanagar, Bellandur, Brookefield, Electronic City, Marathahalli. These are fictional outlets; do not suggest they actually exist.

1. The Marketing Manager opens **AI Visibility** and sees a summary plus **Create audit**.
2. They select 10 locations. One location has incomplete verified opening hours; show a warning rather than fabricating a truth value.
3. They choose 8 relevant prompt templates (5 **unbranded discovery** prompts, 3 **branded factual** prompts), inspect expected audit volume, and start the audit.
4. The simulated audit executes **10 locations × 8 prompts × 1 simulated source = 80 observations** with a visible progress stepper.
5. Results show sampled mention rate, coverage and verified mismatches; clicking **Whitefield** opens its AI-answer evidence.
6. A simulated answer says Whitefield offers **no Saturday tours** while an approved BrightNest record says **Saturday tours 10 AM–1 PM**. The user marks it as "Confirmed discrepancy" after comparing evidence. Show possible outdated directory content only as a **hypothesis**, not certain attribution.
7. In V1, the manager creates a task "Review outdated Saturday-tour information", assigns a regional manager, and sees a status update. They can mark the **source correction complete**, but the AI-answer issue remains **Awaiting recheck**.
8. In V2, clicking **Run recheck** shows a second simulated observation. Some answers can now be correct, others unchanged. A chart accurately compares **the same platform/proxy, prompts, locations and analysis rules**. State: "Observed change; causation not established."
9. The user downloads a CSV report of observations, source verification status and tasks.

## 5. Screens and expected interactions

### S1. App shell / AI Visibility overview (`/overview`)

- Left navigation: **Overview, Audits, Locations, Issues (V1), Tasks (V1), Monitoring (V2), Reports**.
- Top bar: ProManage wordmark, BrightNest account selector, demo-role switch, release switch, compact avatar.
- Hero title: **AI Visibility**; subtitle: "Understand how AI search represents your locations."
- Four compact cards with truthful definitions: **Sampled discovery mention rate**, **Locations included**, **Confirmed factual mismatches**, **Issues awaiting review**. Data comes from the seeded observations; do not hard-code contradictions.
- Two-column layout: **Location performance table** and **Recent audits/activity**. Primary action: **New audit**.
- Show source/proxy badge: **Simulated AI search results (demo)**, with tooltip: "Not a direct view of actual users' ChatGPT conversations."

### S2. New audit wizard (`/audits/new`)

**Step 1 — Locations**
- Select 1–10 of 150 fictional centers. Seed 10 pilot centers with validated status tags: **Verified**, **Needs verification**, **Unknown**.
- Search, city/neighborhood filtering, Select all/clear, selected count.
- Side panel shows completeness for Name, Address, Phone, Hours, Services and Website.
- Incomplete fields are marked **Cannot evaluate**, never automatically "incorrect".

**Step 2 — Prompts**
- Select/deselect 8 templates, grouped by **Discovery / Services / Reputation / Branded facts**.
- Example unbranded: "Best preschools offering Saturday tours near {neighborhood}, Bengaluru"; "Preschools near {neighborhood} with good parent reviews".
- Example branded: "Does BrightNest {neighborhood} offer Saturday visits?"; "BrightNest {neighborhood} phone number and opening hours".
- Permit adding/editing a custom prompt; show live count and preview with a chosen location substituted.
- Explain that branded prompts are **not included** in unbranded discovery mention-rate calculations.

**Step 3 — Review and Run**
- Scope summary: selected centers × prompts × 1 demo surface; estimated 80 observations.
- Important disclaimer: provider output can vary, API results may not match consumer product screens.
- "Run audit" simulates progress over 3–6 seconds; show preparation / running / extracting / complete stages. Do not make network requests.
- If selection is empty, prevent run and provide actionable inline error.

### S3. Audit results (`/audits/:id`)

- Header with run date, source type **Demo AI Search**, total observations and export CTA.
- KPIs must be calculated from sample records rather than invented in card strings.
- Filterable/sortable location table: location, discovery prompts tested, mentions, sampled mention rate, factual checks, verified discrepancies, status.
- Issue summary: **Potential omissions**, **Factual mismatches**, **Unverifiable claims**, **No issues found in sample**. Avoid labeling every non-mention as an error.
- Selecting a row opens the location's detail. CSV export should actually download a client-side-generated CSV.

### S4. Location and AI answer detail (`/locations/:id/answers`)

- Left: prompt list with query category, mention status and review state.
- Middle: full **simulated** answer text, date/time, platform/proxy, query context, response evidence; highlight relevant claims.
- Right: verified BrightNest data record with last-verified timestamp and source owner.
- For relevant factual claims show **AI answer / Verified record / Evaluation** side by side.
- Review controls: **Confirm discrepancy**, **Not an issue**, **Needs investigation**. Require explicit review for high-severity issues.
- Source links are only shown if present in seed evidence; use safe fictional `.example` URLs and do not imply every AI answer comes with citations.
- Missing recommendation displays **"Not mentioned in this sampled response"**, not "Your center is invisible".

### S5. Issue inbox and investigation (`/issues`, `/issues/:id`) — V1

- Issue table filters: severity, status, region, type, owner. Search by center/prompt.
- Types: **Factual mismatch**, **Potential discovery gap**, **Unverifiable claim**, **Source inconsistency**.
- Severity rubric: **High** for wrong phone/address, unsupported sensitive claims or materially wrong service availability; **Medium** for incorrect opening hours; **Low** for minor detail/one-off omission requiring more evidence. Not every omission is automatically High.
- Detail panel includes exact simulated observation, approved source-of-truth, comparison, and **Possible explanations** (uncertain).
- Main CTA: **Create correction task**; secondary CTA: **Mark as non-issue**.

### S6. Correction task workflow (`/tasks`) — V1

- Create: title, associated issue, assigned role/person, controlled information source, due date, notes.
- States: **Open → In progress → Source updated → Awaiting AI recheck → Closed**. Don't mark "AI answer fixed" merely because a website/listing update occurred.
- Approve simulation of a source update (Marketing Manager only) and show audit-trail entry. No actual CMS/GBP writes.
- Comments/activity timeline and functional status changes. Show success toast.

### S7. Monitoring and rechecks (`/monitoring`) — V2

- Weekly monitoring setup UI: **enable weekly schedule** for the selected cohort. In a static browser prototype, this is a saved simulated preference, not a real background worker.
- **Run simulated recheck now** generates the next deterministic snapshot and updated trends.
- Compare mention rate and verified-error count at baseline vs recheck **using the same matched sample cohort**; make denominators visible.
- Provide location/region filter, time-series chart, "Changed / unchanged / uncertain" outcomes, and an alert queue with deduplication.
- Annotate charts: "Simulated observations. AI results fluctuate. Changes are not evidence of causal impact."

### S8. Reports (`/reports`)

- A crisp enterprise-ready summary: audit scope, methods, location coverage, key reviewed issues, source tasks, matched recheck observations, limitations.
- Export CSV directly; optional print-friendly HTML report via `window.print()` is enough. No PDF-generation backend.

## 6. Data contract and metrics

Use local deterministic TypeScript seed fixtures, all marked `simulated: true`:

- `Organization { id, name, sector, totalLocationCount }`
- `Location { id, organizationId, name, neighborhood, city, region, verifiedFields, verificationStatus, lastVerifiedAt }`
- `PromptTemplate { id, intent, category, text, includeInDiscoveryMetric }`
- `Audit { id, createdAt, locationIds, promptIds, surface, status }`
- `Observation { id, auditId, locationId, promptId, sampledAt, answerText, mentioned, extractedClaims[], citations[], reviewStatus, simulated }`
- `Issue { id, observationId, locationId, category, severity, confidenceLabel, state, notes }`
- `Task { id, issueId, assignee, status, dueAt, activity[] }`
- `Recheck { id, priorAuditId, cohortFingerprint, sampledAt, observations[] }`

**Metric rules (important):**
- **Sampled discovery mention rate** = unbranded, relevant discovery responses containing the correct brand/location entity ÷ completed unbranded relevant discovery responses. Display `(e.g. 18 of 50)` next to the percentage.
- **Locations mentioned** = number of pilot locations mentioned in at least one sampled unbranded discovery result; not the count of total enterprise branches.
- **Factual mismatch count** = human-confirmed claims that conflict with an independently verified business record. An unverified source creates **Needs verification**, not a mismatch.
- **Recheck comparison** = compare identical location + normalized prompt + source/proxy + evaluation rules, and show the sample count. No claim of ranking or revenue lift.

Seed a credible mix of correct mentions, omitted mentions, false details, ambiguous answers and uncertain business data. Ensure every summary KPI **derives from** the underlying observations and reconciles with tables and filters. Do not use real hospital facts, actual brand ratings, real customer names, invented search volumes or fabricated citations.

## 7. Design / visual system — ProManage-aligned, design-studio quality

**Visual reference:** https://www.promanage.ai/ and public ProManage dashboard imagery. Existing brand cues include a bright turquoise/teal logo, blue UI accents, white/light-grey dashboard surfaces, compact enterprise data displays and approachable AI-product language. **The exact hex colors and font family below are prototype approximations, not verified official brand tokens.** If website inspection yields reliable computed values, prefer those and document changes.

**Reference tokens (approximate; use CSS variables):**

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
  --teal-soft: #E6F8F8;
  --blue-soft: #EEF4FF;
  --success: #16845D;
  --warning: #B7791F;
  --danger: #CD4B59;
}
```

- **Font:** Inter or similar clean sans-serif from available open-source fonts; use consistent font weights 400/500/600/700. Do **not** download or bundle third-party proprietary font files.
- **Style:** refined, modern, precise, premium B2B SaaS; high polish, measured whitespace, excellent table density and clear typographic hierarchy. Think **designed by a strong product studio**, not flashy marketing landing page.
- **Desktop:** white or very light sidebar (220–240px), selected nav using soft-blue highlight with bright blue left marker, tidy 60px top bar. The public product imagery is light-first; do not default to an almost-black full-height sidebar just because earlier speculative mockups used one.
- **Grid:** 8px spacing scale, 12-column content grid, 12px card radii, restrained shadows, subtle borders, compact table rows (48–56px), maximum content width 1440px where suitable.
- **Charts:** simple lines/bars with legible axes and tooltips; one restrained blue/teal data palette. Never use fake scientific precision or misleading tiny denominator percentages.
- **Components:** shadcn/ui tables/dialogs/sheets, Lucide icons, clear tooltips, chips, progress steps, toast notifications, empty states, error states, skeleton loading, confirm dialogs.
- **Color meaning:** red only for verified factual errors/high-risk states, amber for review, teal/green for verified/completed. Absence from a query should generally be neutral or amber, not automatically error-red.
- **Motion:** 150–220ms, subtle hover/transition, no distracting gradients/animations. Gradient only sparingly in a top-level welcome/accent card.
- **Accessibility:** keyboard navigation, visible focus, semantic table headers, contrast >= WCAG AA where feasible, no color-only encoding.
- **Responsive:** desktop-first at 1440px and 1280px; a usable tablet layout and mobile stacked panels with horizontal table scrolling. Do not sacrifice desktop product quality for a mobile-first marketing appearance.
- **Brand assets:** use a simple "ProManage" textmark or approved publicly available asset if appropriate. Don't mimic the unrelated manufacturing company at `promanage.com`. Do not use real enterprise customer logos or protected assets unless provided/licensed.

## 8. Suggested engineering implementation

- **Stack:** Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Lucide React + Recharts + React Router.
- **Data:** `src/data/seed.ts` with deterministic fixtures and `src/lib/metrics.ts` containing all KPI calculations. State via React context or Zustand and persisted in `localStorage` (with Reset demo button).
- **Simulation:** `src/services/mockAuditService.ts` returns fixed seeded observations after artificial progress; no provider secrets, scraping, backend, API keys or external business write actions. Use consistent cohort IDs across rechecks.
- **Routing:** implement all S1–S8 paths; disabled future-release routes redirect gracefully with "Unlock V1/V2" explanation.
- **Interactivity contract:** no dead buttons or placeholder-only filters. Location selection, prompt edits, audit run, table sorting/filtering, detail drill-down, manual review, task updates, release switch, role switch, simulated recheck, report export and demo reset must all work.
- **Copy:** short product-language headings; realistic microcopy; avoid walls of explanatory paragraphs. Show "Simulated" label persistently.
- **No backend dependency.** Must work after `npm install && npm run dev`.

## 9. Quality and acceptance criteria

**Functional:**
1. The main demo walkthrough (steps 1–9 above) works end-to-end on a fresh run.
2. Switching MVP → V1 → V2 reveals genuinely new interactions while retaining data.
3. The account contains 150 fictional locations, but the default audit starts with 10 selected pilot locations.
4. 80 simulated observations are generated for a 10 × 8 × 1 audit, and the metrics reconcile with those records.
5. Missing/unverified source records never produce false "confirmed mismatch" labels.
6. Unbranded discovery and branded accuracy prompts have distinct metrics.
7. Creating/completing a correction task does not automatically mark the AI answer corrected.
8. Recheck metrics compare the same prompt cohort; results are visibly labeled simulated.
9. CSV export generates a real local file. No broken navigation, forms or controls.
10. Clear empty/loading/error/success states exist for core workflows.

**Design:**
1. Looks unmistakably like an enterprise product aligned with ProManage's light, teal/blue visual identity.
2. Dashboard hierarchy is calm, crisp and skimmable; polished at 1440×900 and 1280×800.
3. Accurate data visualization, no overflowing cards, no overly dense microtext, consistent spacing/radii/typography.
4. Provide a delightful but sober first-run onboarding, subtle hover states and coherent icon usage.
5. No misleading "real ChatGPT data", guaranteed rankings, fabricated causal improvements or misleading accuracy confidence values.

## 10. Instructions to Claude Code

1. **Read this PRD fully.** Inspect `https://www.promanage.ai/` if web access is available; update approximate CSS tokens to visually match the actual live brand while staying closer to its existing light product dashboard than to its homepage hero section. If unavailable, use the approximate tokens and proceed; don't block implementation.
2. **Build the working prototype now**, using the specified stack unless the existing repository has a strong reason to reuse an installed equivalent.
3. Start with the shell + seed fixtures + MVP wizard and results. Then build V1 issue/task actions. Finish with V2 monitoring and recheck comparison.
4. Generate realistic, *fictional* data that remains internally consistent. The full flow should be engaging enough for a 3–5 minute live PM assignment demo.
5. Test the application: execute the build, fix errors, and click through the primary journey (automated browser testing if available). Do not stop at a scaffold or output only static mockups.
6. At the end provide: (a) concise run instructions, (b) implemented routes, (c) what's simulated, (d) known limitations, and (e) screenshots if screenshot tooling is available.
7. Prioritize **believable experience and reliability** over adding speculative features.

### Recommended main demo path

`/overview` → `/audits/new` → `/audits/demo-001` → `/locations/whitefield/answers` → switch to **V1** → `/issues/issue-saturday-tours` → `/tasks` → switch to **V2** → `/monitoring` → `/reports`.
