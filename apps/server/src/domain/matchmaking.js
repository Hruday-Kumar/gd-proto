// Matchmaking decision (W4 core unit, PHASE1_PLAN.md §5). Pure: given the
// current queue and a joiner, decide whether to add them to the queue or
// form a room. Storage of the queue itself is a separate, later concern
// (§8 open decision — in-memory vs DB-backed) so this stays testable
// without a live queue.
//
// minGroupSize/maxGroupSize are required, caller-supplied thresholds, not
// hardcoded defaults — the actual numbers are a product decision made when
// wiring up persistence, not invented in domain logic (guardrail #10).
export function matchmake(queue, joiner, { minGroupSize, maxGroupSize }) {
  if (maxGroupSize < minGroupSize) {
    throw new Error('Invalid group size configuration: maxGroupSize must be >= minGroupSize');
  }
  if (queue.some((p) => p.id === joiner.id)) {
    throw new Error(`Joiner ${joiner.id} is already in the queue`);
  }

  const candidates = [...queue, joiner];
  if (candidates.length < minGroupSize) {
    return { type: 'queued', queue: candidates };
  }

  const groupSize = Math.min(candidates.length, maxGroupSize);
  return {
    type: 'matched',
    members: candidates.slice(0, groupSize),
    remainingQueue: candidates.slice(groupSize),
  };
}
