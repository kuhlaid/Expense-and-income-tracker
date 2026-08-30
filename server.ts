import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getLogTypes, createLogType, updateLogType, deleteLogType, deleteAllLogTypes } from './src/db/log-types.ts';
import { getTagTypes, createTagType, updateTagType, deleteTagType, deleteAllTagTypes } from './src/db/tag-types.ts';
import { getCategoryTypes, createCategoryType, updateCategoryType, deleteCategoryType, deleteAllCategoryTypes } from './src/db/category-types.ts';
import { getLogs, createLog, updateLog, deleteLog, deleteAllLogs, copyLogsToStarterLogs } from './src/db/logs.ts';
import {
  getStarterLogs,
  getStarterLogById,
  createStarterLog,
  updateStarterLog,
  deleteStarterLog,
  deleteAllStarterLogs,
  copyStarterLogToLogs,
} from './src/db/starter-logs.ts';
import { getTagLogAssns, getTagsForLog, createTagLogAssn, deleteTagLogAssn, deleteAllTagLogAssns } from './src/db/tag-log-assn.ts';
import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check (public)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Current user info
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user, dbUser: req.dbUser });
  });

  // Get schema metadata for a table (requires auth)
  app.get('/api/table-schema', requireAuth, async (req: AuthRequest, res) => {
    try {
      const requestedTable = (req.query.table as string) || 'logs';
      const validTables = ['logs', 'starter_logs', 'tag_log_assn', 'category_type', 'tag_type', 'log_type', 'users'];
      const targetTable = validTables.includes(requestedTable) ? requestedTable : 'logs';

      const result = await db.execute(
        sql`SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = ${targetTable} 
            ORDER BY ordinal_position;`
      );
      res.json({ tableName: targetTable, columns: result.rows });
    } catch (error: any) {
      console.error('Failed to get schema info:', error);
      res.status(500).json({ error: error.message || 'Failed to inspect schema' });
    }
  });

  // --- TAG_LOG_ASSN ENDPOINTS ---
  // List all tag-log associations
  app.get('/api/tag-log-assns', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const assns = await getTagLogAssns(userId);
      res.json(assns);
    } catch (error: any) {
      console.error('Failed to fetch tag-log associations:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch associations' });
    }
  });

  // List tags for a specific log
  app.get('/api/logs/:logId/tags', requireAuth, async (req: AuthRequest, res) => {
    try {
      const logId = parseInt(req.params.logId, 10);
      if (isNaN(logId)) return res.status(400).json({ error: 'Invalid log ID.' });
      const tags = await getTagsForLog(logId);
      res.json(tags);
    } catch (error: any) {
      console.error('Failed to fetch tags for log:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch tags for log' });
    }
  });

  // Create tag-log association
  app.post('/api/tag-log-assns', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { tagId, logId } = req.body;
      if (!tagId || !logId) {
        return res.status(400).json({ error: 'Both tagId and logId are required.' });
      }
      const created = await createTagLogAssn(Number(tagId), Number(logId));
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create tag-log association:', error);
      res.status(500).json({ error: error.message || 'Failed to create association' });
    }
  });

  // Delete tag-log association
  app.delete('/api/tag-log-assns/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });
      const deleted = await deleteTagLogAssn(id);
      if (!deleted) return res.status(404).json({ error: 'Association not found.' });
      res.json({ success: true, message: `Association #${id} deleted.` });
    } catch (error: any) {
      console.error('Failed to delete tag-log association:', error);
      res.status(500).json({ error: error.message || 'Failed to delete association' });
    }
  });

  // Delete all tag-log associations
  app.delete('/api/tag-log-assns', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      await deleteAllTagLogAssns(userId);
      res.json({ success: true, message: 'All associations cleared.' });
    } catch (error: any) {
      console.error('Failed to clear tag-log associations:', error);
      res.status(500).json({ error: error.message || 'Failed to clear associations' });
    }
  });

  // --- LOGS ENDPOINTS ---
  // List all logs for authenticated user
  app.get('/api/logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const logList = await getLogs(userId);
      res.json(logList);
    } catch (error: any) {
      console.error('Failed to fetch logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch logs' });
    }
  });

  // Bulk copy selected logs to starter_logs
  app.post('/api/logs/copy-to-starter-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of log IDs to copy.' });
      }
      const numericIds = ids.map(Number).filter(id => !isNaN(id));
      const created = await copyLogsToStarterLogs(numericIds, userId);
      res.status(201).json({
        success: true,
        count: created.length,
        message: `Successfully copied ${created.length} log(s) to starter logs.`,
        records: created,
      });
    } catch (error: any) {
      console.error('Failed to copy logs to starter logs:', error);
      res.status(500).json({ error: error.message || 'Failed to copy logs to starter logs' });
    }
  });

  // Create a log entry
  app.post('/api/logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const { logDate, logDescription, logTypeId, logAmount, logCategory, reconciled, tagIds } = req.body;
      if (!logDate) {
        return res.status(400).json({ error: 'logDate is required (YYYY-MM-DD).' });
      }
      const created = await createLog({
        userId,
        logDate,
        logDescription,
        logTypeId: logTypeId ? Number(logTypeId) : undefined,
        logAmount: logAmount !== undefined && logAmount !== '' ? String(logAmount) : undefined,
        logCategory: logCategory ? Number(logCategory) : undefined,
        reconciled: reconciled !== undefined ? Boolean(reconciled) : true,
        tagIds: Array.isArray(tagIds) ? tagIds.map(Number) : undefined,
      });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create log:', error);
      res.status(500).json({ error: error.message || 'Failed to create log' });
    }
  });

  // Attach a tag to a log entry
  app.post('/api/logs/:logId/tags', requireAuth, async (req: AuthRequest, res) => {
    try {
      const logId = parseInt(req.params.logId, 10);
      const { tagId } = req.body;
      if (isNaN(logId) || !tagId) {
        return res.status(400).json({ error: 'Valid log ID and tagId are required.' });
      }
      const assn = await createTagLogAssn(Number(tagId), logId);
      res.status(201).json(assn);
    } catch (error: any) {
      console.error('Failed to attach tag to log:', error);
      res.status(500).json({ error: error.message || 'Failed to attach tag' });
    }
  });

  // Update a log entry
  app.put('/api/logs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const userId = req.dbUser?.id;
      const { logDate, logDescription, logTypeId, logAmount, logCategory, reconciled, tagIds } = req.body;
      const updated = await updateLog(
        id,
        {
          logDate,
          logDescription,
          logTypeId: logTypeId !== undefined ? (logTypeId ? Number(logTypeId) : undefined) : undefined,
          logAmount: logAmount !== undefined ? (logAmount !== '' ? String(logAmount) : undefined) : undefined,
          logCategory: logCategory !== undefined ? (logCategory ? Number(logCategory) : undefined) : undefined,
          reconciled: reconciled !== undefined ? Boolean(reconciled) : undefined,
          tagIds: Array.isArray(tagIds) ? tagIds.map(Number) : undefined,
        },
        userId
      );
      if (!updated) {
        return res.status(404).json({ error: 'Log entry not found.' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update log:', error);
      res.status(500).json({ error: error.message || 'Failed to update log' });
    }
  });

  // Delete all logs for authenticated user
  app.delete('/api/logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const count = await deleteAllLogs(userId);
      res.json({ success: true, message: `Removed all (${count}) records from logs.` });
    } catch (error: any) {
      console.error('Failed to clear logs:', error);
      res.status(500).json({ error: error.message || 'Failed to clear logs' });
    }
  });

  // Delete a log entry
  app.delete('/api/logs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const userId = req.dbUser?.id;
      const deleted = await deleteLog(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Log entry not found.' });
      }
      res.json({ success: true, message: `Log entry with id ${id} deleted.` });
    } catch (error: any) {
      console.error('Failed to delete log:', error);
      res.status(500).json({ error: error.message || 'Failed to delete log' });
    }
  });

  // --- STARTER LOGS ENDPOINTS ---
  // List all starter logs for authenticated user
  app.get('/api/starter-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const list = await getStarterLogs(userId);
      res.json(list);
    } catch (error: any) {
      console.error('Failed to fetch starter logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch starter logs' });
    }
  });

  // Create a starter log entry
  app.post('/api/starter-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const { logDate, logDescription, logTypeId, logAmount, logCategory, reconciled } = req.body;
      const created = await createStarterLog({
        userId,
        logDate: logDate ? String(logDate).trim() : undefined,
        logDescription: logDescription ? String(logDescription).trim() : undefined,
        logTypeId: logTypeId ? Number(logTypeId) : undefined,
        logAmount: logAmount !== undefined && logAmount !== '' ? String(logAmount) : undefined,
        logCategory: logCategory ? Number(logCategory) : undefined,
        reconciled: reconciled !== undefined ? Boolean(reconciled) : false,
      });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create starter log:', error);
      res.status(500).json({ error: error.message || 'Failed to create starter log' });
    }
  });

  // Update a starter log entry
  app.put('/api/starter-logs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const userId = req.dbUser?.id;
      const { logDate, logDescription, logTypeId, logAmount, logCategory, reconciled } = req.body;
      const updated = await updateStarterLog(
        id,
        {
          logDate: logDate !== undefined ? (logDate ? String(logDate).trim() : undefined) : undefined,
          logDescription: logDescription !== undefined ? (logDescription ? String(logDescription).trim() : undefined) : undefined,
          logTypeId: logTypeId !== undefined ? (logTypeId ? Number(logTypeId) : undefined) : undefined,
          logAmount: logAmount !== undefined ? (logAmount !== '' ? String(logAmount) : undefined) : undefined,
          logCategory: logCategory !== undefined ? (logCategory ? Number(logCategory) : undefined) : undefined,
          reconciled: reconciled !== undefined ? Boolean(reconciled) : undefined,
        },
        userId
      );
      if (!updated) {
        return res.status(404).json({ error: 'Starter log entry not found.' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update starter log:', error);
      res.status(500).json({ error: error.message || 'Failed to update starter log' });
    }
  });

  // Copy/Apply a starter log into active logs
  app.post('/api/starter-logs/:id/copy-to-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const userId = req.dbUser?.id;
      const { logDate } = req.body || {};
      const newLog = await copyStarterLogToLogs(id, userId, logDate);
      res.status(201).json({ success: true, message: `Copied starter log #${id} into active logs!`, newLog });
    } catch (error: any) {
      console.error('Failed to copy starter log:', error);
      res.status(500).json({ error: error.message || 'Failed to copy starter log' });
    }
  });

  // Delete all starter logs
  app.delete('/api/starter-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const count = await deleteAllStarterLogs(userId);
      res.json({ success: true, message: `Removed all (${count}) records from starter_logs.` });
    } catch (error: any) {
      console.error('Failed to clear starter logs:', error);
      res.status(500).json({ error: error.message || 'Failed to clear starter logs' });
    }
  });

  // Delete a starter log entry
  app.delete('/api/starter-logs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const userId = req.dbUser?.id;
      const deleted = await deleteStarterLog(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Starter log entry not found.' });
      }
      res.json({ success: true, message: `Starter log entry with id ${id} deleted.` });
    } catch (error: any) {
      console.error('Failed to delete starter log:', error);
      res.status(500).json({ error: error.message || 'Failed to delete starter log' });
    }
  });

  // --- CATEGORY TYPES ENDPOINTS ---
  // List all category types
  app.get('/api/category-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const types = await getCategoryTypes(userId);
      res.json(types);
    } catch (error: any) {
      console.error('Failed to fetch category types:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch category types' });
    }
  });

  // Create a new category type
  app.post('/api/category-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required and cannot be blank.' });
      }
      const created = await createCategoryType({ name: name.trim(), userId });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create category type:', error);
      const isDuplicate = error.message?.includes('already exists');
      res.status(isDuplicate ? 409 : 500).json({ error: error.message || 'Failed to create category type' });
    }
  });

  // Update a category type
  app.put('/api/category-types/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required and cannot be blank.' });
      }
      const updated = await updateCategoryType(id, { name: name.trim() });
      if (!updated) {
        return res.status(404).json({ error: 'Category type not found.' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update category type:', error);
      const isDuplicate = error.message?.includes('already exists');
      res.status(isDuplicate ? 409 : 500).json({ error: error.message || 'Failed to update category type' });
    }
  });

  // Delete all category types
  app.delete('/api/category-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const count = await deleteAllCategoryTypes(userId);
      res.json({ success: true, message: `Removed all (${count}) records from category_type.` });
    } catch (error: any) {
      console.error('Failed to clear category types:', error);
      res.status(500).json({ error: error.message || 'Failed to clear category types' });
    }
  });

  // Delete a category type
  app.delete('/api/category-types/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const deleted = await deleteCategoryType(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Category type not found.' });
      }
      res.json({ success: true, message: `Category type with id ${id} deleted.` });
    } catch (error: any) {
      console.error('Failed to delete category type:', error);
      res.status(500).json({ error: error.message || 'Failed to delete category type' });
    }
  });

  // Seed sample category types
  app.post('/api/category-types/seed-defaults', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const sampleNames = ['Donation', 'Entertainment', 'Gift', 'Grocery', 'Healthcare', 'Home', 'Restaurant', 'Taxes', 'Travel', 'Utilities'];
      const current = await getCategoryTypes(userId);
      const existingNames = new Set(current.map(c => c.name.toUpperCase()));

      const createdList = [];
      for (const sName of sampleNames) {
        if (!existingNames.has(sName.toUpperCase())) {
          try {
            const created = await createCategoryType({ name: sName, userId });
            createdList.push(created);
          } catch {
            // Ignore if skipped
          }
        }
      }
      const all = await getCategoryTypes(userId);
      res.json({ message: `Seeded ${createdList.length} default category types.`, categoryTypes: all });
    } catch (error: any) {
      console.error('Failed to seed defaults:', error);
      res.status(500).json({ error: error.message || 'Failed to seed sample category types' });
    }
  });

  // --- TAG TYPES ENDPOINTS ---
  // List all tag types
  app.get('/api/tag-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const types = await getTagTypes(userId);
      res.json(types);
    } catch (error: any) {
      console.error('Failed to fetch tag types:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch tag types' });
    }
  });

  // Create a new tag type
  app.post('/api/tag-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required and cannot be blank.' });
      }
      const created = await createTagType({ name: name.trim(), userId });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create tag type:', error);
      const isDuplicate = error.message?.includes('already exists');
      res.status(isDuplicate ? 409 : 500).json({ error: error.message || 'Failed to create tag type' });
    }
  });

  // Update a tag type
  app.put('/api/tag-types/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required and cannot be blank.' });
      }
      const updated = await updateTagType(id, { name: name.trim() });
      if (!updated) {
        return res.status(404).json({ error: 'Tag type not found.' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update tag type:', error);
      const isDuplicate = error.message?.includes('already exists');
      res.status(isDuplicate ? 409 : 500).json({ error: error.message || 'Failed to update tag type' });
    }
  });

  // Delete all tag types
  app.delete('/api/tag-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const count = await deleteAllTagTypes(userId);
      res.json({ success: true, message: `Removed all (${count}) records from tag_type.` });
    } catch (error: any) {
      console.error('Failed to clear tag types:', error);
      res.status(500).json({ error: error.message || 'Failed to clear tag types' });
    }
  });

  // Delete a tag type
  app.delete('/api/tag-types/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const deleted = await deleteTagType(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Tag type not found.' });
      }
      res.json({ success: true, message: `Tag type with id ${id} deleted.` });
    } catch (error: any) {
      console.error('Failed to delete tag type:', error);
      res.status(500).json({ error: error.message || 'Failed to delete tag type' });
    }
  });

  // Seed sample tag types
  app.post('/api/tag-types/seed-defaults', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const sampleNames = ['discretionary', 'real estate'];
      const current = await getTagTypes(userId);
      const existingNames = new Set(current.map(c => c.name.toUpperCase()));

      const createdList = [];
      for (const sName of sampleNames) {
        if (!existingNames.has(sName.toUpperCase())) {
          try {
            const created = await createTagType({ name: sName, userId });
            createdList.push(created);
          } catch {
            // Ignore if skipped
          }
        }
      }
      const all = await getTagTypes(userId);
      res.json({ message: `Seeded ${createdList.length} default tag types.`, tagTypes: all });
    } catch (error: any) {
      console.error('Failed to seed defaults:', error);
      res.status(500).json({ error: error.message || 'Failed to seed sample tag types' });
    }
  });

  // --- LOG TYPES ENDPOINTS ---
  // List all log types
  app.get('/api/log-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const types = await getLogTypes(userId);
      res.json(types);
    } catch (error: any) {
      console.error('Failed to fetch log types:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch log types' });
    }
  });

  // Create a new log type
  app.post('/api/log-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required and cannot be blank.' });
      }
      const created = await createLogType({ name: name.trim(), userId });
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create log type:', error);
      const isDuplicate = error.message?.includes('already exists');
      res.status(isDuplicate ? 409 : 500).json({ error: error.message || 'Failed to create log type' });
    }
  });

  // Update a log type
  app.put('/api/log-types/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required and cannot be blank.' });
      }
      const updated = await updateLogType(id, { name: name.trim() });
      if (!updated) {
        return res.status(404).json({ error: 'Log type not found.' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update log type:', error);
      const isDuplicate = error.message?.includes('already exists');
      res.status(isDuplicate ? 409 : 500).json({ error: error.message || 'Failed to update log type' });
    }
  });

  // Delete all log types
  app.delete('/api/log-types', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const count = await deleteAllLogTypes(userId);
      res.json({ success: true, message: `Removed all (${count}) records from log_type.` });
    } catch (error: any) {
      console.error('Failed to clear log types:', error);
      res.status(500).json({ error: error.message || 'Failed to clear log types' });
    }
  });

  // Delete a log type
  app.delete('/api/log-types/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID.' });
      }
      const deleted = await deleteLogType(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Log type not found.' });
      }
      res.json({ success: true, message: `Log type with id ${id} deleted.` });
    } catch (error: any) {
      console.error('Failed to delete log type:', error);
      res.status(500).json({ error: error.message || 'Failed to delete log type' });
    }
  });

  // Seed sample log types
  app.post('/api/seed-defaults', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser?.id;
      const sampleNames = ['Expenses', 'Income'];
      const current = await getLogTypes(userId);
      const existingNames = new Set(current.map(c => c.name.toUpperCase()));

      const createdList = [];
      for (const sName of sampleNames) {
        if (!existingNames.has(sName.toUpperCase())) {
          try {
            const created = await createLogType({ name: sName, userId });
            createdList.push(created);
          } catch {
            // Ignore if skipped
          }
        }
      }
      const all = await getLogTypes(userId);
      res.json({ message: `Seeded ${createdList.length} default log types.`, logTypes: all });
    } catch (error: any) {
      console.error('Failed to seed defaults:', error);
      res.status(500).json({ error: error.message || 'Failed to seed sample log types' });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

