import { db } from './index.ts';
import { logs, logType, categoryType, tagLogAssn, tagType, starterLogs, type Log, type NewLog } from './schema.ts';
import { and, desc, eq, inArray } from 'drizzle-orm';

export interface LogTagRef {
  assnId: number;
  tagId: number;
  tagName: string;
}

export interface LogWithRelations extends Log {
  logTypeName?: string | null;
  categoryName?: string | null;
  tags?: LogTagRef[];
}

export async function getLogs(userId?: number): Promise<LogWithRelations[]> {
  try {
    let query = db
      .select({
        id: logs.id,
        userId: logs.userId,
        logDate: logs.logDate,
        logDescription: logs.logDescription,
        logTypeId: logs.logTypeId,
        logAmount: logs.logAmount,
        logCategory: logs.logCategory,
        reconciled: logs.reconciled,
        createdAt: logs.createdAt,
        logTypeName: logType.name,
        categoryName: categoryType.name,
      })
      .from(logs)
      .leftJoin(logType, eq(logs.logTypeId, logType.id))
      .leftJoin(categoryType, eq(logs.logCategory, categoryType.id))
      .orderBy(desc(logs.logDate), desc(logs.id));

    const rawLogs = userId !== undefined
      ? await query.where(eq(logs.userId, userId))
      : await query;

    if (rawLogs.length === 0) return [];

    const logIds = rawLogs.map(l => l.id);

    // Fetch all tag associations for these logs
    const allAssns = await db
      .select({
        assnId: tagLogAssn.id,
        logId: tagLogAssn.logId,
        tagId: tagLogAssn.tagId,
        tagName: tagType.name,
      })
      .from(tagLogAssn)
      .innerJoin(tagType, eq(tagLogAssn.tagId, tagType.id))
      .where(inArray(tagLogAssn.logId, logIds));

    const assnMap: Record<number, LogTagRef[]> = {};
    for (const a of allAssns) {
      if (!assnMap[a.logId]) {
        assnMap[a.logId] = [];
      }
      assnMap[a.logId].push({
        assnId: a.assnId,
        tagId: a.tagId,
        tagName: a.tagName,
      });
    }

    return rawLogs.map((log) => ({
      ...log,
      tags: assnMap[log.id] || [],
    }));
  } catch (error) {
    console.error("Database query failed in getLogs:", error);
    throw new Error("Failed to fetch logs from database.", { cause: error });
  }
}

export async function getLogById(id: number, userId?: number): Promise<LogWithRelations | undefined> {
  try {
    const condition = userId !== undefined ? and(eq(logs.id, id), eq(logs.userId, userId)) : eq(logs.id, id);
    const results = await db.select().from(logs).where(condition);
    if (!results[0]) return undefined;

    const attachedTags = await db
      .select({
        assnId: tagLogAssn.id,
        tagId: tagLogAssn.tagId,
        tagName: tagType.name,
      })
      .from(tagLogAssn)
      .innerJoin(tagType, eq(tagLogAssn.tagId, tagType.id))
      .where(eq(tagLogAssn.logId, id));

    return {
      ...results[0],
      tags: attachedTags,
    };
  } catch (error) {
    console.error(`Database query failed in getLogById (${id}):`, error);
    throw new Error("Failed to fetch log.", { cause: error });
  }
}

export async function createLog(data: {
  userId?: number;
  logDate: string;
  logDescription?: string;
  logTypeId?: number;
  logAmount?: string;
  logCategory?: number;
  reconciled?: boolean;
  tagIds?: number[];
}): Promise<LogWithRelations> {
  try {
    const result = await db
      .insert(logs)
      .values({
        userId: data.userId || null,
        logDate: data.logDate,
        logDescription: data.logDescription || null,
        logTypeId: data.logTypeId || null,
        logAmount: data.logAmount ? String(data.logAmount) : null,
        logCategory: data.logCategory || null,
        reconciled: data.reconciled !== undefined ? data.reconciled : true,
      })
      .returning();

    const createdLog = result[0];
    const attachedTags: LogTagRef[] = [];

    if (data.tagIds && Array.isArray(data.tagIds) && data.tagIds.length > 0) {
      for (const tagId of data.tagIds) {
        const assn = await db
          .insert(tagLogAssn)
          .values({
            tagId: Number(tagId),
            logId: createdLog.id,
          })
          .returning();

        const tagInfo = await db.select().from(tagType).where(eq(tagType.id, Number(tagId)));
        if (assn[0] && tagInfo[0]) {
          attachedTags.push({
            assnId: assn[0].id,
            tagId: tagInfo[0].id,
            tagName: tagInfo[0].name,
          });
        }
      }
    }

    return {
      ...createdLog,
      tags: attachedTags,
    };
  } catch (error: any) {
    console.error("Database insert failed in createLog:", error);
    throw new Error(error.message || "Failed to create log entry.", { cause: error });
  }
}

