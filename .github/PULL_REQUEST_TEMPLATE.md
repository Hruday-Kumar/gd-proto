<!--
Target feature/fix PRs at `dev`; production releases are `dev` → `main`.
See docs/engineering/BRANCHING.md and ENGINEERING.md.
-->

## Summary

<!-- What changed, why, and the user/operator outcome. -->

## Specification

- Issue: <!-- link -->
- Approved specification: <!-- docs/specs/active/... -->
- Specification status/approval: <!-- link or name/date -->
- Requirements delivered: <!-- IDs -->
- Non-goals preserved: <!-- list -->

## Design review

- Architecture review: <!-- link, name/date, or N/A with reason -->
- ADRs: <!-- links or N/A -->
- API/schema/provider/concurrency decisions: <!-- concise summary -->
- Implementation summary: <!-- files/contracts changed and key decisions -->

## Tests

<!-- Exact commands and fresh results. "It compiles" is not sufficient. -->

- Unit: <!-- command/result -->
- Integration/API/RLS: <!-- command/result -->
- Regression: <!-- scope/result -->
- Lint: `npm run lint` → <!-- result -->
- Build: `npm run build` → <!-- result -->
- Manual/browser/real-device: <!-- environment, personas/devices, result -->

## Security review

- Reviewer/evidence: <!-- link, name/date -->
- Authentication/authorization/RLS: <!-- result or N/A -->
- Consent/retention/account deletion: <!-- result or N/A -->
- Secrets/input/rate limits/CORS/dependencies: <!-- result or N/A -->
- Findings/accepted risk: <!-- links, owners, deadlines -->

## Verification

| Acceptance criterion | Evidence | Result |
|---|---|---|
| <!-- AC1 --> | <!-- test/manual evidence --> | <!-- pass/fail --> |

<!-- Room/audio/transcription/attribution/feedback changes require real-person evidence. -->

## Rollout

<!-- Deployment/migration/config sequence, cohort/phases, success and stop conditions. -->

## Rollback

<!-- Trigger, exact application/data/config recovery, owner, and verification. -->

## Monitoring

<!-- Signals, thresholds, dashboards/log names, alert owner, observation window. -->

## Documentation

<!-- Specifications, ADRs, architecture, API/schema, runbooks, user/support, PROGRESS/LESSONS. -->

## Pilot impact

<!-- Cohort, provider limits/cost, support, privacy, real-person validation, or N/A with reason. -->

## Screenshots / recording

<!-- Required for UI changes. Redact tokens, emails, transcripts, and personal data. -->

## Checklist

- [ ] Approved specification is linked; implementation is within scope.
- [ ] Design/ADR review is complete where required.
- [ ] Tests were written/updated and fresh test results are recorded.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass.
- [ ] Regression and concurrency/failure paths were reviewed.
- [ ] Security, consent, RLS, retention, secrets, and API impact were reviewed.
- [ ] Acceptance criteria have evidence; human verification is complete where required.
- [ ] Migrations include apply, verification, and recovery steps.
- [ ] Monitoring, rollout, stop conditions, and rollback are documented.
- [ ] Documentation and implementation summary are updated.
- [ ] Pilot impact and provider limits are reviewed.
- [ ] No secret values, raw audio, or unnecessary personal data are committed.
- [ ] Definition of Done in `ENGINEERING.md` is satisfied or gaps are explicit blockers.
