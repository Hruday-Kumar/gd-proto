# Regression checklist — [change]

**Specification/diff:** [links]  
**Reviewer/date:** [name/date]

## Blast radius

- [ ] Direct callers and consumers identified.
- [ ] Shared domain modules, API routes, DB tables/policies, and provider paths
      identified.
- [ ] State transitions, retries, duplicate events, disconnects, and shutdown
      reviewed.
- [ ] Config, migration, deployment, and backward compatibility reviewed.

## Core regression areas

- [ ] authentication and email-confirmation flow;
- [ ] authorization and own-resource access;
- [ ] recorded consent before mic;
- [ ] room creation/join/capacity/duration;
- [ ] matching and room state;
- [ ] live audio permissions and participant cleanup;
- [ ] transcription/attribution ordering;
- [ ] feedback generation/retry/idempotency;
- [ ] history and account deletion;
- [ ] rate limits, CORS, health, and error handling.

## Evidence

| Area | Test/inspection | Result | Gap |
|---|---|---|---|
| [area] | [command/path] | [pass/fail] | [gap] |

**Verdict and residual risk:** [summary]

