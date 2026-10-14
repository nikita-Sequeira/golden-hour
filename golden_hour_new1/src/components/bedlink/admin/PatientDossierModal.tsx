import React from 'react';
import { X } from 'lucide-react';
import { PatientAdmissionRecord } from '../../../types/bedlink';

interface PatientDossierModalProps {
  record: PatientAdmissionRecord | null;
  onClose: () => void;
}

export const PatientDossierModal: React.FC<PatientDossierModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const isUnidentified = record.isUnidentified || record.patientName === 'Unknown patient';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossierModalTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="dossierModalTitle" className="font-black text-slate-900 text-lg">
                {record.patientName}
                {!record.isQuickIntake && record.age !== null && record.age !== undefined && record.gender ? ` (${record.age}y ${record.gender})` : ''}
              </h3>
              {isUnidentified && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  Unidentified
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Record ID: {record.id} {record.caseId && `• Case: ${record.caseId}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dossier"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer min-h-[36px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl space-y-2 border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-600">Contact Phone:</span>
              <strong className="text-slate-900">{record.phone}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Attendant / Contact:</span>
              <strong className="text-slate-900">{record.relativeName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Blood Group:</span>
              <strong className="text-rose-700 font-black">{record.bloodType || "Don't know"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Intake Time:</span>
              <strong className="text-slate-900">{new Date(record.loginIntakeTime).toLocaleString()}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Assigned Facility:</span>
              <strong className="text-slate-900">{record.confirmedHospital}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Reserved Bay:</span>
              <strong className="text-slate-900">{record.confirmedBay || 'Pending Facility Hold'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Payment / Insurance:</span>
              <strong className="text-slate-900">{record.insuranceType}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Discharge Status:</span>
              <strong className="text-emerald-700">{record.dischargeStatus}</strong>
            </div>
            {record.dischargeTime && (
              <div className="flex justify-between">
                <span className="text-slate-600">Discharged At:</span>
                <strong>{new Date(record.dischargeTime).toLocaleString()}</strong>
              </div>
            )}
            {record.notes && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block mb-0.5">Clinical Notes:</span>
                <p className="text-slate-800 italic">{record.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer min-h-[44px]"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