export async function updateLog(
  id: number,
  data: {
    logDate?: string;
    logDescription?: string;
    logTypeId?: number;
    logAmount?: string;
    logCategory?: number;
    reconciled?: boolean;
    tagIds?: number[];
  },
  userId?: number
): Promise<LogWithRelations | undefined> {
  try {
    const updateValues: Partial<NewLog> = {};
    if (data.logDate !== undefined) updateValues.logDate = data.logDate;
    if (data.logDescription !== undefined) updateValues.logDescription = data.logDescription;
    if (data.logTypeId !== undefined) updateValues.logTypeId = data.logTypeId;
    if (data.logAmount !== undefined) updateValues.logAmount = data.logAmount ? String(data.logAmount) : null;
    if (data.logCategory !== undefined) updateValues.logCategory = data.logCategory;
    if (data.reconciled !== undefined) updateValues.reconciled = data.reconciled;

    const condition = userId !== undefined ? and(eq(logs.id, id), eq(logs.userId, userId)) : eq(logs.id, id);

    let updatedLog: Log | undefined;
    if (Object.keys(updateValues).length > 0) {
      const result = await db.update(logs).set(updateValues).where(condition).returning();
      updatedLog = result[0];
    } else {
      const existing = await db.select().from(logs).where(condition);
      updatedLog = existing[0];
    }

    if (!updatedLog) return undefined;

    // Synchronize tag associations if tagIds is specified
    if (data.tagIds !== undefined && Array.isArray(data.tagIds)) {
      const currentAssns = await db.select().from(tagLogAssn).where(eq(tagLogAssn.logId, id));
      const currentTagIds = currentAssns.map((a) => a.tagId);
      const targetTagIds = data.tagIds.map(Number);

      // Remove tags not in targetTagIds
      const toRemove = currentAssns.filter((a) => !targetTagIds.includes(a.tagId));
      for (const r of toRemove) {
        await db.delete(tagLogAssn).where(eq(tagLogAssn.id, r.id));
      }

      // Add tags in targetTagIds not currently associated
      const toAdd = targetTagIds.filter((tid) => !currentTagIds.includes(tid));
      for (const tid of toAdd) {
        await db.insert(tagLogAssn).values({ logId: id, tagId: tid });
      }
    }

    // Return the updated log with relations
    return await getLogById(id, userId);
  } catch (error: any) {
    console.error(`Database update failed in updateLog (${id}):`, error);
    throw new Error(error.message || "Failed to update log entry.", { cause: error });
  }
}

export async function deleteLog(id: number, userId?: number): Promise<boolean> {
  try {
    const condition = userId !== undefined ? and(eq(logs.id, id), eq(logs.userId, userId)) : eq(logs.id, id);
    const result = await db.delete(logs).where(condition).returning();
    return result.length > 0;
  } catch (error) {
    console.error(`Database delete failed in deleteLog (${id}):`, error);
    throw new Error("Failed to delete log entry.", { cause: error });
  }
}

export async function deleteAllLogs(userId?: number): Promise<number> {
  try {
    const condition = userId !== undefined ? eq(logs.userId, userId) : undefined;
    const result = condition ? await db.delete(logs).where(condition).returning() : await db.delete(logs).returning();
    return result.length;
  } catch (error) {
    console.error("Database delete failed in deleteAllLogs:", error);
    throw new Error("Failed to delete all logs.", { cause: error });
  }
}

export async function copyLogsToStarterLogs(logIds: number[], userId: number): Promise<any[]> {
  try {
    if (!logIds || logIds.length === 0) return [];
    
    // Select the requested logs that belong to this user
    const selectedLogs = await db
      .select()
      .from(logs)
      .where(and(inArray(logs.id, logIds), eq(logs.userId, userId)));

    if (selectedLogs.length === 0) return [];

    const createdStarterLogs = [];
    for (const logItem of selectedLogs) {
      const [newStarter] = await db
        .insert(starterLogs)
        .values({
          userId: userId,
          logDescription: logItem.logDescription,
          logTypeId: logItem.logTypeId,
          logAmount: logItem.logAmount,
          logCategory: logItem.logCategory,
          reconciled: false, // Default for starter logs
        })
        .returning();
      createdStarterLogs.push(newStarter);
    }

    return createdStarterLogs;
  } catch (error: any) {
    console.error("Failed in copyLogsToStarterLogs:", error);
    throw new Error(error.message || "Failed to copy logs to starter logs.", { cause: error });
  }
}

