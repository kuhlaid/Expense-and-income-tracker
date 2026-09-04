import { db } from './index.ts';
import {
  databaseBackups,
  logs,
  starterLogs,
  categoryType,
  tagType,
  tagLogAssn,
  users,
  type DatabaseBackup,
} from './schema.ts';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

export interface DatabaseSnapshotPayload {
  version: string;
  timestamp: string;
  generatedAt: string;
  backupType: 'automatic_monthly' | 'manual';
  counts: {
    logs: number;
    starterLogs: number;
    categoryTypes: number;
    tagTypes: number;
    tagLogAssns: number;
    total: number;
  };
  tables: {
    categoryTypes: any[];
    tagTypes: any[];
    logs: any[];
    starterLogs: any[];
    tagLogAssns: any[];
  };
}

export interface BackupSummary {
  id: number;
  userId: number | null;
  name: string;
  backupType: string;
  recordCount: number;
  fileSizeKb: string | null;
  createdAt: Date | null;
}

/**
 * Get list of backups (without the heavy snapshotData payload for list performance)
 */
export async function getDatabaseBackups(userId?: number): Promise<BackupSummary[]> {
  try {
    const query = db
      .select({
        id: databaseBackups.id,
        userId: databaseBackups.userId,
        name: databaseBackups.name,
        backupType: databaseBackups.backupType,
        recordCount: databaseBackups.recordCount,
        fileSizeKb: databaseBackups.fileSizeKb,
        createdAt: databaseBackups.createdAt,
      })
      .from(databaseBackups)
      .orderBy(desc(databaseBackups.createdAt));

    if (userId) {
      return await query.where(eq(databaseBackups.userId, userId));
    }
    return await query;
  } catch (error: any) {
    console.error('Failed to get database backups:', error);
    throw new Error(error.message || 'Failed to retrieve backups', { cause: error });
  }
}

/**
 * Get full backup with snapshot payload
 */
export async function getBackupById(id: number, userId?: number): Promise<DatabaseBackup | null> {
  try {
    const whereClause = userId
      ? and(eq(databaseBackups.id, id), eq(databaseBackups.userId, userId))
      : eq(databaseBackups.id, id);

    const [backup] = await db.select().from(databaseBackups).where(whereClause);
    return backup || null;
  } catch (error: any) {
    console.error('Failed to get backup by ID:', error);
    throw new Error(error.message || 'Failed to retrieve backup', { cause: error });
  }
}

/**
 * Generate full snapshot data structure from live database
 */
export async function compileLiveSnapshot(
  userId?: number,
  backupType: 'automatic_monthly' | 'manual' = 'manual'
): Promise<DatabaseSnapshotPayload> {
  const [catRows, tagRows, logRows, starterRows, assnRows] = await Promise.all([
    userId ? db.select().from(categoryType).where(eq(categoryType.userId, userId)) : db.select().from(categoryType),
    userId ? db.select().from(tagType).where(eq(tagType.userId, userId)) : db.select().from(tagType),
    userId ? db.select().from(logs).where(eq(logs.userId, userId)).orderBy(desc(logs.logDate)) : db.select().from(logs).orderBy(desc(logs.logDate)),
    userId ? db.select().from(starterLogs).where(eq(starterLogs.userId, userId)) : db.select().from(starterLogs),
    db.select().from(tagLogAssn),
  ]);

  const total =
    catRows.length +
    tagRows.length +
    logRows.length +
    starterRows.length +
    assnRows.length;

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    generatedAt: new Date().toLocaleString('en-US', { timeZoneName: 'short' }),
    backupType,
    counts: {
      categoryTypes: catRows.length,
      tagTypes: tagRows.length,
      logs: logRows.length,
      starterLogs: starterRows.length,
      tagLogAssns: assnRows.length,
      total,
    },
    tables: {
      categoryTypes: catRows,
      tagTypes: tagRows,
      logs: logRows,
      starterLogs: starterRows,
      tagLogAssns: assnRows,
    },
  };
}

/**
 * Create a new database backup snapshot and store in database_backups table
 */
