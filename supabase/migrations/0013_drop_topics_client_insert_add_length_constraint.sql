-- N2 (AUDIT_COMPARISON_2026-07-29.md): H5's custom-topic length cap and
-- prompt delimiting are enforced in api/topics.js, but "topics_insert_own_custom"
-- (0003) still grants every authenticated browser a direct PostgREST INSERT
-- into public.topics with only a self-identity check (source = 'custom' and
-- auth.uid() = created_by) -- no length or content check. Any authenticated
-- student could call PostgREST directly, bypass the 200-char API cap
-- entirely, and store an unbounded payload (including a `"""` sequence that
-- closes the delimiter Gemini's feedback prompt relies on). That topic's id
-- can then be passed as topicId to POST /api/rooms like any other.
--
-- Every real custom-topic insert is written by the server's service-role
-- client (apps/server/src/db/topics.js's insertCustomTopic, called from
-- POST /api/topics/custom after the length check), which bypasses RLS
-- entirely -- confirmed no apps/web code inserts into topics directly
-- (apps/web only calls the API via roomsApi.js). Dropping the policy
-- removes an attack surface with zero effect on the app, identical
-- reasoning to 0011's room_participants fix. With no INSERT policy left for
-- `authenticated`, RLS defaults to deny.
--
-- The length cap is added as a table CHECK constraint, not just an RLS
-- check, so it holds regardless of which client (anon-key or service-role)
-- performs the insert -- defense in depth, matching the app's own
-- MAX_CUSTOM_TOPIC_LENGTH (apps/server/src/domain/topicText.js). Because a
-- CHECK constraint binds every future insert including the server's own
-- service-role writes, apps/server/src/domain/topicPrompt.js's
-- parseTopicResponse was updated in the same change to reject an
-- oversized Gemini response before it ever reaches this insert, so the
-- legitimate LLM-generated-topic path can never hit this constraint in
-- production.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

drop policy if exists "topics_insert_own_custom" on public.topics;

-- Any existing row over 200 chars would make the constraint fail to
-- validate. The API has capped custom topics at 200 chars since H5, and
-- LLM-generated topics ask for "one sentence", but nothing enforced this
-- at the database layer until now -- truncate first rather than have the
-- migration abort, same precautionary pattern as 0009's duration clamp.
update public.topics set text = left(text, 200) where char_length(text) > 200;

alter table public.topics
  drop constraint if exists topics_text_length;

alter table public.topics
  add constraint topics_text_length check (char_length(text) <= 200);
