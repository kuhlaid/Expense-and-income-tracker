import { db } from './index.ts';
import { starterLogs, categoryType, logs, NewStarterLog, StarterLog } from './schema.ts';
import { and, eq, desc, or, isNull } from 'drizzle-orm';

export interface StarterLogWithRelations extends StarterLog {
  categoryName?: string | null;
}

export async function getStarterLogs(userId?: number): Promise<StarterLogWithRelations[]> {
  try {
    let query = db
      .select({
        id: starterLogs.id,
        userId: starterLogs.userId,
        logDate: starterLogs.logDate,
        logDescription: starterLogs.logDescription,
        logAmount: starterLogs.logAmount,
        logCategory: starterLogs.logCategory,
        reconciled: starterLogs.reconciled,
        createdAt: starterLogs.createdAt,
        categoryName: categoryType.name,
      })
      .from(starterLogs)
      .leftJoin(categoryType, eq(starterLogs.logCategory, categoryType.id))
      .orderBy(desc(starterLogs.logDate), desc(starterLogs.id));

    const rawStarterLogs = userId !== undefined
      ? await query.where(or(isNull(starterLogs.userId), eq(starterLogs.userId, userId)))
      : await query;

    return rawStarterLogs;
  } catch (error) {
    console.error('Database query failed in getStarterLogs:', error);
    throw new Error('Failed to fetch starter logs from database.', { cause: error });
  }
}

export async function getStarterLogById(id: number, userId?: number): Promise<StarterLogWithRelations | undefined> {
  try {
    const condition = userId !== undefined
      ? and(eq(starterLogs.id, id), or(isNull(starterLogs.userId), eq(starterLogs.userId, userId)))
      : eq(starterLogs.id, id);
    const results = await db
      .select({
        id: starterLogs.id,
        userId: starterLogs.userId,
        logDate: starterLogs.logDate,
        logDescription: starterLogs.logDescription,
        logAmount: starterLogs.logAmount,
        logCategory: starterLogs.logCategory,
        reconciled: starterLogs.reconciled,
        createdAt: starterLogs.createdAt,
        categoryName: categoryType.name,
      })
      .from(starterLogs)
      .leftJoin(categoryType, eq(starterLogs.logCategory, categoryType.id))
      .where(condition);

    return results[0];
  } catch (error) {
    console.error(`Database query failed in getStarterLogById (${id}):`, error);
    throw new Error('Failed to fetch starter log.', { cause: error });
  }
}

export async function createStarterLog(data: {
  userId?: number;
  logDate?: string;
  logDescription?: string;
  logAmount?: string;
  logCategory?: number;
  reconciled?: boolean;
}): Promise<StarterLogWithRelations> {
  try {
    const insertData: any = {
      userId: data.userId || null,
      logDescription: data.logDescription || null,
      logAmount: data.logAmount ? String(data.logAmount) : null,
      logCategory: data.logCategory || null,
      reconciled: data.reconciled !== undefined ? data.reconciled : false,
    };

    if (data.logDate && data.logDate.trim() !== '') {
      insertData.logDate = data.logDate;
    }

    const [created] = await db.insert(starterLogs).values(insertData).returning();
    const withRelations = await getStarterLogById(created.id, data.userId);
    return withRelations || created;
  } catch (error: any) {
    console.error('Database insert failed in createStarterLog:', error);
    throw new Error(error.message || 'Failed to create starter log entry.', { cause: error });
  }
}

