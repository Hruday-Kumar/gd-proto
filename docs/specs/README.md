# Specifications

Specifications are the contract between an idea and its implementation.

- `active/`: draft, in-review, approved, implementing, or verifying work.
- `completed/`: verified and shipped work with evidence retained.
- `archived/`: rejected, superseded, or abandoned work with an archive reason.

Name specifications `<type>-<yyyy>-<short-slug>.md` or use an issue-linked ID
such as `SPEC-0042-short-slug.md`. Every significant pull request must link one
approved specification.

Use the relevant file in `docs/templates/` and keep the status, owner, approvers,
issue/PR links, implementation tasks, verification, rollout, and rollback
current. Do not erase historical decisions; amend or supersede them.

