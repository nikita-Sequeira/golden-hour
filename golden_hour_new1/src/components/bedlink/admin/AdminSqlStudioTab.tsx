import React from 'react';
import { Database, Terminal, Play, Download, RotateCcw, Lock } from 'lucide-react';
import { DatabaseStatus, SqlQueryResult } from '../../../api/client';

interface AdminSqlStudioTabProps {
  dbStatus: DatabaseStatus | null;
  sqlQuery: string;
  setSqlQuery: (q: string) => void;
  queryResult: SqlQueryResult | null;
  isExecutingSql: boolean;
  onRunSql: (q?: string) => void;
  onResetDb: () => void;
}

export const AdminSqlStudioTab: React.FC<AdminSqlStudioTabProps> = ({
  dbStatus,
  sqlQuery,
  setSqlQuery,
  queryResult,
  isExecutingSql,
  onRunSql,
  onResetDb,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Server & DB Info */}
      <div className="bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-100">
                  Node.js SQLite Database Engine
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Admin Authenticated
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                data/golden_hour.db
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/db/export"
              download="golden_hour_backup.json"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer min-h-[38px]"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Export JSON Backup</span>
            </a>
            {import.meta.env.DEV && (
              <button
                onClick={onResetDb}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold border border-rose-800 transition-colors cursor-pointer min-h-[38px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset / Sync Seed State</span>
              </button>
            )}
          </div>
        </div>

        {/* Table counts grid */}
        {dbStatus && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">hospitals</span>
              <strong className="text-emerald-400 text-sm">{dbStatus.tables.hospitals} rows</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">admission_records</span>
              <strong className="text-purple-400 text-sm">{dbStatus.tables.admission_records} rows</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">user_logs</span>
              <strong className="text-amber-400 text-sm">{dbStatus.tables.user_logs} rows</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">doctors</span>
              <strong className="text-blue-400 text-sm">{dbStatus.tables.doctors} rows</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">auth_users</span>
              <strong className="text-cyan-400 text-sm">{dbStatus.tables.auth_users} rows</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">journal_mode</span>
              <strong className="text-white text-sm">{dbStatus.journalMode.toUpperCase()}</strong>
            </div>
          </div>
        )}
      </div>

      {/* SQL Console Runner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-600" />
            <h4 className="font-extrabold text-slate-900 text-sm">
              Strictly Read-Only SQL Query Runner (SELECT / PRAGMA)
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Presets:</span>
            <button
              onClick={() => {
                const q = 'SELECT id, patient_name, age, confirmed_hospital, discharge_status, created_at FROM admission_records ORDER BY created_at DESC;';
                setSqlQuery(q);
                onRunSql(q);
              }}
              className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono cursor-pointer"
            >
              Admissions
            </button>
            <button
              onClick={() => {
                const q = 'SELECT id, name, zone, icu_beds, trauma_beds, vent_beds, updated_at FROM hospitals ORDER BY zone ASC;';
                setSqlQuery(q);
                onRunSql(q);
              }}
              className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono cursor-pointer"
            >
              Hospitals By Zone
            </button>
            <button
              onClick={() => {
                const q = 'SELECT role, COUNT(*) as count FROM user_logs GROUP BY role;';
                setSqlQuery(q);
                onRunSql(q);
              }}
              className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono cursor-pointer"
            >
              Roles GroupBy
            </button>
          </div>
        </div>

        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Security Notice: Mutating statements (INSERT, UPDATE, DELETE, DROP) and credential queries on auth_users are strictly forbidden.</span>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            rows={3}
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder="Enter read-only SQL query (e.g. SELECT * FROM hospitals;)"
            className="w-full p-3 font-mono text-xs sm:text-sm bg-slate-900 text-emerald-400 rounded-xl border border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => onRunSql()}
            disabled={isExecutingSql}
            className="absolute bottom-3 right-3 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50 min-h-[36px]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isExecutingSql ? 'Running…' : 'Execute Read-Only SQL'}</span>
          </button>
        </div>

        {/* Query Result Output Table */}
        {queryResult && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Result: {queryResult.type === 'SELECT' ? `${queryResult.rowCount} rows returned` : `${queryResult.changes ?? 0} rows affected`}
              </span>
              <span className="font-mono text-slate-400">
                Execution Time: {queryResult.executionMs ?? 0} ms
              </span>
            </div>

            {queryResult.error ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                Error: {queryResult.error}
              </div>
            ) : queryResult.rows && queryResult.rows.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      {Object.keys(queryResult.rows[0]).map((col) => (
                        <th key={col} className="p-2 border-b border-slate-200 font-bold text-slate-700 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {Object.values(row).map((val: any, cidx) => (
                          <td key={cidx} className="p-2 whitespace-nowrap text-slate-800 max-w-xs truncate">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                Query executed successfully. 0 rows returned.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
