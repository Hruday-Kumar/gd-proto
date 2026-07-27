// B6 (pilot-readiness audit): DPDP right-to-erasure has no self-serve UI
// yet -- a founder runs scripts/delete-account.js against a student's
// emailed request. supabase-js's admin API has no getUserByEmail in this
// version, only paginated listUsers, so this walks pages looking for an
// exact (case-insensitive) match.
const USERS_PER_PAGE = 1000;
const MAX_PAGES = 50; // guards against paging forever if something's wrong

export async function findUserByEmail(adminAuth, email) {
  const target = email.trim().toLowerCase();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await adminAuth.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;

    if (users.length < USERS_PER_PAGE) return null; // last page, exhausted
  }
  return null;
}
