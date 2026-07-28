// H7 (audit 2026-07-28): wraps the pure matchmake() decision in an
// optimistic claim-and-retry loop so concurrent /match requests can't
// double-book the same queued students into two different rooms.
// matchmake() itself is untouched -- PLAN.md is explicit that it must stay
// pure -- this only changes how its decision gets applied to the DB.
import { matchmake } from './matchmaking.js';

const DEFAULT_MAX_ATTEMPTS = 5;

export async function claimMatchOrQueue(
  joinerId,
  { listQueue, addToQueue, claimFromQueue, minGroupSize, maxGroupSize, maxAttempts = DEFAULT_MAX_ATTEMPTS }
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const queue = await listQueue();

    if (queue.some((p) => p.id === joinerId)) {
      return { type: 'already_queued' };
    }

    const result = matchmake(queue, { id: joinerId }, { minGroupSize, maxGroupSize });

    if (result.type === 'queued') {
      await addToQueue(joinerId);
      return { type: 'queued' };
    }

    const existingMemberIds = result.members.filter((m) => m.id !== joinerId).map((m) => m.id);
    if (existingMemberIds.length === 0) {
      return { type: 'matched', members: result.members };
    }

    // Atomic claim: removes exactly the rows still present. If a concurrent
    // request already claimed one of them for a different match, fewer ids
    // come back than requested -- this snapshot is stale, so fall through
    // and retry with a fresh read rather than forming a room with a
    // wrong/partial group.
    const claimedIds = await claimFromQueue(existingMemberIds);
    if (claimedIds.length === existingMemberIds.length) {
      return { type: 'matched', members: result.members };
    }

    // Partial claim: whichever ids DID come back are now genuinely removed
    // from the queue table, regardless of this attempt being abandoned.
    // Put them back rather than silently losing those students from
    // matchmaking entirely -- they re-join at the back of the queue
    // (addToQueue stamps a fresh joined_at), which is an acceptable
    // fairness cost for what should be a rare race, not a correctness bug.
    for (const id of claimedIds) {
      await addToQueue(id);
    }
  }

  throw new Error('claimMatchOrQueue: exceeded max attempts under matchmaking contention');
}
