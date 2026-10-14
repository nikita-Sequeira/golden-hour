import React from 'react';
import { Plus, Minus, Bed } from 'lucide-react';
import { BedCounts, Hospital } from '../../../types/bedlink';
import { Translations } from '../../../i18n/translations';

interface BedInventoryEditorProps {
  hospital: Hospital;
  bedCounts: BedCounts;
  onUpdate: (type: keyof BedCounts, delta: number) => void;
  t: Translations;
}

export const BedInventoryEditor: React.FC<BedInventoryEditorProps> = ({
  hospital,
  bedCounts,
  onUpdate,
  t,
}) => {
  const bedTypes: Array<{
    key: keyof BedCounts;
    label: string;
    sub: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }> = [
    { key: 'icu', label: 'ICU Beds', sub: 'Intensive Critical Care', bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
    { key: 'trauma', label: 'Trauma Bays', sub: 'Resuscitation Unit', bgColor: 'bg-rose-50', textColor: 'text-rose-700', borderColor: 'border-rose-200' },
    { key: 'vent', label: 'Ventilators', sub: 'Invasive Mechanical', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
    { key: 'oxygen', label: 'Oxygen HDU', sub: 'High Flow Support', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
    { key: 'burns', label: 'Burns Unit', sub: 'Sterile Isolated', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
    { key: 'general', label: 'General Ward', sub: 'Step-Down Recovery', bgColor: 'bg-slate-100', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <Bed className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              {t.tenSecUpdate}
            </h3>
            <p className="text-xs text-slate-500">
              Facility: <strong>{hospital.name}</strong> • Updates reflect instantly on commuter radar
            </p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
          Live Inventory
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {bedTypes.map(({ key, label, sub, bgColor, textColor, borderColor }) => (
          <div
            key={key}
            className={`p-3.5 rounded-2xl border ${borderColor} ${bgColor} flex flex-col justify-between space-y-2`}
          >
            <div>
              <div className={`text-xs font-black ${textColor}`}>
                {label}
              </div>
              <div className="text-[10px] text-slate-500 font-medium truncate">{sub}</div>
            </div>

            <div className="text-2xl font-black text-slate-950 font-mono text-center">
              {bedCounts[key] ?? 0}
            </div>

            <div className="flex items-center justify-between gap-1 pt-1">
              <button
                type="button"
                onClick={() => onUpdate(key, -1)}
                disabled={(bedCounts[key] ?? 0) <= 0}
                aria-label={`Decrement ${label} count`}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shadow-xs transition-colors cursor-pointer disabled:opacity-30 min-h-[40px] min-w-[40px]"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onUpdate(key, 1)}
                aria-label={`Increment ${label} count`}
                className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center shadow-xs transition-colors cursor-pointer min-h-[40px] min-w-[40px]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
