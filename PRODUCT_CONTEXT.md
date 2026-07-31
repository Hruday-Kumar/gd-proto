# PlaceMe — Product Context Document (v2)

## What This Document Is
This document explains the PlaceMe idea in full — the problem, the users, the product, and how
every feature should behave from the user's point of view. It also defines the build sequence:
which parts of the product should be built first, and which parts are intentionally deferred.
It contains no technical instructions (no tech stack, no architecture, no code). It exists so that
anyone building this product — including an AI coding assistant — understands the *intent* behind
every feature well enough to make good implementation decisions on their own.

## The Problem
Engineering students spend years mastering their coursework, but when campus placement season
arrives, they are often blindsided. The gap isn't knowledge — it's rehearsal. Reading about a Group
Discussion is nothing like actually participating in one under time pressure, with other people
competing for airtime. Students need a way to practice speaking, thinking on their feet, and
handling interview pressure long before they're in the actual room, with a real company, in front
of a real recruiter.

## Who This Is For
College students (primarily engineering students) actively preparing for campus placements —
typically final-year or pre-final-year students in the months leading up to placement season.
They are often nervous, inexperienced at public speaking or interviews, and have limited access
to realistic practice — mock interviews with friends or seniors are hard to schedule and inconsistent
in quality.

## The Product Vision
PlaceMe is a digital practice arena — a safe, on-demand space where students can rehearse every
round of a typical placement drive, from basic aptitude tests to high-pressure HR interviews, and
get instant, easy-to-understand feedback on how to improve. Students should be able to drop in any
time, practice a specific skill for even just a few minutes, and walk away knowing exactly what to
work on next.

The tone throughout the product should feel like a supportive coach, not a strict examiner —
feedback should be constructive and actionable, never discouraging.

---

## Accounts and Identity
PlaceMe requires student accounts from the very first build. Accounts are what let the product:
- Tell participants apart within a live session (so a transcript can be attributed to the right
  person, and feedback goes to the right student)
- Match a student with the right ongoing history of past sessions and feedback
- Let a student walk away from any session and come back later to see how they've improved

This is a foundational, cross-cutting requirement — it isn't specific to any one module, and it
should exist before any module is considered "done," starting with GD Arena.

---

## Build Sequence
The product has five major pieces: the four core practice modules and the Drive Simulator. These
should **not** be built simultaneously. The intended build order is:

1. **GD Arena — Multiplayer mode.** Real students practicing together in the same room, with
   PlaceMe providing only the topic and the timer. This is the first thing to build, because it
   proves out the core loop (rooms, live transcription/attribution per speaker, individual
   feedback, history) without requiring the hardest technical problem in the product — realistic
   AI participants who interrupt and interject.
2. **GD Arena — AI Voice Practice mode.** Once multiplayer works end-to-end, add the mode where a
   student practices alone against AI-generated participants. This is deliberately sequenced second
   because it is significantly harder: it requires multiple simulated participants with distinct
   personalities, natural interruption behavior, and real-time turn-taking.
3. **The remaining modules** (JAM, Aptitude/Technical Tests, 1-on-1 Roleplay Interviews) and the
   **Drive Simulator** follow after GD Arena is solid, in an order to be decided later.

---

## The Four Core Practice Modules

### A. The Group Discussion (GD) Arena
A simulated environment where students practice making their voices heard in a group setting —
arguably the hardest interpersonal skill to rehearse alone. This is the first module being built,
in the sequence described above.

