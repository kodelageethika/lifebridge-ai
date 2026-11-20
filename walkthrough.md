# Security Summary

**Reviewed Files**: 22
**Issues Resolved**: 4

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Browser Session Storage | `src/services/api.ts` | 5 | The fallback Bearer session token was persisted in `sessionStorage`, leaving an authentication credential readable by scripts running in the origin. | Medium | Fixed | Switched client-side Bearer token retention strictly to an in-memory JavaScript variable (`inMemoryToken`) while using HTTP-only cookies for reload persistence. |
| Cross-Site Mutation Protection | `server/src/middleware/auth.ts` | 134 | Cookie-authenticated `POST`, `PATCH`, `PUT`, and `DELETE` requests needed explicit origin and header validation to block cross-site request forgery without breaking Bearer API clients. | High | Fixed | Added `enforceCsrfProtection` verifying an allowed `Origin` header or custom `X-Requested-With: LifeBridge-SPA` header on cookie-authenticated mutations. |
| AI PII Minimization & Subgroup Suppression | `server/src/services/aiService.ts` | 84 | Unfiltered user questions or equity subgroups with small sample counts (`n < 20`) could expose contact details or re-identification counts to external AI prompts. | Medium | Fixed | Added `stripPiiFromText` / `sanitizePromptInput` scrubbing before prompt dispatch and replaced suppressed cohort metrics (`isSuppressed === true`) with `[SUPPRESSED < 20]`. |
| Disallowed Origin Error Leakage | `server/src/app.ts` | 39 | Disallowed CORS origins triggered a generic server error returning HTTP `500` instead of an explicit rejection status. | Low | Fixed | Returned `ForbiddenError` so disallowed origins fail cleanly with a structured `403 FORBIDDEN` response. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `server/src/config/env.ts` | `GEMINI_API_KEY`, `SMTP_PASSWORD`, `DATABASE_URL`, `SESSION_SECRET`, and `AUDIT_HMAC_SECRET` remain server-side in `process.env` and are validated at production startup by `validateProductionEnv()`. |
| Database Access | `server/src/db/postgresRepository.ts` | Relational persistence uses Prisma parameterized operations inside PostgreSQL advisory-locked transactions, without string-interpolated SQL from user input. |
| Authentication & Role Checks | `server/src/routes/v1/index.ts` | Every protected clinical, administrative, and AI endpoint requires verified authentication (`requireAuth`) plus explicit permission or ownership scoping (`requirePermission`, `requireRole`, donor/recipient linkage). |
| Firebase Identity Verification | `server/src/lib/firebase-admin.ts` | Server-side Firebase ID token verification rejects missing emails and unverified email accounts (`email_verified !== true`) with HTTP `401`. |
| Unsafe HTML Rendering | `src/components/common/AiInsightPanel.tsx` | All AI advisory narratives, warnings, and user prompts are rendered strictly through React JSX text bindings with zero `dangerouslySetInnerHTML` or raw DOM HTML injection. |

## PoC Verification

### Browser Token Exposure via Web Storage

#### Summary
| Field | Value |
|---|---|
| Issue Type | Accessible Browser Token Storage |
| Impact | Medium |
| Affected File | `src/services/api.ts:5` |
| Test Scenario | Sign in cleanly and inspect `window.sessionStorage` and `window.localStorage` from client script execution context. |

#### How It Was Fixed
Removed `sessionStorage.setItem` / `getItem` / `removeItem` calls completely from `src/services/api.ts` and stored the optional cross-origin Bearer token solely inside a module-scoped `inMemoryToken` variable, while issuing HTTP-only cookies (`lifebridge_session`) via `server/src/controllers/authController.ts`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `login()` in `src/context/AuthContext.tsx` receives `{ user, token }` from `POST /api/v1/auth/login` | Session response arrives cleanly |
| 2 | `setStoredToken(res.token)` at `src/services/api.ts:24` assigns `inMemoryToken` in JavaScript closure state without touching `sessionStorage` or `localStorage` | Browser storage stays clear |
| 3 | Server sets `HttpOnly` `lifebridge_session` cookie at `server/src/controllers/authController.ts:32` for reload recovery | **Handled Safely** |

#### Conclusion
**Fix Verified** - Session credentials cannot be harvested from `sessionStorage` or `localStorage` by third-party or injected scripts.

### Cross-Site Cookie-Authenticated Mutation

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-Site Mutation Missing Origin Check |
| Impact | High |
| Affected File | `server/src/middleware/auth.ts:134` |
| Test Scenario | `POST /api/v1/notifications/read-all` with valid `lifebridge_session` cookie and untrusted `Origin: https://evil-attacker.example` (and without `Origin` or `X-Requested-With`). |

#### How It Was Fixed
Mounted `enforceCsrfProtection(env.CORS_ORIGINS)` across `/api/v1` in `server/src/app.ts:69` and returned `ForbiddenError` on untrusted CORS origins in `server/src/app.ts:39`, rejecting cookie-only mutations lacking either an allowed `Origin` or `X-Requested-With: LifeBridge-SPA`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `POST /api/v1/notifications/read-all` arrives with `Cookie: lifebridge_session=...` and untrusted `Origin` | Request enters middleware stack |
| 2 | CORS middleware (`server/src/app.ts:39`) and `enforceCsrfProtection` (`server/src/middleware/auth.ts:159`) validate `Origin` against allowlist | Untrusted origin detected |
| 3 | Automated test in `tests/aiAndServices.test.ts` confirms HTTP `403` `FORBIDDEN` response (and `403` when header is omitted) | **Handled Safely** |

#### Conclusion
**Fix Verified** - Cookie-authenticated mutations from untrusted cross-site origins or headerless form posts are blocked with HTTP `403`.

### PII & Suppressed Cohort Leakage in AI Prompts

#### Summary
| Field | Value |
|---|---|
| Issue Type | Sensitive Data Overexposure to External AI Provider |
| Impact | Medium |
| Affected File | `server/src/services/aiService.ts:84` |
| Test Scenario | Request `/api/v1/ai/fairness-insights` for `kidney` cohorts (`n < 20`) and `/api/v1/ai/general-assistant` containing embedded email/phone strings. |

#### How It Was Fixed
Added `stripPiiFromText` (`server/src/services/aiService.ts:84`) to scrub emails, phone numbers, and 28-character UIDs before sending user prompts, and replaced any subgroup where `isSuppressed === true` with `[SUPPRESSED < 20]` at `server/src/services/aiService.ts:510`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Prompt payload enters `askGeneralAssistant` / `generateFairnessInsights` | Request validated by Zod |
| 2 | `sanitizePromptInput` scrubs PII to `[REDACTED_EMAIL]` / `[REDACTED_PHONE]`, and fairness transform masks small cohorts with `[SUPPRESSED < 20]` | Prompt minimized |
| 3 | Verified via captured prompt inspection in `tests/aiAndServices.test.ts` | **Handled Safely** |

#### Conclusion
**Fix Verified** - Email addresses, phone numbers, and small-sample subgroup counts (`n < 20`) are never sent in outbound Gemini prompts.
