import { db } from './index.ts';
import { logType, type LogType, type NewLogType } from './schema.ts';
import { asc, eq, or, isNull } from 'drizzle-orm';

export async function getLogTypes(userId?: number): Promise<LogType[]> {
  try {
    if (userId !== undefined) {
      return await db
        .select()
        .from(logType)
        .where(or(isNull(logType.userId), eq(logType.userId, userId)))
        .orderBy(asc(logType.id));
    }
    return await db.select().from(logType).orderBy(asc(logType.id));
  } catch (error) {
    console.error("Database query failed in getLogTypes:", error);
    throw new Error("Failed to fetch log types from database.", { cause: error });
  }
}

export async function getLogTypeById(id: number): Promise<LogType | undefined> {
  try {
    const results = await db.select().from(logType).where(eq(logType.id, id));
    return results[0];
  } catch (error) {
    console.error(`Database query failed in getLogTypeById (${id}):`, error);
    throw new Error("Failed to fetch log type.", { cause: error });
  }
}

export async function createLogType(data: { name: string; userId?: number }): Promise<LogType> {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Name field cannot be empty.");
    }
    const result = await db.insert(logType).values({
      name: trimmedName,
      userId: data.userId || null,
    }).returning();
    return result[0];
  } catch (error: any) {
    console.error("Database insert failed in createLogType:", error);
    if (error.code === '23505') {
      throw new Error(`A log type with the name '${data.name}' already exists.`);
    }
    throw new Error(error.message || "Failed to create log type.", { cause: error });
  }
}

export async function updateLogType(id: number, data: { name: string }): Promise<LogType | undefined> {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Name field cannot be empty.");
    }
    const result = await db.update(logType)
      .set({ name: trimmedName })
      .where(eq(logType.id, id))
      .returning();
    return result[0];
  } catch (error: any) {
    console.error(`Database update failed in updateLogType (${id}):`, error);
    if (error.code === '23505') {
      throw new Error(`A log type with the name '${data.name}' already exists.`);
    }
    throw new Error(error.message || "Failed to update log type.", { cause: error });
  }
}

export async function deleteLogType(id: number): Promise<boolean> {
  try {
    const result = await db.delete(logType).where(eq(logType.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error(`Database delete failed in deleteLogType (${id}):`, error);
    throw new Error("Failed to delete log type.", { cause: error });
  }
}

export async function deleteAllLogTypes(userId?: number): Promise<number> {
  try {
    const condition = userId !== undefined ? eq(logType.userId, userId) : undefined;
    const result = condition ? await db.delete(logType).where(condition).returning() : await db.delete(logType).returning();
    return result.length;
  } catch (error) {
    console.error("Database delete failed in deleteAllLogTypes:", error);
    throw new Error("Failed to delete all log types.", { cause: error });
  }
}

