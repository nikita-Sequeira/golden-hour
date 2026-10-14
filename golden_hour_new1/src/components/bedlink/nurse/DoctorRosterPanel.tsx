import React from 'react';
import { Send, UserCheck } from 'lucide-react';
import { Translations } from '../../../i18n/translations';

interface Doctor {
  id: string;
  name: string;
  status: string;
  specialty: string;
  dept: string;
  location: string;
  activeCase: string;
  avatar?: string;
  phone?: string;
}

interface DoctorRosterPanelProps {
  doctors: Doctor[];
  caseId: string;
  onPageDoctor: (doctorName: string) => void;
  t: Translations;
}

export const DoctorRosterPanel: React.FC<DoctorRosterPanelProps> = ({
  doctors,
  caseId,
  onPageDoctor,
  t,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
            {t.onDutyDoctorsTitle}
          </h3>
          <p className="text-xs text-slate-500">
            Rapid paging &amp; case assignment for Emergency #{caseId}
          </p>
        </div>
        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
          {doctors.length} Doctors on Shift
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {doctors.map((doc) => {
          const isAvailable = doc.status === 'AVAILABLE';
          return (
            <div
              key={doc.id}
              className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all bg-white flex flex-col justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-black text-sm shrink-0">
                  <UserCheck className="w-6 h-6 text-slate-500" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {doc.name}
                    </h4>
                    <span
                      className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                        isAvailable
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-rose-700 truncate">
                    {doc.specialty}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{doc.dept}</div>
                  <div className="text-[11px] text-slate-400">{doc.location}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                <span className="text-xs text-slate-600 font-mono">
                  {doc.phone || '+91 22 6767 6700'}
                </span>
                <button
                  type="button"
                  onClick={() => onPageDoctor(doc.name)}
                  disabled={!isAvailable}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 min-h-[38px]"
                >
                  <Send className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t.requestAvailability}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
