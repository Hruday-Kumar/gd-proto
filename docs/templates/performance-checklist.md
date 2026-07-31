# Performance checklist — [change]

**Specification/release:** [link]  
**Reviewer/environment/date:** [values]

## Budget and workload

- [ ] Expected pilot concurrency and room size documented.
- [ ] Request, database, provider, CPU/memory, and frontend-size budgets defined.
- [ ] Test dataset and network/device assumptions are representative.

## Review

- [ ] No unbounded loop, queue, listener, retry, or in-memory accumulation.
- [ ] Queries have appropriate filters/indexes and avoid per-row round trips.
- [ ] Timeouts, backoff, cancellation, and concurrency limits are explicit.
- [ ] LiveKit/AssemblyAI/Gemini/Supabase limits and 429 behavior are handled.
- [ ] Frontend bundle/network impact is measured for campus/mobile conditions.
- [ ] Logs/metrics do not create excessive cost or expose personal data.

## Evidence

| Metric | Baseline | Target | Observed | Result |
|---|---:|---:|---:|---|
| [metric] | [value] | [value] | [value] | Pending |

## Decision

**Verdict:** [Pass/Conditional/Fail]  
**Capacity limit, alerts, and follow-ups:** [details]

