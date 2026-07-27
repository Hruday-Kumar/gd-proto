// B6 (pilot-readiness audit): manual, founder-run DPDP right-to-erasure
// process. A student emails a deletion request; a founder runs this
// script -- dry run first, then --confirm.
//
// Deleting the auth.users row cascades everything that identifies the
// student (profile, consents, room_participants, transcript_lines,
// feedback, matchmaking_queue -- all `on delete cascade` in the
// migrations). Rooms they *created* are kept with created_by set to NULL
// (`on delete set null`) so other participants' history/transcripts don't
// disappear because one member of their group left.
//
// Usage:
//   node scripts/delete-account.js <email>            # dry run
//   node scripts/delete-account.js <email> --confirm   # actually deletes
import 'dotenv/config';
import { getSupabase } from '../src/db/supabase.js';
import { findUserByEmail } from '../src/domain/accountDeletion.js';

async function countRows(supabase, table, userId) {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const [, , email, flag] = process.argv;
  if (!email) {
    console.error('Usage: node scripts/delete-account.js <email> [--confirm]');
    process.exit(1);
  }

  const supabase = getSupabase();
  const user = await findUserByEmail(supabase.auth.admin, email);
  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  console.log(`Found account: ${user.email} (id ${user.id}), created ${user.created_at}`);

  const [participants, feedback, transcriptLines, consents] = await Promise.all([
    countRows(supabase, 'room_participants', user.id),
    countRows(supabase, 'feedback', user.id),
    countRows(supabase, 'transcript_lines', user.id),
    countRows(supabase, 'consents', user.id),
  ]);

  console.log('\nThis will permanently delete (via ON DELETE CASCADE from auth.users):');
  console.log('  - 1 profile row');
  console.log(`  - ${participants} room_participants row(s)`);
  console.log(`  - ${feedback} feedback row(s)`);
  console.log(`  - ${transcriptLines} transcript_lines row(s)`);
  console.log(`  - ${consents} consent record(s)`);
  console.log('\nAny rooms this student created are KEPT (created_by -> NULL) so other');
  console.log('participants keep their own history and transcripts.');

  if (flag !== '--confirm') {
    console.log('\nDry run only -- nothing deleted. Re-run with --confirm to proceed.');
    return;
  }

  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('Deletion failed:', error.message);
    process.exit(1);
  }
  console.log(`\nDeleted account ${email} (id ${user.id}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
