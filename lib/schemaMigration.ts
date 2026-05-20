/**
 * Schema Versioning & Migrations
 * 
 * Every AnnotationDocument has a version field. When the schema changes,
 * a migration is added here. Documents auto-upgrade on load.
 * Same concept as database migrations — v1→v2→v3, never breaks old data.
 */

export interface Migration {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
}

/** Current schema version. Bump this when adding a new migration. */
export const CURRENT_SCHEMA_VERSION = '2.0';

/**
 * Ordered list of migrations. Each transforms from one version to the next.
 * NEVER modify an existing migration — only append new ones.
 */
const MIGRATIONS: Migration[] = [
  {
    fromVersion: '1.0',
    toVersion: '2.0',
    description: 'Add auth-ready fields, deviceId, sync metadata. Normalize annotation IDs.',
    migrate: (doc) => {
      const migrated = { ...doc };

      // A9: Auth-ready fields
      if (!migrated.userId) migrated.userId = null;
      if (!migrated.workspaceId) migrated.workspaceId = null;
      if (!migrated.sharedWith) migrated.sharedWith = [];
      if (!migrated.deviceId) migrated.deviceId = null;

      // Add sync metadata
      if (!migrated.syncMetadata) {
        migrated.syncMetadata = {
          lastSyncedAt: null,
          syncVersion: 0,
          isDirty: true,
        };
      }

      // Ensure all annotation pages have consistent structure
      if (Array.isArray(migrated.annotations)) {
        migrated.annotations = (migrated.annotations as Record<string, unknown>[]).map((page: Record<string, unknown>) => ({
          ...page,
          annotations: Array.isArray(page.annotations)
            ? (page.annotations as Record<string, unknown>[]).map((ann: Record<string, unknown>) => ({
                ...ann,
                // Ensure lastModified exists
                lastModified: ann.lastModified || ann.timestamp || new Date().toISOString(),
              }))
            : [],
        }));
      }

      migrated.version = '2.0';
      return migrated;
    },
  },
  // Future migrations go here:
  // {
  //   fromVersion: '2.0',
  //   toVersion: '3.0',
  //   description: '...',
  //   migrate: (doc) => { ... },
  // },
];

/**
 * Run all necessary migrations on a document to bring it to the current version.
 * Returns the migrated document and a log of migrations applied.
 */
export function migrateDocument(
  doc: Record<string, unknown>
): { document: Record<string, unknown>; migrationsApplied: string[] } {
  let current = { ...doc };
  const applied: string[] = [];
  let version = (current.version as string) || '1.0';

  // Find and apply migrations in sequence
  let safety = 0;
  while (version !== CURRENT_SCHEMA_VERSION && safety < 50) {
    const migration = MIGRATIONS.find(m => m.fromVersion === version);
    if (!migration) {
      // No migration path found — document is either current or unsupported
      if (version !== CURRENT_SCHEMA_VERSION) {
        console.warn(
          `[SchemaMigration] No migration path from v${version} to v${CURRENT_SCHEMA_VERSION}. Document may have unknown version.`
        );
      }
      break;
    }

    current = migration.migrate(current);
    applied.push(`${migration.fromVersion}→${migration.toVersion}: ${migration.description}`);
    version = migration.toVersion;
    safety++;
  }

  return { document: current, migrationsApplied: applied };
}

/**
 * Check if a document needs migration.
 */
export function needsMigration(doc: Record<string, unknown>): boolean {
  const version = (doc.version as string) || '1.0';
  return version !== CURRENT_SCHEMA_VERSION;
}

/**
 * Get the migration path for a given version.
 */
export function getMigrationPath(fromVersion: string): Migration[] {
  const path: Migration[] = [];
  let version = fromVersion;
  let safety = 0;

  while (version !== CURRENT_SCHEMA_VERSION && safety < 50) {
    const migration = MIGRATIONS.find(m => m.fromVersion === version);
    if (!migration) break;
    path.push(migration);
    version = migration.toVersion;
    safety++;
  }

  return path;
}
