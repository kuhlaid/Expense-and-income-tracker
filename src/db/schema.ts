import { sql } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, date, integer, numeric, boolean } from 'drizzle-orm/pg-core';

// Users table linked to Firebase Authentication
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Lookup table 'log_type' with unique auto-increment id and unique name
export const logType = pgTable('log_type', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Lookup table 'tag_type' with unique auto-increment id and unique name
export const tagType = pgTable('tag_type', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Lookup table 'category_type' with unique auto-increment id and unique name
export const categoryType = pgTable('category_type', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Primary 'logs' table
export const logs = pgTable('logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  logDescription: text('log_description'),
  logTypeId: integer('log_type_id').references(() => logType.id),
  logAmount: numeric('log_amount', { precision: 12, scale: 2 }),
  logCategory: integer('log_category').references(() => categoryType.id),
  reconciled: boolean('reconciled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Association table 'tag_log_assn' linking tag_type and logs
export const tagLogAssn = pgTable('tag_log_assn', {
  id: serial('id').primaryKey(),
  tagId: integer('tag_id').references(() => tagType.id, { onDelete: 'cascade' }).notNull(),
  logId: integer('log_id').references(() => logs.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Table 'starter_logs' copying 'logs' schema with reconciled default false and log_date default CURRENT_DATE
export const starterLogs = pgTable('starter_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  logDate: date('log_date').default(sql`CURRENT_DATE`).notNull(),
  logDescription: text('log_description'),
  logTypeId: integer('log_type_id').references(() => logType.id),
  logAmount: numeric('log_amount', { precision: 12, scale: 2 }),
  logCategory: integer('log_category').references(() => categoryType.id),
  reconciled: boolean('reconciled').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export type LogType = typeof logType.$inferSelect;
export type NewLogType = typeof logType.$inferInsert;
export type TagType = typeof tagType.$inferSelect;
export type NewTagType = typeof tagType.$inferInsert;
export type CategoryType = typeof categoryType.$inferSelect;
export type NewCategoryType = typeof categoryType.$inferInsert;
export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export type StarterLog = typeof starterLogs.$inferSelect;
export type NewStarterLog = typeof starterLogs.$inferInsert;
export type TagLogAssn = typeof tagLogAssn.$inferSelect;
export type NewTagLogAssn = typeof tagLogAssn.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
