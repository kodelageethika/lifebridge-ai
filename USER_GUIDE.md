# User Guide — LifeBridge AI

This guide walks through the public, patient, clinical, administrative, and AI-assisted journeys supported in LifeBridge AI.

---

## 1. Public Portal & Donor Pledge Registration

1. Visit the home screen to explore the **Public Organ Pledge** flow and organ category guides (`kidney`, `liver`, `heart`, `lung`, `pancreas`, `intestine`).
2. Submit the **Register Donor Pledge** form (`POST /api/v1/pledges`) with age, blood group, and consented organs to persist a new anonymized donor profile immediately.
3. Click **Sign In** in the top navigation bar to open the Authentication modal:
   - Sign in with email/password, use any pre-seeded demo persona quick-fill button, register a new `donor` or `recipient` account, request/confirm a password reset, or sign in via Google (Firebase Auth with verified email check).

---

## 2. Donor & Recipient Self-Service Portals & AI Guidance

- **Role-Scoped AI Assistant**: Once signed in, the floating **AI Guidance** button opens a contextual assistant scoped strictly to your signed-in role (`donor`, `recipient`, or clinical staff). Unauthenticated visitors never see clinical AI controls.
- **Donor Portal (`donor@lifebridge.demo`)**:
  - View only your linked donor registration (`anonymizedCode`, blood group, hospital).
  - Toggle individual organ consent preferences (Kidney, Liver, Heart, Lung, Pancreas, Intestine) with instant backend persistence and audit logging.
  - Submit a written **Consent Withdrawal** reason (`>= 5` chars) to halt matching immediately, or click **Reinstate Consent** to reactivate eligibility.
- **Recipient Portal (`recipient@lifebridge.demo`)**:
  - View only your linked waitlist entry, blood group compatibility status, and urgency tier.
  - Click **Generate AI Profile Summary** (`POST /api/v1/ai/recipient-summary`) for a plain-language advisory summary of your own verified readiness status and clinical factors.
  - Inspect post-transplant recovery adherence metrics and clinician notes if a recovery record is linked.

---

## 3. Clinical & Operational Dashboards

### Transplant Coordinator (`coordinator@lifebridge.demo`)
- **Command Center**: Register new donors (`+ Register Donor`) or waitlist recipients (`+ Add Recipient`), monitor unresolved attention tasks, and switch across clinical tabs.
- **Explainable Matching**: Select any retrieved organ (`ORG-K704` Kidney, `ORG-L302` Liver, `ORG-H109` Heart), run the deterministic allocation scorer, inspect factor contributions (`HLA Compatibility`, `Clinical Urgency`, `Waitlist Time`, `Logistics Feasibility`), resolve blocking **Data-Quality Hold Flags**, and click **Explain Match with Gemini AI** for an advisory factor narrative (never alters ranks or scores).
- **Approval Workflows**: Advance cases from `COORDINATOR_REVIEW` to `MEDICAL_REVIEW` and generate **Gemini AI Clinical Documentation** drafts explicitly badged `Requires Qualified Medical Review`.
- **Logistics & Preservation**: Track live preservation expiry countdowns, record cryptographic custody handovers (`Custodian Name`, `Stage`, `Cold-Ischemia °C`), trigger emergency corridor escalations, and resolve active escalation alerts.
- **Fairness & Simulator**: Inspect subgroup parity across all 6 organs (with `n < 20` statistical suppression safeguards), generate **Gemini AI Fairness & Equity Insights** (preserving `[SUPPRESSED < 20]` cohorts), and run persisted side-by-side counterfactual scenarios without affecting production allocation rules.

### Transplant Surgeon (`surgeon@lifebridge.demo`)
- **Approval & Override Sign-Off**: Review advisory AI case briefs, inspect ranked candidates in **Approval Workflows**, and execute human-authorized `STANDARD_APPROVAL`, `CLINICAL_OVERRIDE` (minimum 15-character medical justification enforced), or `REJECTION`.
- **Recovery Tracker**: Update post-operative recipient graft status, medication adherence percentage, and clinician follow-up notes.

### Hospital Staff (`hospital@lifebridge.demo`)
- Manage real-time ICU / surgical team **Hospital Readiness** toggles across all 6 organ capabilities, log intake donors/recipients, and record transport custody arrivals.

### System Administrator (`admin@lifebridge.demo`)
- **User Governance**: Inspect all platform accounts and toggle `ACTIVE` / `SUSPENDED` status safely (self-suspension blocked).
- **Policy Configuration**: Adjust organ-level scoring weights (enforced sum `= 1.00`) and publish updated ruleset hashes cleanly.
- **Cryptographic Audit Ledger**: Filter audit events by keyword or role, verify server-side SHA-256 + HMAC-SHA256 signatures, and demonstrate tamper detection (`Simulate Tamper`) and restoration (`Restore Valid Chain`).
