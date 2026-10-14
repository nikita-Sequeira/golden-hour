import React from 'react';
import { UserLoginLog } from '../../../types/bedlink';

interface AdminAuditLogsTabProps {
  userLogs: UserLoginLog[];
}

export const AdminAuditLogsTab: React.FC<AdminAuditLogsTabProps> = ({ userLogs }) => {
  return (
    <div className="space-y-4">
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                <th className="py-3 px-4">USER &amp; CONTACT</th>
                <th className="py-3 px-4">AUTHENTICATED ROLE</th>
                <th className="py-3 px-4">FACILITY / CORRIDOR</th>
                <th className="py-3 px-4">LOGIN TIMESTAMP</th>
                <th className="py-3 px-4">SESSION STATUS</th>
                <th className="py-3 px-4">IP ORIGIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 whitespace-pre-line">{log.userAndContact}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.id}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                        log.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : log.role === 'AMBULANCE PILOT'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : log.role === 'NURSE STATION'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {log.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-pre-line text-slate-700">
                    {log.facilityOrStation}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">
                      {new Date(log.loginTimestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div className="text-[11px] text-slate-400">{log.timeAgo}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>{log.sessionStatus}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                    {log.ipOrigin}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
