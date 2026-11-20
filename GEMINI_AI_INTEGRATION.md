# Gemini AI Integration — LifeBridge AI

LifeBridge AI integrates **Google Gemini AI (`@google/genai` SDK)** strictly as a **server-side, non-authoritative clinical decision-support and explanation layer**. Deterministic clinical rules, ABO blood-group gates, donor consent enforcement, and licensed human clinicians retain 100% of allocation authority.

---

## 1. Architecture & Safety Boundaries

- **Server-Only Key Handling**: `GEMINI_API_KEY` is read exclusively in `server/src/config/env.ts` inside `server/src/services/aiService.ts` and is never exposed in Vite client bundles (`VITE_*` prefix is strictly forbidden for secrets).
- **Default Model, Bounded Retries & Automatic Fallback**: `GEMINI_MODEL` defaults to `gemini-4-hydrogen` (legacy deprecated names normalize automatically) with `ThinkingLevel.LOW` for lower-latency JSON generation. `generateWithBoundedRetry()` executes bounded exponential-backoff retries with jitter (`AI_MAX_RETRIES=3`, `AI_RETRY_BASE_MS=500`) **only** on transient upstream faults (`503`, `502`, `500`, `429`, `ECONNRESET`/`fetch failed`), never retrying permanent `400`/`401`/`403`/`404`/validation errors. If `GEMINI_MODEL` exhausts transient `503` retries or times out, `GEMINI_FALLBACK_MODEL` (default `gemini-3.1-flash-lite`) serves a single clean recovery attempt.
- **Zero Autonomous Clinical Authority**:
  - AI endpoints never mutate donor consent, recipient priority scores, match rankings, workflow states, custody records, or audit ledger hashes.
  - Every AI response includes `advisoryOnly: true`, `humanReviewRequired: true`, and explicit clinical safety disclaimers.
  - Clinical documentation drafts explicitly display `Requires Qualified Medical Review`.
- **PII Minimization & Equity Privacy**:
  - Prompts use anonymized clinical codes (`REC-K01`, `DNR-HYD-8412`, `CASE-2026-001`) instead of personal identities.
  - `stripPiiFromText()` and `sanitizePromptInput()` scrub embedded email addresses, phone numbers, and 28-character user IDs before model invocation and on output return.
  - Fairness subgroup analysis replaces any cohort where `n < 20` (`isSuppressed === true`) with `[SUPPRESSED < 20]` so small demographic cohorts cannot be leaked or reconstructed.
- **Structured Output Validation & Timeouts**:
  - All requests pass JSON Schema (`responseSchema`) with `responseMimeType: 'application/json'` and validate parsed responses via Zod schemas before returning to clients.
  - `AbortController` + `Promise.race` enforces `AI_REQUEST_TIMEOUT_MS` (default `15000ms`), returning HTTP `504 GATEWAY_TIMEOUT` on expiry.
- **Dedicated AI Rate Limiting**: `/api/v1/ai` enforces a 30 requests/minute per-IP rate limit in non-test environments (`server/src/app.ts`), in addition to `USE_AI_CLINICAL` / `USE_AI_ASSISTANT` / `VIEW_FAIRNESS` RBAC checks and `AI_ASSIST_GENERATED` audit logging.

---

## 2. Server-Side AI Endpoints (`/api/v1/ai/*`)

| Endpoint | Permission / Access Scope | Purpose & Frontend Surface |
| :--- | :--- | :--- |
| `POST /api/v1/ai/recipient-summary` | `VIEW_CLINICAL_OVERVIEW` **or** owning `recipient` (`REC-K01` own record only) | Plain-language summary of anonymized waitlist readiness (`PatientPortalView`, clinical review) |
| `POST /api/v1/ai/matching-explanation` | `USE_AI_CLINICAL` (`coordinator`, `medical`, `hospital`, `admin`) | Explains deterministic factor weights and Rule 0 exclusions (`ExplainableMatchingView`) |
| `POST /api/v1/ai/clinical-summary` | `USE_AI_CLINICAL` (`coordinator`, `medical`, `hospital`, `admin`) | Structured clinical handover draft marked `Requires Qualified Medical Review` (`ApprovalWorkflowView`) |
| `POST /api/v1/ai/fairness-insights` | `VIEW_FAIRNESS` (`coordinator`, `medical`, `admin`) | Equity parity commentary respecting `[SUPPRESSED < 20]` cohorts (`FairnessMetricsView`) |
| `POST /api/v1/ai/general-assistant` | `USE_AI_ASSISTANT` (all authenticated roles, strictly role-scoped) | Role-scoped assistant widget (`AiAssistantWidget`), hidden when signed out |

---

## 3. Error Handling Semantics

| Condition | HTTP Status | Error Code |
| :--- | :--- | :--- |
| Missing or placeholder `GEMINI_API_KEY`, or invalid provider key (`401`/`403`) | `503` | `SERVICE_UNAVAILABLE` |
| Unauthenticated caller | `401` | `UNAUTHORIZED` |
| Role/ownership violation | `403` | `FORBIDDEN` |
| Upstream quota/rate limit (`429`) | `429` | `RATE_LIMIT_EXCEEDED` |
| Non-JSON model response, Zod validation mismatch, or invalid `GEMINI_MODEL` (`404`) | `502` | `BAD_GATEWAY` |
| Exceeded `AI_REQUEST_TIMEOUT_MS` deadline | `504` | `GATEWAY_TIMEOUT` |

---

## 4. Verification Status

- Automated Vitest tests (`tests/aiAndServices.test.ts`) verify all 5 endpoints, RBAC/ownership isolation, `n < 20` cohort suppression, PII scrubbing, invariant clinical state preservation, bounded transient `503`/fallback retries, zero retries on `401`/`404` permanent errors, and error mappings (`401`, `403`, `429`, `502`, `503`, `504`).
- **Live End-to-End Verification Passed (`5/5` HTTP `200`)**: Executed live authenticated requests against all five `/api/v1/ai/*` endpoints on `http://127.0.0.1:3000`. All 5 endpoints returned structured schema-validated `HTTP 200` advisory JSON (`advisoryOnly: true`, `humanReviewRequired: true`) via verified fallback to `gemini-3.1-flash-lite` when `gemini-4-hydrogen` experienced upstream capacity delays/timeouts, while enforcing PII scrubbing and `403 FORBIDDEN` role/ownership guards.
