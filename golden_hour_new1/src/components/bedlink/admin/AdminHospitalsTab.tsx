import React from 'react';
import { Hospital } from '../../../types/bedlink';
import { Translations } from '../../../i18n/translations';
import { Clock, Building2, MapPin, Phone, ShieldCheck } from 'lucide-react';

interface AdminHospitalsTabProps {
  hospitals: Hospital[];
  t: Translations;
}

export const AdminHospitalsTab: React.FC<AdminHospitalsTabProps> = ({ hospitals }) => {
  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500 font-semibold">
        Managing <strong className="text-slate-900">{hospitals.length}</strong> facilities across all 10 zones of the Western Railway corridor.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hospitals.map((hosp) => (
          <div key={hosp.id} className="rounded-3xl border border-slate-200 bg-white overflow-hidden space-y-3 shadow-xs flex flex-col justify-between">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    hosp.isGovernment ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-tight">{hosp.name}</h4>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{hosp.zone} • {hosp.stationVicinity}</span>
                    </p>
                  </div>
                </div>
                {hosp.isGovernment && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                    Govt
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-mono text-slate-700 text-[11px] flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{hosp.phone}</span>
                </span>
                {hosp.acceptsInsurance ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Cashless PM-JAY</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Cash Billing
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 pt-0 space-y-3">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-xs">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-900 font-semibold">
                  <div className="text-[9px] font-bold text-purple-700">ICU</div>
                  <strong>{hosp.beds.icu}</strong>
                </div>
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-900 font-semibold">
                  <div className="text-[9px] font-bold text-rose-700">Trauma</div>
                  <strong>{hosp.beds.trauma}</strong>
                </div>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-900 font-semibold">
                  <div className="text-[9px] font-bold text-blue-700">Vent</div>
                  <strong>{hosp.beds.vent}</strong>
                </div>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-900 font-semibold">
                  <div className="text-[9px] font-bold text-emerald-700">O2</div>
                  <strong>{hosp.beds.oxygen}</strong>
                </div>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-900 font-semibold">
                  <div className="text-[9px] font-bold text-amber-700">Burns</div>
                  <strong>{hosp.beds.burns}</strong>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-900 font-semibold">
                  <div className="text-[9px] font-bold text-slate-700">General</div>
                  <strong>{hosp.beds.general}</strong>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Updated {hosp.freshMinutesAgo}m ago</span>
                </span>
                <span className="font-mono text-slate-500">ID: {hosp.id}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
