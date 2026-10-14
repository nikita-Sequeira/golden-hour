import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Edit3, RotateCcw, ArrowRight } from 'lucide-react';
import { ScannedAadhaarData } from '../AadhaarScannerModal';
import { WESTERN_LINE_STATIONS } from '../../../data/stations';

interface ScannerResultProps {
  data: ScannedAadhaarData;
  previewUrl: string | null;
  onConfirm: (finalData: ScannedAadhaarData) => void;
  onRescan: () => void;
}

export const ScannerResult: React.FC<ScannerResultProps> = ({
  data,
  onConfirm,
  onRescan,
}) => {
  const [formData, setFormData] = useState<ScannedAadhaarData>({
    ...data,
    bloodType: data.bloodType || "Don't know",
  });
  const [isEditing, setIsEditing] = useState(false);

  const bloodOptions = ["Don't know", 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  return (
    <div className="space-y-4">
      {/* Top Banner with privacy guarantee */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-950 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Aadhaar Read Verified • Number Masked to Last 4 Digits</span>
        </div>
        <span className="font-mono text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
          {formData.aadhaarNumberMasked || 'Not visible'}
        </span>
      </div>

      {/* Extracted Fields Table / Form */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <span className="text-xs font-bold text-slate-700">CHECK EXTRACTED DETAILS</span>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer min-h-[36px]"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Done Editing' : 'Edit Details'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Patient Name */}
          <div>
            <label htmlFor="scanResName" className="block text-xs font-bold text-slate-500 mb-1">
              Patient Name
            </label>
            {isEditing ? (
              <input
                id="scanResName"
                type="text"
                value={formData.patientName || ''}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 min-h-[38px]"
              />
            ) : (
              <div className="font-bold text-slate-900 py-1">
                {formData.patientName || (
                  <span className="text-amber-700 flex items-center gap-1 text-[11px]">
                    <AlertCircle className="w-3 h-3" /> Not printed, please enter in next step
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Age & Gender */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Age &amp; Gender
            </label>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={formData.age !== null && formData.age !== undefined ? formData.age : ''}
                  onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) || null })}
                  placeholder="Age"
                  className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 min-h-[38px]"
                />
                <select
                  value={formData.gender || 'Female'}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 min-h-[38px]"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            ) : (
              <div className="font-bold text-slate-900 py-1">
                {formData.age ? `${formData.age} yrs` : 'Age: Not visible'} • {formData.gender || 'Not specified'}
              </div>
            )}
          </div>

          {/* Blood Type - explicit 'Don't know' */}
          <div>
            <label htmlFor="scanResBlood" className="block text-xs font-bold text-slate-500 mb-1">
              Blood Group (Not on Aadhaar)
            </label>
            <select
              id="scanResBlood"
              value={formData.bloodType || "Don't know"}
              onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-bold text-slate-900 min-h-[38px]"
            >
              {bloodOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Nearest Station */}
          <div>
            <label htmlFor="scanResStation" className="block text-xs font-bold text-slate-500 mb-1">
              Nearest Railway Station
            </label>
            <select
              id="scanResStation"
              value={formData.nearestStation || 'Bandra Station'}
              onChange={(e) => setFormData({ ...formData, nearestStation: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 min-h-[38px]"
            >
              {WESTERN_LINE_STATIONS.map((st) => (
                <option key={st.id} value={st.name}>{st.name}</option>
              ))}
            </select>
          </div>

          {/* Relative Name */}
          <div>
            <label htmlFor="scanResRel" className="block text-xs font-bold text-slate-500 mb-1">
              Attendant / Relative Name
            </label>
            <input
              id="scanResRel"
              type="text"
              value={formData.relativeName || ''}
              placeholder="Enter attendant name"
              onChange={(e) => setFormData({ ...formData, relativeName: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 min-h-[38px]"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="scanResPhone" className="block text-xs font-bold text-slate-500 mb-1">
              Contact Phone Number
            </label>
            <input
              id="scanResPhone"
              type="tel"
              value={formData.phone || ''}
              placeholder="Enter 10-digit phone"
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 min-h-[38px]"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onRescan}
          className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer min-h-[44px]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Rescan Card</span>
        </button>
        <button
          type="button"
          onClick={() => onConfirm(formData)}
          className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
        >
          <span>Continue with These Details</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
