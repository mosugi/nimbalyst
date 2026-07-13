export interface MigrationCandidate {
  orgId: string;
  role: string;
  membershipType?: string;
}

export interface SilentMigrationDependencies {
  getStatus: (orgId: string) => Promise<'legacy-e2e' | 'server-managed'>;
  migrate: (orgId: string) => Promise<unknown>;
  onStateChange?: (orgId: string, state: SilentMigrationState) => void;
}

export type SilentMigrationState =
  | { status: 'migrating'; startedAt: string }
  | { status: 'complete'; finishedAt: string }
  | { status: 'stuck'; failedAt: string; message: string };

const migrationStates = new Map<string, SilentMigrationState>();
const inFlight = new Set<string>();

export async function initializeServerManagedOrganization(
  orgId: string,
  dependencies: { setServerManaged: (orgId: string) => Promise<void> },
): Promise<void> {
  if (!orgId) throw new Error('orgId required');
  await dependencies.setServerManaged(orgId);
}

export function getSilentMigrationState(orgId: string): SilentMigrationState | null {
  return migrationStates.get(orgId) ?? null;
}

function canAdminister(candidate: MigrationCandidate): boolean {
  const role = candidate.role.toLowerCase();
  return role === 'admin' || role === 'owner';
}

export async function runSilentTeamEncryptionMigrations(
  candidates: MigrationCandidate[],
  dependencies: SilentMigrationDependencies,
): Promise<{ attempted: number; migrated: number; failed: string[] }> {
  let attempted = 0;
  let migrated = 0;
  const failed: string[] = [];

  for (const candidate of candidates) {
    if (candidate.membershipType && candidate.membershipType !== 'active_member') continue;
    if (!canAdminister(candidate) || inFlight.has(candidate.orgId)) continue;
    if (await dependencies.getStatus(candidate.orgId) !== 'legacy-e2e') continue;

    attempted += 1;
    inFlight.add(candidate.orgId);
    const migrating: SilentMigrationState = { status: 'migrating', startedAt: new Date().toISOString() };
    migrationStates.set(candidate.orgId, migrating);
    dependencies.onStateChange?.(candidate.orgId, migrating);
    try {
      await dependencies.migrate(candidate.orgId);
      migrated += 1;
      const complete: SilentMigrationState = { status: 'complete', finishedAt: new Date().toISOString() };
      migrationStates.set(candidate.orgId, complete);
      dependencies.onStateChange?.(candidate.orgId, complete);
    } catch (error) {
      failed.push(candidate.orgId);
      const stuck: SilentMigrationState = {
        status: 'stuck',
        failedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      };
      migrationStates.set(candidate.orgId, stuck);
      dependencies.onStateChange?.(candidate.orgId, stuck);
    } finally {
      inFlight.delete(candidate.orgId);
    }
  }

  return { attempted, migrated, failed };
}
