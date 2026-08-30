import React, { useState } from 'react';
import { SchemaColumn } from '../types.ts';
import { Database, Code2, Copy, Check, Table2, Key } from 'lucide-react';

interface SchemaInspectorProps {
  columns: SchemaColumn[];
  isLoading: boolean;
  viewMode?: 'columns' | 'sql' | 'all';
  tableName?: string;
}

export const SchemaInspector: React.FC<SchemaInspectorProps> = ({
  columns,
  isLoading,
  viewMode = 'all',
  tableName = 'tag_type',
}) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyCode = (code: string, section: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const isLogs = tableName === 'logs';
  const isStarterLogs = tableName === 'starter_logs';
  const isAssn = tableName === 'tag_log_assn';

  const sqlDdl = isAssn
    ? `-- PostgreSQL DDL for 'tag_log_assn' association table
CREATE TABLE "tag_log_assn" (
  "id" serial PRIMARY KEY NOT NULL,
  "tag_id" integer NOT NULL REFERENCES "tag_type"("id") ON DELETE CASCADE,
  "log_id" integer NOT NULL REFERENCES "logs"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now()
);`
    : isStarterLogs
    ? `-- PostgreSQL DDL for 'starter_logs' table
CREATE TABLE "starter_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "log_date" date DEFAULT CURRENT_DATE NOT NULL,
  "log_description" text,
  "log_type_id" integer REFERENCES "log_type"("id"),
  "log_amount" numeric(12, 2),
  "log_category" integer REFERENCES "category_type"("id"),
  "reconciled" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);`
    : isLogs
    ? `-- PostgreSQL DDL for 'logs' table
CREATE TABLE "logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "log_date" date NOT NULL,
  "log_description" text,
  "log_type_id" integer REFERENCES "log_type"("id"),
  "log_amount" numeric(12, 2),
  "log_category" integer REFERENCES "category_type"("id"),
  "reconciled" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);`
    : `-- PostgreSQL DDL for '${tableName}' lookup table
CREATE TABLE "${tableName}" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "${tableName}_name_unique" UNIQUE("name")
);`;

  const drizzleModel = isAssn
    ? `// Drizzle ORM Schema Definition (src/db/schema.ts)
import { pgTable, serial, integer, timestamp } from 'drizzle-orm/pg-core';
import { tagType, logs } from './schema.ts';

export const tagLogAssn = pgTable('tag_log_assn', {
  id: serial('id').primaryKey(),
  tagId: integer('tag_id').references(() => tagType.id, { onDelete: 'cascade' }).notNull(),
  logId: integer('log_id').references(() => logs.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});`
    : isStarterLogs
    ? `// Drizzle ORM Schema Definition (src/db/schema.ts)
import { sql } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, date, integer, numeric, boolean } from 'drizzle-orm/pg-core';
import { logType, categoryType } from './schema.ts';

export const starterLogs = pgTable('starter_logs', {
  id: serial('id').primaryKey(),
  logDate: date('log_date').default(sql\`CURRENT_DATE\`).notNull(),
  logDescription: text('log_description'),
  logTypeId: integer('log_type_id').references(() => logType.id),
  logAmount: numeric('log_amount', { precision: 12, scale: 2 }),
  logCategory: integer('log_category').references(() => categoryType.id),
  reconciled: boolean('reconciled').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});`
    : isLogs
    ? `// Drizzle ORM Schema Definition (src/db/schema.ts)
import { pgTable, serial, text, timestamp, date, integer, numeric, boolean } from 'drizzle-orm/pg-core';
import { logType, categoryType } from './schema.ts';

export const logs = pgTable('logs', {
  id: serial('id').primaryKey(),
  logDate: date('log_date').notNull(),
  logDescription: text('log_description'),
  logTypeId: integer('log_type_id').references(() => logType.id),
  logAmount: numeric('log_amount', { precision: 12, scale: 2 }),
  logCategory: integer('log_category').references(() => categoryType.id),
  reconciled: boolean('reconciled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});`
    : `// Drizzle ORM Schema Definition (src/db/schema.ts)
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const ${tableName === 'category_type' ? 'categoryType' : tableName === 'tag_type' ? 'tagType' : 'logType'} = pgTable('${tableName}', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});`;

  const foreignKeyExample = isAssn
    ? `-- Example: Querying logs with attached tags via association table
SELECT 
  l.id AS log_id,
  l.log_date,
  l.log_description,
  t.id AS tag_id,
  t.name AS tag_name
FROM tag_log_assn tla
JOIN logs l ON tla.log_id = l.id
JOIN tag_type t ON tla.tag_id = t.id
ORDER BY l.log_date DESC;`
    : isLogs
    ? `-- Example: Querying logs with relational joins
SELECT 
  l.id,
  l.log_date,
  l.log_description,
  lt.name AS log_type,
  l.log_amount,
  ct.name AS category_name
FROM logs l
LEFT JOIN log_type lt ON l.log_type_id = lt.id
LEFT JOIN category_type ct ON l.log_category = ct.id
ORDER BY l.log_date DESC;`
    : `-- Example: Referencing '${tableName}' in related records table
CREATE TABLE "item_tags" (
  "id" serial PRIMARY KEY NOT NULL,
  "${tableName}_id" integer NOT NULL REFERENCES "${tableName}"("id") ON DELETE RESTRICT,
  "item_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now()
);`;

  return (
    <div id="schema-inspector-panel" className="space-y-6">
      {/* Live Information Schema Table */}
      {(viewMode === 'columns' || viewMode === 'all') && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">PostgreSQL Schema Columns (`information_schema.columns`)</h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time metadata retrieved from Cloud SQL PostgreSQL instance</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Cloud SQL
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Column Name</th>
                  <th className="px-6 py-3.5">Data Type</th>
                  <th className="px-6 py-3.5">Nullable</th>
                  <th className="px-6 py-3.5">Default Value</th>
                  <th className="px-6 py-3.5">Constraints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">Loading column metadata...</td>
                  </tr>
                ) : (
                  columns.map((col) => (
                    <tr key={col.column_name} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3.5 font-semibold text-black flex items-center gap-1.5">
                        {col.column_name === 'id' && <Key className="w-3.5 h-3.5 text-blue-600" />}
                        <span>{col.column_name}</span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-700">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-black border border-gray-200 font-mono text-[11px]">
                          {col.data_type}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          col.is_nullable === 'NO' ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 font-mono">
                        {col.column_default || '—'}
                      </td>
                      <td className="px-6 py-3.5">
                        {col.column_name === 'id' ? (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">
                              PRIMARY KEY
                            </span>
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-bold rounded uppercase">
                              AUTO_INC
                            </span>
                          </div>
                        ) : col.column_name === 'name' ? (
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded uppercase">
                            UNIQUE
                          </span>
                        ) : col.column_name === 'log_type_id' ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase border border-indigo-100">
                            FK → log_type(id)
                          </span>
                        ) : col.column_name === 'log_category' ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase border border-indigo-100">
                            FK → category_type(id)
                          </span>
                        ) : col.column_name === 'log_user_id' ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase border border-indigo-100">
                            FK → users(id)
                          </span>
                        ) : col.column_name === 'tag_id' ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase border border-indigo-100">
                            FK → tag_type(id)
                          </span>
                        ) : col.column_name === 'log_id' ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase border border-indigo-100">
                            FK → logs(id)
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Code Blocks */}
      {(viewMode === 'sql' || viewMode === 'all') && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SQL DDL */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden text-gray-300 shadow-md">
              <div className="px-4 py-2.5 bg-black/50 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                  <Table2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>PostgreSQL DDL</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode(sqlDdl, 'sql')}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors text-xs flex items-center gap-1"
                >
                  {copiedSection === 'sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === 'sql' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono overflow-x-auto text-emerald-400 leading-relaxed">
                <code>{sqlDdl}</code>
              </pre>
            </div>

            {/* Drizzle Schema */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden text-gray-300 shadow-md">
              <div className="px-4 py-2.5 bg-black/50 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                  <Code2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>TypeScript Drizzle ORM Schema</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode(drizzleModel, 'drizzle')}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors text-xs flex items-center gap-1"
                >
                  {copiedSection === 'drizzle' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSection === 'drizzle' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono overflow-x-auto text-sky-300 leading-relaxed">
                <code>{drizzleModel}</code>
              </pre>
            </div>
          </div>

          {/* Foreign Key Reference Example */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden text-gray-300 shadow-md">
            <div className="px-4 py-2.5 bg-black/50 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Usage Guide: Foreign Key Reference in Related Tables</span>
              </div>
              <button
                type="button"
                onClick={() => copyCode(foreignKeyExample, 'fk')}
                className="p-1 text-gray-400 hover:text-white rounded transition-colors text-xs flex items-center gap-1"
              >
                {copiedSection === 'fk' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSection === 'fk' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto text-amber-300 leading-relaxed">
              <code>{foreignKeyExample}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

