import { db } from './index.ts';
import { tagLogAssn, tagType, logs, type TagLogAssn } from './schema.ts';
import { eq, and } from 'drizzle-orm';

export interface TagLogAssnWithDetails extends TagLogAssn {
  tagName?: string | null;
  logDescription?: string | null;
  logDate?: string | null;
}

export async function getTagLogAssns(userId?: number): Promise<TagLogAssnWithDetails[]> {
  try {
    let query = db
      .select({
        id: tagLogAssn.id,
        tagId: tagLogAssn.tagId,
        logId: tagLogAssn.logId,
        createdAt: tagLogAssn.createdAt,
        tagName: tagType.name,
        logDescription: logs.logDescription,
        logDate: logs.logDate,
      })
      .from(tagLogAssn)
      .leftJoin(tagType, eq(tagLogAssn.tagId, tagType.id))
      .leftJoin(logs, eq(tagLogAssn.logId, logs.id))
      .orderBy(tagLogAssn.id);

    const results = userId !== undefined
      ? await query.where(eq(logs.userId, userId))
      : await query;

    return results;
  } catch (error) {
    console.error('Database query failed in getTagLogAssns:', error);
    throw new Error('Failed to fetch tag-log associations from database.', { cause: error });
  }
}

export async function getTagsForLog(logId: number) {
  try {
    const results = await db
      .select({
        assnId: tagLogAssn.id,
        tagId: tagType.id,
        tagName: tagType.name,
      })
      .from(tagLogAssn)
      .innerJoin(tagType, eq(tagLogAssn.tagId, tagType.id))
      .where(eq(tagLogAssn.logId, logId));

    return results;
  } catch (error) {
    console.error(`Database query failed in getTagsForLog (${logId}):`, error);
    throw new Error('Failed to fetch tags for log.', { cause: error });
  }
}

export async function createTagLogAssn(tagId: number, logId: number): Promise<TagLogAssn> {
  try {
    const existing = await db
      .select()
      .from(tagLogAssn)
      .where(and(eq(tagLogAssn.tagId, tagId), eq(tagLogAssn.logId, logId)));

    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db
      .insert(tagLogAssn)
      .values({
        tagId,
        logId,
      })
      .returning();

    return result[0];
  } catch (error: any) {
    console.error('Database insert failed in createTagLogAssn:', error);
    throw new Error(error.message || 'Failed to create tag-log association.', { cause: error });
  }
}

export async function deleteTagLogAssn(id: number): Promise<boolean> {
  try {
    const result = await db.delete(tagLogAssn).where(eq(tagLogAssn.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error(`Database delete failed in deleteTagLogAssn (${id}):`, error);
    throw new Error('Failed to delete tag-log association.', { cause: error });
  }
}

export async function deleteAllTagLogAssns(userId?: number): Promise<void> {
  try {
    if (userId !== undefined) {
      // Find log IDs belonging to user
      const userLogs = await db.select({ id: logs.id }).from(logs).where(eq(logs.userId, userId));
      const logIds = userLogs.map(l => l.id);
      for (const logId of logIds) {
        await db.delete(tagLogAssn).where(eq(tagLogAssn.logId, logId));
      }
    } else {
      await db.delete(tagLogAssn);
    }
  } catch (error) {
    console.error('Database delete failed in deleteAllTagLogAssns:', error);
    throw new Error('Failed to clear tag-log associations.', { cause: error });
  }
}