**Topics**
- Topics are generated live by an LLM, tailored to a category/difficulty the student selects.
- Alternatively, a student (or the room's creator) can type in their own custom topic instead of
  using a generated one.

**Getting into a room**
Two ways to join a multiplayer GD room, and both should exist:
- **Random matching** — the student is placed into a room with other students who are currently
  idle/available and looking to practice, without needing to coordinate with anyone in advance.
- **Shareable room code or link** — a student creates a room and shares the code/link with
  classmates so a pre-formed group can practice together intentionally.
- There is no fixed cap on how many students can be in a room.

**Multiplayer Practice (build first)**
- PlaceMe's role is to provide the structure — the topic and the timer — and let students discuss
  naturally, the same way a physical GD would work.
- Because accounts exist, each student's contributions during the discussion can be individually
  attributed to them (not just logged as an anonymous transcript).

**AI Voice Practice (build second)**
- The student selects a topic and a timer (e.g. 5 or 10 minutes).
- They are placed in a virtual room with a minimum of 3 and a maximum of 5–6 computer-generated
  "participants" who also speak.
- The student must speak out loud, make their points, and interact naturally — jumping in,
  responding to what others said, not just delivering a monologue.
- The AI participants should behave somewhat like real GD participants: they interject, sometimes
  interrupt, occasionally go off-topic or need to be steered back, and have distinct "personalities"
  (e.g. one aggressive talker, one quiet contributor) to make the practice realistic.

**Feedback (both modes)**
- Each student receives their own individual feedback after the session — not a single shared
  summary for the whole group.
- Feedback is a plain, readable written paragraph (no numeric scores, no charts) answering:
  - Did the student speak clearly?
  - Did they stay on topic?
  - Did they let others speak (vs. dominating or staying silent)?
- Because the student has an account, this feedback is saved as part of their ongoing history, so
  they can look back over past sessions and track how they're improving over time.

### B. JAM (Just A Minute) Sessions
A quick-fire speaking exercise designed to build confidence, fluency, and clear thinking under a
strict constraint.

- The student is given a random topic and a one-minute countdown timer.
- They must speak continuously for the full minute — no stopping, no excessive stuttering, no
  repeating themselves.
- The app should act like an expert communication coach when scoring: How strong was the opening
  line? Did the student maintain a good flow and structure? Did they hesitate too much, or fill
  gaps with "um"/"uh"?

### C. Aptitude & Technical Practice Tests
A straightforward way to build muscle memory for the first round of almost any company's selection
process (this round is usually the same shape everywhere — logical reasoning, quantitative aptitude,
and sometimes coding/technical MCQs).

- Students take bite-sized quizzes — 20 to 30 questions — on logic, math, or a specific coding topic
  they choose.
- Feedback is a simple dashboard: overall score, time taken per question, and a friendly nudge
  pointing out which specific topics need more work (e.g. "you're consistently slow on time-and-work
  problems — consider reviewing that topic before your next attempt").

### D. 1-on-1 Roleplay Interviews
A conversational practice round with a voice assistant acting as the interviewer — the closest
simulation to an actual interview PlaceMe offers.

- The student chooses the interview type: Technical, HR, or Managerial.
- The voice assistant asks questions out loud, appropriate to the chosen type, and the student
  answers naturally by speaking into their microphone — this should feel like a real conversation,
  not a form to fill out.
- Feedback reviews whether the student sounded confident and whether their answers matched what
  companies generally look for in that type of interview (e.g. for HR questions, whether the answer
  showed self-awareness and was well-structured; for technical questions, whether the core concept
  was actually addressed).

---

## The Crown Jewel: The Drive Simulator
While the four modules above are for everyday, general practice, the Drive Simulator is built for
one very specific and high-stakes moment: the day before a real company's interview drive.

**How it should work:**
1. When a college's Placement/Training Officer (TPO) announces that a specific company is visiting
   campus, they typically share two things: a Job Description, and a list of the rounds the company
   will run (for example: Round 1 — Aptitude, Round 2 — Technical Interview, Round 3 — HR Interview).
2. The student pastes this information — the JD and the round structure — directly into PlaceMe.
3. PlaceMe then builds a custom, continuous practice drive tailored exactly to that company and
   that round structure. It's not a generic mock test — it stitches together the relevant modules
   (aptitude questions matched to the JD's technical focus, a technical interview matched to the
   JD's skill requirements, an HR round, etc.) into one seamless practice session.
4. The student experiences the actual flow, difficulty, and context-switching of the real drive —
   moving from an aptitude test straight into a technical interview straight into an HR round, just
   like the real day — so that nothing about the actual event feels unfamiliar.

The goal of the Simulator is specifically to remove **the fear of the unknown** — students should
walk into the real interview having already experienced something extremely close to it, once,
the night before.

---

## What Success Looks Like
A student who has never done a group discussion, JAM session, or mock interview before should be
able to open PlaceMe, practice a handful of times across these modules, and walk into their actual
placement drive feeling like they've "done this before" — calmer, more fluent, and aware of their
specific weak points rather than discovering them for the first time in front of a recruiter.

---

## Open Questions (Not Yet Decided)
These are intentionally left open — they concern modules or details beyond the first build
(GD Arena) and should be revisited when work reaches them:
- Content source for JAM topics and Aptitude/Technical questions (not yet decided — GD Arena's
  live-LLM-generation approach may or may not carry over)
- Detailed feedback format for JAM, Aptitude, and Roleplay Interviews (GD Arena's plain-paragraph,
  no-score approach may or may not apply to the other modules)
- Account requirements/fields beyond "an account must exist" (e.g. what information is collected
  at signup) have not been specified
