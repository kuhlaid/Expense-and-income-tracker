import { db } from './index.ts';
import { tagType, type TagType, type NewTagType } from './schema.ts';
import { asc, eq, or, isNull } from 'drizzle-orm';

export async function getTagTypes(userId?: number): Promise<TagType[]> {
  try {
    if (userId !== undefined) {
      return await db
        .select()
        .from(tagType)
        .where(or(isNull(tagType.userId), eq(tagType.userId, userId)))
        .orderBy(asc(tagType.id));
    }
    return await db.select().from(tagType).orderBy(asc(tagType.id));
  } catch (error) {
    console.error("Database query failed in getTagTypes:", error);
    throw new Error("Failed to fetch tag types from database.", { cause: error });
  }
}

export async function getTagTypeById(id: number): Promise<TagType | undefined> {
  try {
    const results = await db.select().from(tagType).where(eq(tagType.id, id));
    return results[0];
  } catch (error) {
    console.error(`Database query failed in getTagTypeById (${id}):`, error);
    throw new Error("Failed to fetch tag type.", { cause: error });
  }
}

export async function createTagType(data: { name: string; userId?: number }): Promise<TagType> {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Name field cannot be empty.");
    }
    const result = await db.insert(tagType).values({
      name: trimmedName,
      userId: data.userId || null,
    }).returning();
    return result[0];
  } catch (error: any) {
    console.error("Database insert failed in createTagType:", error);
    if (error.code === '23505') {
      throw new Error(`A tag type with the name '${data.name}' already exists.`);
    }
    throw new Error(error.message || "Failed to create tag type.", { cause: error });
  }
}

export async function updateTagType(id: number, data: { name: string }): Promise<TagType | undefined> {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Name field cannot be empty.");
    }
    const result = await db.update(tagType)
      .set({ name: trimmedName })
      .where(eq(tagType.id, id))
      .returning();
    return result[0];
  } catch (error: any) {
    console.error(`Database update failed in updateTagType (${id}):`, error);
    if (error.code === '23505') {
      throw new Error(`A tag type with the name '${data.name}' already exists.`);
    }
    throw new Error(error.message || "Failed to update tag type.", { cause: error });
  }
}

export async function deleteTagType(id: number): Promise<boolean> {
  try {
    const result = await db.delete(tagType).where(eq(tagType.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error(`Database delete failed in deleteTagType (${id}):`, error);
    throw new Error("Failed to delete tag type.", { cause: error });
  }
}

export async function deleteAllTagTypes(userId?: number): Promise<number> {
  try {
    const condition = userId !== undefined ? eq(tagType.userId, userId) : undefined;
    const result = condition ? await db.delete(tagType).where(condition).returning() : await db.delete(tagType).returning();
    return result.length;
  } catch (error) {
    console.error("Database delete failed in deleteAllTagTypes:", error);
    throw new Error("Failed to delete all tag types.", { cause: error });
  }
}

