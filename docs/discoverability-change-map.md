# Discoverability Improvement: change map (PRD v4 addendum)

The baseline was backed up before any change (`baseline-before-discovery.tgz` in the session scratchpad; the repo is not under git yet).

## Already in the app (kept as is)
- 80-observation demo: 10 pilot centres × 8 prompts (5 unbranded p1–p5 + 3 branded p6–p8) × Surface A. Observations come from `data/answers.ts` and are deterministic.
- `Observation.mentioned` (this outlet) is already separate from `mentionedBrand` (any BrightNest branch).
- Accuracy journey: issues → Brand decision → investigation → correction plan → tasks → recheck. Files: `brandStatus.ts`, `AppStore.tsx`, `BrandAttention.tsx`, `Issues.tsx`, `IssueSources.tsx`, `Tasks.tsx`, `Monitoring.tsx`.
- GEO Readiness: verified facts, JSON-LD, fact sheet and publication checklist. Fact confirmation already follows the needed permissions: Brand verifies directly, ProManage only proposes.
- Matched rechecks: `runRecheck` gives the same audit cohort a new wave.

## What changes
| Area | Change |
|---|---|
| `data/issues.ts` | Stop generating `discovery_gap` Issues. A non-mention is no longer an issue, so this removes the duplicate. The category type stays for compatibility. |
| `data/answers.ts` | One extra deterministic wave-1 flip (Whitefield, Montessori prompt), used for the primary positive-recheck story. |
| `data/types.ts` | New types: `EligibilityReview`, `ReadinessFinding`, `OptimizationPlan`, `DiscoveryRecord`, `DiscoveryOpportunity`, `DiscoveryRecheck`. `Task` gains `opportunityId` and `recommendationId`. |
| `store/AppStore.tsx` | New persisted slices: `discoveryEligibility` and `discovery`. New actions for eligibility, service confirmation, investigation, findings, plan, approval, publication evidence, monitor-only and archive. The old `discoveryTags` now write to eligibility. |
| `lib/discovery.ts` (new) | Eligibility rules from verified facts, readiness fixtures, opportunity derivation (one per centre per audit), status model, matched recheck and metrics. |
| Brand pages | Overview discovery card, Location detail "Being found in AI search", Attention discovery section, new `/attention/discovery/:id` plan page, Progress category tags, Reports "Discoverability checks". |
| ProManage pages | Investigations gets an Accuracy / Discoverability sub-tab, new `/discovery/:id` investigation page and recommendation composer, a GEO Readiness "Content improvements" tab, a Monitoring discovery cohort panel, a Reports section, and discovery tasks in Tasks. |

## Reused instead of rebuilt
Plan approval → tasks (same `Task` records and Tasks page), GEO Readiness JSON-LD/fact sheet assets, Listing Management deep link (`/listings/:id`), `verifyFact` / `requestVerification` for service confirmation, `runRecheck` waves, `EvidenceDisclosure`, `PermButton`, `Dialog`, `Badge`, `Segmented`.

## New routes
- Brand: `/attention/discovery/:id`
- ProManage: `/discovery/:id` (a Brand user is redirected to the Brand page) and `/issues?tab=discovery`
