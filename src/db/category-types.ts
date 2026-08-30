import { db } from './index.ts';
import { categoryType, type CategoryType, type NewCategoryType } from './schema.ts';
import { asc, eq, or, isNull } from 'drizzle-orm';

export async function getCategoryTypes(userId?: number): Promise<CategoryType[]> {
  try {
    if (userId !== undefined) {
      return await db
        .select()
        .from(categoryType)
        .where(or(isNull(categoryType.userId), eq(categoryType.userId, userId)))
        .orderBy(asc(categoryType.id));
    }
    return await db.select().from(categoryType).orderBy(asc(categoryType.id));
  } catch (error) {
    console.error("Database query failed in getCategoryTypes:", error);
    throw new Error("Failed to fetch category types from database.", { cause: error });
  }
}

export async function getCategoryTypeById(id: number): Promise<CategoryType | undefined> {
  try {
    const results = await db.select().from(categoryType).where(eq(categoryType.id, id));
    return results[0];
  } catch (error) {
    console.error(`Database query failed in getCategoryTypeById (${id}):`, error);
    throw new Error("Failed to fetch category type.", { cause: error });
  }
}

export async function createCategoryType(data: { name: string; userId?: number }): Promise<CategoryType> {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Name field cannot be empty.");
    }
    const result = await db.insert(categoryType).values({
      name: trimmedName,
      userId: data.userId || null,
    }).returning();
    return result[0];
  } catch (error: any) {
    console.error("Database insert failed in createCategoryType:", error);
    if (error.code === '23505') {
      throw new Error(`A category type with the name '${data.name}' already exists.`);
    }
    throw new Error(error.message || "Failed to create category type.", { cause: error });
  }
}

export async function updateCategoryType(id: number, data: { name: string }): Promise<CategoryType | undefined> {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new Error("Name field cannot be empty.");
    }
    const result = await db.update(categoryType)
      .set({ name: trimmedName })
      .where(eq(categoryType.id, id))
      .returning();
    return result[0];
  } catch (error: any) {
    console.error(`Database update failed in updateCategoryType (${id}):`, error);
    if (error.code === '23505') {
      throw new Error(`A category type with the name '${data.name}' already exists.`);
    }
    throw new Error(error.message || "Failed to update category type.", { cause: error });
  }
}

export async function deleteCategoryType(id: number): Promise<boolean> {
  try {
    const result = await db.delete(categoryType).where(eq(categoryType.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error(`Database delete failed in deleteCategoryType (${id}):`, error);
    throw new Error("Failed to delete category type.", { cause: error });
  }
}

export async function deleteAllCategoryTypes(userId?: number): Promise<number> {
  try {
    const condition = userId !== undefined ? eq(categoryType.userId, userId) : undefined;
    const result = condition ? await db.delete(categoryType).where(condition).returning() : await db.delete(categoryType).returning();
    return result.length;
  } catch (error) {
    console.error("Database delete failed in deleteAllCategoryTypes:", error);
    throw new Error("Failed to delete all category types.", { cause: error });
  }
}