export async function updateStarterLog(
  id: number,
  data: {
    logDate?: string;
    logDescription?: string;
    logAmount?: string;
    logCategory?: number;
    reconciled?: boolean;
  },
  userId?: number
): Promise<StarterLogWithRelations | undefined> {
  try {
    const updateValues: Partial<NewStarterLog> = {};
    if (data.logDate !== undefined) updateValues.logDate = data.logDate;
    if (data.logDescription !== undefined) updateValues.logDescription = data.logDescription;
    if (data.logAmount !== undefined) updateValues.logAmount = data.logAmount ? String(data.logAmount) : null;
    if (data.logCategory !== undefined) updateValues.logCategory = data.logCategory;
    if (data.reconciled !== undefined) updateValues.reconciled = data.reconciled;
    if (userId !== undefined) updateValues.userId = userId;

    const condition = userId !== undefined
      ? and(eq(starterLogs.id, id), or(isNull(starterLogs.userId), eq(starterLogs.userId, userId)))
      : eq(starterLogs.id, id);

    if (Object.keys(updateValues).length > 0) {
      await db.update(starterLogs).set(updateValues).where(condition);
    }

    return await getStarterLogById(id, userId);
  } catch (error: any) {
    console.error(`Database update failed in updateStarterLog (${id}):`, error);
    throw new Error(error.message || 'Failed to update starter log entry.', { cause: error });
  }
}

export async function deleteStarterLog(id: number, userId?: number): Promise<boolean> {
  try {
    const condition = userId !== undefined
      ? and(eq(starterLogs.id, id), or(isNull(starterLogs.userId), eq(starterLogs.userId, userId)))
      : eq(starterLogs.id, id);
    const result = await db.delete(starterLogs).where(condition).returning();
    return result.length > 0;
  } catch (error) {
    console.error(`Database delete failed in deleteStarterLog (${id}):`, error);
    throw new Error('Failed to delete starter log entry.', { cause: error });
  }
}

export async function deleteAllStarterLogs(userId?: number): Promise<number> {
  try {
    const condition = userId !== undefined
      ? or(isNull(starterLogs.userId), eq(starterLogs.userId, userId))
      : undefined;
    const result = condition ? await db.delete(starterLogs).where(condition).returning() : await db.delete(starterLogs).returning();
    return result.length;
  } catch (error) {
    console.error('Database delete failed in deleteAllStarterLogs:', error);
    throw new Error('Failed to delete all starter logs.', { cause: error });
  }
}

export async function copyStarterLogToLogs(id: number, userId?: number, customDate?: string): Promise<any> {
  try {
    const item = await getStarterLogById(id, userId);
    if (!item) throw new Error(`Starter log with id ${id} not found.`);

    const todayStr = customDate || new Date().toISOString().split('T')[0];
    const [newLog] = await db
      .insert(logs)
      .values({
        userId: userId || null,
        logDate: todayStr,
        logDescription: item.logDescription,
        logAmount: item.logAmount,
        logCategory: item.logCategory,
        reconciled: item.reconciled ?? false,
      })
      .returning();

    return newLog;
  } catch (error: any) {
    console.error(`Database copy failed in copyStarterLogToLogs (${id}):`, error);
    throw new Error(error.message || 'Failed to copy starter log to logs table.', { cause: error });
  }
}

export async function bulkCreateStarterLogs(
  items: Array<{
    logDescription?: string | null;
    logAmount?: string | null;
    logCategory?: number | null;
    reconciled?: boolean | null;
  }>,
  userId?: number,
  replaceAll: boolean = false
): Promise<{ count: number; items: StarterLogWithRelations[] }> {
  try {
    if (replaceAll) {
      await deleteAllStarterLogs(userId);
    }

    if (!items || items.length === 0) {
      return { count: 0, items: [] };
    }

    const createdList: StarterLogWithRelations[] = [];
    const batchSize = 50;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const insertValues = batch.map((item) => ({
        userId: userId || null,
        logDescription: item.logDescription || null,
        logAmount: item.logAmount ? String(item.logAmount) : null,
        logCategory: item.logCategory || null,
        reconciled: item.reconciled !== undefined && item.reconciled !== null ? Boolean(item.reconciled) : false,
      }));

      const inserted = await db.insert(starterLogs).values(insertValues).returning();
      createdList.push(...inserted);
    }

    return { count: createdList.length, items: createdList };
  } catch (error: any) {
    console.error('Failed in bulkCreateStarterLogs:', error);
    throw new Error(error.message || 'Failed to bulk import starter logs.', { cause: error });
  }
}