export async function createDatabaseBackup(
  userId?: number,
  customName?: string,
  backupType: 'automatic_monthly' | 'manual' = 'manual'
): Promise<DatabaseBackup> {
  try {
    const snapshot = await compileLiveSnapshot(userId, backupType);
    const serialized = JSON.stringify(snapshot, null, 2);
    const sizeInKb = (Buffer.byteLength(serialized, 'utf8') / 1024).toFixed(2);

    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const defaultName =
      backupType === 'automatic_monthly'
        ? `Automatic Monthly Backup - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        : `Manual Snapshot (${dateStr} - ${snapshot.counts.logs} logs)`;

    const name = customName?.trim() || defaultName;

    const [created] = await db
      .insert(databaseBackups)
      .values({
        userId: userId || null,
        name,
        backupType,
        recordCount: snapshot.counts.total,
        fileSizeKb: String(sizeInKb),
        snapshotData: serialized,
      })
      .returning();

    return created;
  } catch (error: any) {
    console.error('Failed to create database backup:', error);
    throw new Error(error.message || 'Failed to create database backup', { cause: error });
  }
}

/**
 * Check if a backup exists for the current month. If not, automatically create one.
 * Ensures at least one automatic backup exists per calendar month.
 */
export async function checkAndCreateMonthlyBackup(userId?: number): Promise<{
  created: boolean;
  backup?: DatabaseBackup;
  reason: string;
}> {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Look for any automated monthly backup made since the beginning of this month
    const existing = await db
      .select({ id: databaseBackups.id, createdAt: databaseBackups.createdAt })
      .from(databaseBackups)
      .where(
        userId
          ? and(
              eq(databaseBackups.userId, userId),
              eq(databaseBackups.backupType, 'automatic_monthly'),
              gte(databaseBackups.createdAt, firstDayOfMonth)
            )
          : and(
              eq(databaseBackups.backupType, 'automatic_monthly'),
              gte(databaseBackups.createdAt, firstDayOfMonth)
            )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        created: false,
        reason: `Monthly backup already exists for ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      };
    }

    // Also check total log count — if user has data, create backup
    const newBackup = await createDatabaseBackup(userId, undefined, 'automatic_monthly');
    console.log(
      `[Backup Scheduler] Created automatic monthly backup for ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} with ${newBackup.recordCount} records.`
    );
    return {
      created: true,
      backup: newBackup,
      reason: `Automated monthly backup created for ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    };
  } catch (error: any) {
    console.error('Error during automatic monthly backup check:', error);
    return {
      created: false,
      reason: error.message || 'Failed monthly backup check',
    };
  }
}

/**
 * Delete a database backup by ID
 */
export async function deleteDatabaseBackup(id: number, userId?: number): Promise<boolean> {
  try {
    const whereClause = userId
      ? and(eq(databaseBackups.id, id), eq(databaseBackups.userId, userId))
      : eq(databaseBackups.id, id);

    const deleted = await db.delete(databaseBackups).where(whereClause).returning();
    return deleted.length > 0;
  } catch (error: any) {
    console.error('Failed to delete database backup:', error);
    throw new Error(error.message || 'Failed to delete backup', { cause: error });
  }
}

/**
 * Restore database from a snapshot object
 */
export async function restoreDatabaseFromSnapshot(
  snapshot: DatabaseSnapshotPayload,
  userId?: number
): Promise<{ success: boolean; restoredCounts: Record<string, number> }> {
  try {
    if (!snapshot || !snapshot.tables) {
      throw new Error('Invalid snapshot payload format.');
    }

    const { categoryTypes: catList = [], tagTypes: tagList = [], logs: logList = [], starterLogs: starterList = [], tagLogAssns: assnList = [] } = snapshot.tables;

    // Delete current data for this user
    if (userId) {
      await db.delete(tagLogAssn).where(
        sql`log_id IN (SELECT id FROM logs WHERE user_id = ${userId})`
      );
      await db.delete(logs).where(eq(logs.userId, userId));
      await db.delete(starterLogs).where(eq(starterLogs.userId, userId));
    } else {
      await db.delete(tagLogAssn);
      await db.delete(logs);
      await db.delete(starterLogs);
    }

    // Map old lookup IDs to new/existing IDs if necessary
    // Insert category types if not present
    for (const cat of catList) {
      const existing = await db.select().from(categoryType).where(
        userId ? and(eq(categoryType.name, cat.name), eq(categoryType.userId, userId)) : eq(categoryType.name, cat.name)
      );
      if (existing.length === 0) {
        await db.insert(categoryType).values({
          userId: userId || null,
          name: cat.name,
        });
      }
    }

    // Insert tag types if not present
    for (const tag of tagList) {
      const existing = await db.select().from(tagType).where(
        userId ? and(eq(tagType.name, tag.name), eq(tagType.userId, userId)) : eq(tagType.name, tag.name)
      );
      if (existing.length === 0) {
        await db.insert(tagType).values({
          userId: userId || null,
          name: tag.name,
        });
      }
    }

    // Insert logs in chunks
    const restoredLogs: any[] = [];
    const chunkSize = 50;
    for (let i = 0; i < logList.length; i += chunkSize) {
      const chunk = logList.slice(i, i + chunkSize);
      const rows = chunk.map((l: any) => ({
        userId: userId || null,
        logDate: l.logDate || l.log_date || new Date().toISOString().split('T')[0],
        logDescription: l.logDescription || l.log_description || null,
        logAmount: l.logAmount || l.log_amount ? String(l.logAmount || l.log_amount) : null,
        logCategory: l.logCategory || l.log_category || null,
        reconciled: l.reconciled !== undefined ? Boolean(l.reconciled) : true,
      }));
      const inserted = await db.insert(logs).values(rows).returning();
      restoredLogs.push(...inserted);
    }

    // Insert starter logs in chunks
    const restoredStarters: any[] = [];
    for (let i = 0; i < starterList.length; i += chunkSize) {
      const chunk = starterList.slice(i, i + chunkSize);
      const rows = chunk.map((s: any) => ({
        userId: userId || null,
        logDate: s.logDate || s.log_date || new Date().toISOString().split('T')[0],
        logDescription: s.logDescription || s.log_description || null,
        logAmount: s.logAmount || s.log_amount ? String(s.logAmount || s.log_amount) : null,
        logCategory: s.logCategory || s.log_category || null,
        reconciled: s.reconciled !== undefined ? Boolean(s.reconciled) : false,
      }));
      const inserted = await db.insert(starterLogs).values(rows).returning();
      restoredStarters.push(...inserted);
    }

    return {
      success: true,
      restoredCounts: {
        logs: restoredLogs.length,
        starterLogs: restoredStarters.length,
        total: restoredLogs.length + restoredStarters.length,
      },
    };
  } catch (error: any) {
    console.error('Failed to restore from snapshot:', error);
    throw new Error(error.message || 'Failed to restore database from snapshot', { cause: error });
  }
}

/**
 * Generate SQL dump statements from snapshot
 */
export function generateSqlDump(snapshot: DatabaseSnapshotPayload): string {
  const lines: string[] = [
    `-- Expenses & Income Tracker SQL Database Backup`,
    `-- Generated At: ${snapshot.generatedAt || new Date().toISOString()}`,
    `-- Version: ${snapshot.version}`,
    `-- Backup Type: ${snapshot.backupType}`,
    `-- Total Records: ${snapshot.counts.total}`,
    `-- Logs: ${snapshot.counts.logs}, Starter Logs: ${snapshot.counts.starterLogs}`,
    ``,
    `BEGIN;`,
    ``,
  ];

  if (snapshot.tables.logs && snapshot.tables.logs.length > 0) {
    lines.push(`-- Insert logs (${snapshot.tables.logs.length} records)`);
    for (const log of snapshot.tables.logs) {
      const date = log.logDate || log.log_date;
      const desc = (log.logDescription || log.log_description || '').replace(/'/g, "''");
      const amount = log.logAmount || log.log_amount || 'NULL';
      const catId = log.logCategory || log.log_category || 'NULL';
      const rec = log.reconciled ? 'TRUE' : 'FALSE';

      lines.push(
        `INSERT INTO logs (log_date, log_description, log_amount, log_category, reconciled) VALUES ('${date}', '${desc}', ${amount === 'NULL' ? 'NULL' : `'${amount}'`}, ${catId}, ${rec});`
      );
    }
    lines.push(``);
  }

  if (snapshot.tables.starterLogs && snapshot.tables.starterLogs.length > 0) {
    lines.push(`-- Insert starter_logs (${snapshot.tables.starterLogs.length} records)`);
    for (const s of snapshot.tables.starterLogs) {
      const date = s.logDate || s.log_date || 'CURRENT_DATE';
      const desc = (s.logDescription || s.log_description || '').replace(/'/g, "''");
      const amount = s.logAmount || s.log_amount || 'NULL';
      const catId = s.logCategory || s.log_category || 'NULL';
      const rec = s.reconciled ? 'TRUE' : 'FALSE';

      lines.push(
        `INSERT INTO starter_logs (log_date, log_description, log_amount, log_category, reconciled) VALUES ('${date}', '${desc}', ${amount === 'NULL' ? 'NULL' : `'${amount}'`}, ${catId}, ${rec});`
      );
    }
    lines.push(``);
  }

  lines.push(`COMMIT;`);
  return lines.join('\n');
}
