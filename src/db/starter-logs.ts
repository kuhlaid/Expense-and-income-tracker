import { db } from './index.ts';
import { starterLogs, logType, categoryType, logs, NewStarterLog, StarterLog } from './schema.ts';
import { and, eq, desc } from 'drizzle-orm';

export interface StarterLogWithRelations extends StarterLog {
  logTypeName?: string | null;
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
        logTypeId: starterLogs.logTypeId,
        logAmount: starterLogs.logAmount,
        logCategory: starterLogs.logCategory,
        reconciled: starterLogs.reconciled,
        createdAt: starterLogs.createdAt,
        logTypeName: logType.name,
        categoryName: categoryType.name,
      })
      .from(starterLogs)
      .leftJoin(logType, eq(starterLogs.logTypeId, logType.id))
      .leftJoin(categoryType, eq(starterLogs.logCategory, categoryType.id))
      .orderBy(desc(starterLogs.logDate), desc(starterLogs.id));

    const rawStarterLogs = userId !== undefined
      ? await query.where(eq(starterLogs.userId, userId))
      : await query;

    return rawStarterLogs;
  } catch (error) {
    console.error('Database query failed in getStarterLogs:', error);
    throw new Error('Failed to fetch starter logs from database.', { cause: error });
  }
}

export async function getStarterLogById(id: number, userId?: number): Promise<StarterLogWithRelations | undefined> {
  try {
    const condition = userId !== undefined ? and(eq(starterLogs.id, id), eq(starterLogs.userId, userId)) : eq(starterLogs.id, id);
    const results = await db
      .select({
        id: starterLogs.id,
        userId: starterLogs.userId,
        logDate: starterLogs.logDate,
        logDescription: starterLogs.logDescription,
        logTypeId: starterLogs.logTypeId,
        logAmount: starterLogs.logAmount,
        logCategory: starterLogs.logCategory,
        reconciled: starterLogs.reconciled,
        createdAt: starterLogs.createdAt,
        logTypeName: logType.name,
        categoryName: categoryType.name,
      })
      .from(starterLogs)
      .leftJoin(logType, eq(starterLogs.logTypeId, logType.id))
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
  logTypeId?: number;
  logAmount?: string;
  logCategory?: number;
  reconciled?: boolean;
}): Promise<StarterLogWithRelations> {
  try {
    const insertData: any = {
      userId: data.userId || null,
      logDescription: data.logDescription || null,
      logTypeId: data.logTypeId || null,
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
    logTypeId?: number;
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
    if (data.logTypeId !== undefined) updateValues.logTypeId = data.logTypeId;
    if (data.logAmount !== undefined) updateValues.logAmount = data.logAmount ? String(data.logAmount) : null;
    if (data.logCategory !== undefined) updateValues.logCategory = data.logCategory;
    if (data.reconciled !== undefined) updateValues.reconciled = data.reconciled;

    const condition = userId !== undefined ? and(eq(starterLogs.id, id), eq(starterLogs.userId, userId)) : eq(starterLogs.id, id);

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
    const condition = userId !== undefined ? and(eq(starterLogs.id, id), eq(starterLogs.userId, userId)) : eq(starterLogs.id, id);
    const result = await db.delete(starterLogs).where(condition).returning();
    return result.length > 0;
  } catch (error) {
    console.error(`Database delete failed in deleteStarterLog (${id}):`, error);
    throw new Error('Failed to delete starter log entry.', { cause: error });
  }
}

export async function deleteAllStarterLogs(userId?: number): Promise<number> {
  try {
    const condition = userId !== undefined ? eq(starterLogs.userId, userId) : undefined;
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
        logTypeId: item.logTypeId,
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


