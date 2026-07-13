import { describe, expect, it, vi } from 'vitest';

import {
  initializeServerManagedOrganization,
  runSilentTeamEncryptionMigrations,
} from '../SilentTeamEncryptionMigration';

describe('silent forced team encryption migration', () => {
  it('migrates only active legacy organizations that the caller can administer', async () => {
    const getStatus = vi.fn(async (orgId: string) => orgId === 'legacy' ? 'legacy-e2e' as const : 'server-managed' as const);
    const migrate = vi.fn(async () => undefined);

    await runSilentTeamEncryptionMigrations([
      { orgId: 'legacy', role: 'admin', membershipType: 'active_member' },
      { orgId: 'current', role: 'owner', membershipType: 'active_member' },
      { orgId: 'member', role: 'member', membershipType: 'active_member' },
      { orgId: 'pending', role: 'admin', membershipType: 'pending_member' },
    ], { getStatus, migrate });

    expect(migrate).toHaveBeenCalledTimes(1);
    expect(migrate).toHaveBeenCalledWith('legacy');
  });

  it('is best-effort and continues after one organization fails', async () => {
    const migrate = vi.fn()
      .mockRejectedValueOnce(new Error('backup gate failed'))
      .mockResolvedValueOnce(undefined);

    const result = await runSilentTeamEncryptionMigrations([
      { orgId: 'one', role: 'admin', membershipType: 'active_member' },
      { orgId: 'two', role: 'owner', membershipType: 'active_member' },
    ], {
      getStatus: vi.fn().mockResolvedValue('legacy-e2e'),
      migrate,
    });

    expect(migrate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ attempted: 2, migrated: 1, failed: ['one'] });
  });

  it('initializes new organizations directly in server-managed mode', async () => {
    const setServerManaged = vi.fn().mockResolvedValue(undefined);
    const createLegacyOrgKey = vi.fn();

    await initializeServerManagedOrganization('org-new', { setServerManaged });

    expect(setServerManaged).toHaveBeenCalledWith('org-new');
    expect(createLegacyOrgKey).not.toHaveBeenCalled();
  });
});
