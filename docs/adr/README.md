# Architecture decision records

The historical PlaceMe ADRs are in [`../engineering/adr/`](../engineering/adr/).
They remain authoritative and must not be rewritten merely to fit this newer
directory layout.

For a new decision:

1. Copy `docs/templates/architecture-decision-record.md` here.
2. Use the next four-digit sequence and a short slug, for example
   `0010-provider-failover.md`.
3. Set status to `Proposed`, obtain design/security review, then mark it
   `Accepted`, `Rejected`, or `Superseded`.
4. Link the governing specification and implementation PR.
5. If superseding an older ADR, update both records with reciprocal links.

ADRs record decisions and tradeoffs; specifications define deliverable behavior.

