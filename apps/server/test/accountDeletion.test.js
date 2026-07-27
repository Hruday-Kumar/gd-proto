// B6 (pilot-readiness audit): the only account-deletion path is a
// founder-run script, so a wrong match here means deleting the wrong
// student's data -- this lookup is the one part worth testing before
// trusting it against a real Supabase project.
import { describe, it, expect, vi } from 'vitest';
import { findUserByEmail } from '../src/domain/accountDeletion.js';

function fakeAdminAuth(pages) {
  return {
    listUsers: vi.fn(async ({ page } = {}) => ({
      data: { users: pages[(page ?? 1) - 1] ?? [] },
      error: null,
    })),
  };
}

describe('findUserByEmail', () => {
  it('finds an exact match on the first page', async () => {
    const admin = fakeAdminAuth([[{ id: 'u1', email: 'a@example.com' }, { id: 'u2', email: 'b@example.com' }]]);
    const user = await findUserByEmail(admin, 'b@example.com');
    expect(user).toEqual({ id: 'u2', email: 'b@example.com' });
  });

  it('matches case-insensitively', async () => {
    const admin = fakeAdminAuth([[{ id: 'u1', email: 'Student@Example.com' }]]);
    const user = await findUserByEmail(admin, 'student@example.com');
    expect(user.id).toBe('u1');
  });

  it('searches subsequent pages when not found on the first', async () => {
    const admin = fakeAdminAuth([
      Array.from({ length: 1000 }, (_, i) => ({ id: `page1-${i}`, email: `p1-${i}@example.com` })),
      [{ id: 'u-page2', email: 'target@example.com' }],
    ]);
    const user = await findUserByEmail(admin, 'target@example.com');
    expect(user.id).toBe('u-page2');
    expect(admin.listUsers).toHaveBeenCalledTimes(2);
  });

  it('returns null when no user matches, without paging forever', async () => {
    const admin = fakeAdminAuth([[{ id: 'u1', email: 'a@example.com' }]]);
    const user = await findUserByEmail(admin, 'nobody@example.com');
    expect(user).toBeNull();
  });

  it('throws if listUsers errors', async () => {
    const admin = { listUsers: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }) };
    await expect(findUserByEmail(admin, 'a@example.com')).rejects.toThrow('boom');
  });
});
