# Security checklist — [change]

**Specification/diff:** [links]  
**Security reviewer/date:** [name/date]  
**Data classification:** [value]

## Identity and access

- [ ] Authentication is required at every protected entry point.
- [ ] Authorization checks resource ownership/role server-side.
- [ ] Supabase RLS is enabled and owner-isolation tests pass.
- [ ] Service-role keys remain server-only.
- [ ] LiveKit grants are least-privilege and room-scoped.

## Privacy and consent

- [ ] Recorded consent precedes microphone/transcript capture.
- [ ] Raw audio is not persisted.
- [ ] Transcript/feedback retention and account deletion remain correct.
- [ ] Logs, prompts, analytics, screenshots, and errors minimize student data.

## API and application security

- [ ] Inputs are bounded and validated; outputs/errors do not leak internals.
- [ ] CORS, security headers, rate limits, and abuse/enumeration paths reviewed.
- [ ] Retries/duplicates cannot bypass checks or corrupt state.
- [ ] Provider failures/configuration fail safely.
- [ ] New dependencies/configuration have secure defaults and no committed secret.

## Verification

- [ ] Positive and negative auth/authz tests pass.
- [ ] RLS tests pass against a representative project.
- [ ] Static/dependency scans reviewed; false positives documented.
- [ ] Variant search across similar endpoints/policies completed.
- [ ] Residual risks have owner, deadline, and approval.

**Verdict/findings:** [Ready / Blocked, with severity and evidence]

