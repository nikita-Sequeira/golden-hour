import React from 'react';
import { Search, Clock, CheckCircle2, LogOut, Eye } from 'lucide-react';
import { PatientAdmissionRecord } from '../../../types/bedlink';
import { Translations } from '../../../i18n/translations';

interface AdminAdmissionsTabProps {
  admissionRecords: PatientAdmissionRecord[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onDischargePatient: (id: string) => void;
  onSelectRecord: (record: PatientAdmissionRecord) => void;
  t: Translations;
}

export const AdminAdmissionsTab: React.FC<AdminAdmissionsTabProps> = ({
  admissionRecords,
  searchQuery,
  setSearchQuery,
  onDischargePatient,
  onSelectRecord,
  t,
}) => {
  const filtered = admissionRecords.filter(
    (r) =>
      r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search by patient name, ID, or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-hidden min-h-[44px]"
          />
        </div>
        <div className="text-xs text-slate-500 font-semibold">
          Showing <strong className="text-slate-900">{filtered.length}</strong> active patient files in SQLite DB
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                <th className="py-3 px-4">PATIENT PROFILE &amp; CONTACT</th>
                <th className="py-3 px-4">LOGIN / INTAKE TIME</th>
                <th className="py-3 px-4">CONFIRMED HOSPITAL &amp; BAY</th>
                <th className="py-3 px-4">CONFIRMATION TIME</th>
                <th className="py-3 px-4">DISCHARGE STATUS &amp; TIME</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((record) => {
                const isAdmitted = record.dischargeStatus === 'Admitted / In Care';
                const isDischarged = record.dischargeStatus === 'Discharged';
                const isUnidentified = record.isUnidentified || record.patientName === 'Unknown patient';

                return (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-extrabold text-slate-900 text-sm flex-wrap">
                        <span>{record.patientName}</span>
                        {isUnidentified && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            Unidentified Commuter
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          {record.bloodType || "Don't know"}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {record.isQuickIntake || record.age === null || record.age === undefined || !record.gender
                            ? 'Demographics withheld for quick emergency'
                            : `${record.age}y • ${record.gender}`}
                        </span>
                      </div>
                      <div className="text-slate-500 font-medium text-[11px] flex items-center gap-1">
                        <span>{record.phone}</span>
                        <span>•</span>
                        <span>Contact: {record.relativeName}</span>
                      </div>
                      <div className="text-slate-400 font-mono text-[10px]">
                        ID: {record.id} {record.caseId && `• Case: ${record.caseId}`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">
                        {new Date(record.loginIntakeTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{record.intakeAgo}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {record.confirmedHospital === 'Pending Facility Hold' ? (
                        <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]">
                          Pending Facility Hold
                        </span>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-900">{record.confirmedHospital}</div>
                          {record.confirmedBay && (
                            <div className="inline-block mt-0.5 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {record.confirmedBay}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div>
                        {record.confirmationTime && record.confirmationTime !== 'Awaiting response'
                          ? new Date(record.confirmationTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                          : 'Awaiting hold'}
                      </div>
                      {record.confirmationAgo && (
                        <div className="text-[11px] text-slate-400">{record.confirmationAgo}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {isAdmitted ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>ADMITTED / IN CARE</span>
                          </span>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Under Active Treatment
                          </div>
                        </div>
                      ) : isDischarged ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-slate-500" />
                            <span>Discharged</span>
                          </span>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {record.dischargeTime
                              ? new Date(record.dischargeTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                              : 'Discharged'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Triage Phase</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      {isAdmitted && (
                        <button
                          type="button"
                          onClick={() => onDischargePatient(record.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer min-h-[36px]"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>{t.dischargePatient}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectRecord(record)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer min-h-[36px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t.viewDossier}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
