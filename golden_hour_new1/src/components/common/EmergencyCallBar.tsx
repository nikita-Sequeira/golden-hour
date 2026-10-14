import React from 'react';
import { Phone, ShieldAlert, AlertCircle } from 'lucide-react';
import { Translations } from '../../i18n/translations';

interface EmergencyCallBarProps {
  t: Translations;
  showDisclaimer?: boolean;
}

export const EmergencyCallBar: React.FC<EmergencyCallBarProps> = ({ t, showDisclaimer = true }) => {
  return (
    <aside aria-label="Emergency direct telephone call options" className="space-y-2">
      {showDisclaimer && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">{t.calmDisclaimer}</span>
        </div>
      )}
      <div className="bg-slate-900 text-white rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md border border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-black text-rose-300">
              Immediate Human Assistance
            </div>
            <div className="text-xs text-slate-300">Western Railway Commuter Helpline</div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="tel:108"
            aria-label="Call 108 Emergency Ambulance service directly"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{t.call108Action}</span>
          </a>
          <a
            href="tel:112"
            aria-label="Call 112 National Emergency Number directly"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer min-h-[44px]"
          >
            <Phone className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.call112Action}</span>
          </a>
        </div>
      </div>
    </aside>
  );
};
