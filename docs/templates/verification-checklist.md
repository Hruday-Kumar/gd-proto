# Verification checklist — [change]

**Specification:** [path]  
**Commit/release:** [SHA/version]  
**Verifier:** [name]  
**Environment/date:** [environment, timestamp]

## Traceability

- [ ] Specification is approved and unchanged requirements are identified.
- [ ] Every requirement and acceptance criterion maps to code and evidence.
- [ ] Non-goals were not implemented.
- [ ] Applicable ADRs and guardrails are satisfied.

## Automated evidence

- [ ] Unit tests: `[command]` → [result]
- [ ] Integration/RLS tests: `[command]` → [result]
- [ ] Lint: `[command]` → [result]
- [ ] Build: `[command]` → [result]
- [ ] Security/static/dependency checks: `[command]` → [result]

## Behavioral evidence

- [ ] Happy path verified.
- [ ] Authorization/consent negative paths verified.
- [ ] Invalid input, duplicate action, timeout, retry, and provider failure tested.
- [ ] Required real-person/device verification recorded.

## Operational evidence

- [ ] Monitoring and alert owner verified.
- [ ] Rollout and stop conditions verified.
- [ ] Rollback or forward-recovery procedure verified.
- [ ] Documentation and runbooks match actual behavior.

## Result

**Verdict:** [Ready / Ready with accepted risk / Blocked]  
**Residual risk and follow-ups:** [items, owners, deadlines]

