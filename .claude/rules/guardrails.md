# Guardrails — never violate these silently

These are hard rules for any agent working on PlaceMe. If a task seems to require breaking one, STOP and ask the user instead.

1. **Human verification gate for room/audio features.** Never mark any room, audio, transcription, attribution, or feedback feature "done" on automated tests alone. A real human (multiple real people for room features) must actually use it in a working environment and confirm speech is attributed to the right speaker and feedback reads as useful and non-discouraging.

2. **No scope creep.** Never build, research, or ADR anything outside the v1 MVP boundary (see CLAUDE.md) without explicit user approval. Deferred items stay deferred and are named as such.

3. **Consent before mic, always.** Never enable a microphone or capture/store audio, transcripts, or derived data without explicit recorded consent from that student first.

4. **Minimize retention.** Delete raw audio immediately after successful transcription. Keep only transcript + feedback, until account deletion. A student can access only their own history. (India DPDP.)

5. **Spike before the real-time ADR.** Never write the WebRTC/room or STT ADR until the Phase 0a de-risk spike (3+ real browser clients → correctly attributed transcript) has actually been run and reported.

6. **Live research, cited.** For Phase 0b, get current pricing/versions/benchmarks from live web sources with citations. Do not rely on training-data recall for these numbers.

7. **Mainstream + maintainable only.** The team is agent-dependent and new to the stack. Prefer widely-adopted, well-documented, managed-where-possible technology. Do not introduce niche/clever tech the team + an agent cannot realistically maintain. Explain choices in plain terms.

8. **Don't re-litigate fixed constraints.** Scale, budget, retention, compliance, timeline, TDD, cloud-agnostic/containerized, and the MVP boundary are decided (see CLAUDE.md). Build within them.

9. **Session discipline.** Do Phase 0a, Phase 0b, and Phase 1 as separate sessions. Within 0b, one category (research + ADR) at a time. Within Phase 1, one feature's core units at a time. Update docs/engineering/PROGRESS.md at the end of every session.

10. **Justify, don't invent.** Every non-trivial decision must trace to the vision doc or a fixed constraint. Never invent requirements. When ambiguous or blocked, ask.

11. **Maintain the technology glossary.** The first time any new library, service, or tool is introduced (spike or real build), add an entry to `docs/engineering/LESSONS.md`: what it is (plain language), why we use it, free tier/cost, whether it's open source (+ license), docs link, and any gotchas hit. Do this as you go — don't defer it to Phase 0b research.
