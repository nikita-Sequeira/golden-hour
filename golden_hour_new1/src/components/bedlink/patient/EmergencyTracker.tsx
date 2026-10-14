import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Phone,
  Navigation,
  AlertTriangle,
  Radio,
  XCircle,
} from 'lucide-react';
import { EmergencyCase, PatientInfo } from '../../../types/bedlink';
import { Translations } from '../../../i18n/translations';

interface EmergencyTrackerProps {
  emergencyCase: EmergencyCase | null;
  patientInfo: PatientInfo;
  selectedPaymentMode: string;
  onCancelHold?: (caseId: string) => void;
  onGoToRadar?: () => void;
  t: Translations;
}

export const EmergencyTracker: React.FC<EmergencyTrackerProps> = ({
  emergencyCase,
  patientInfo,
  selectedPaymentMode,
  onCancelHold,
  onGoToRadar,
  t,
}) => {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const ts = emergencyCase?.updatedAt ? new Date(emergencyCase.updatedAt).getTime() : Date.now();
      const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
      setSecondsAgo(diffSec);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [emergencyCase?.updatedAt]);

  const isActiveOrConfirmed =
    Boolean(emergencyCase) &&
    (emergencyCase?.holdStatus === 'active' || emergencyCase?.holdStatus === 'confirmed');

  // Empty state when no emergency bed has been held yet or hold is cancelled/expired/completed
  if (!emergencyCase || !isActiveOrConfirmed) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <Truck className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900">
            {emergencyCase?.holdStatus === 'expired'
              ? t.reservationExpired
              : emergencyCase?.holdStatus === 'cancelled'
              ? 'Reservation was cancelled.'
              : emergencyCase?.holdStatus === 'completed'
              ? 'Emergency care completed & discharged.'
              : t.noBedReservedYet}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            {t.findBedFirst}
          </p>
        </div>
        {onGoToRadar && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onGoToRadar}
              className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer min-h-[44px]"
            >
              Open Hospital Bed Radar
            </button>
          </div>
        )}
      </div>
    );
  }

  const isSignalLost = secondsAgo > 60;
  const isBloodKnown =
    Boolean(patientInfo.bloodType) &&
    patientInfo.bloodType !== "Don't know" &&
    patientInfo.bloodType !== 'Unknown';

  return (
    <div className="space-y-6">
      {/* Top dark telemetry card */}
      <div className="gh-hero gh-accent-red p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-rose-300 font-bold ">
                Vehicle {emergencyCase.vehicleNo}, 108 advanced life support
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Driver: {emergencyCase.driverName}
              </h2>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-400 font-medium">Estimated Arrival at Hospital</div>
            <div className="font-display text-4xl sm:text-5xl font-extrabold text-rose-300 tabular-nums">
              {t.etaMinutes}{emergencyCase.etaMinutes} mins
            </div>
          </div>
        </div>

        <div className="gh-stat p-4 space-y-2">
          <div className="flex items-center justify-between text-xs mb-1 flex-wrap gap-2">
            <span className="text-slate-400 font-bold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              <span>Live ambulance location</span>
            </span>

            {isSignalLost ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-mono text-[10px] flex items-center gap-1 font-bold">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>GPS Signal Lost ({secondsAgo}s ago)</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Last GPS update {secondsAgo}s ago</span>
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{emergencyCase.currentStreet}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-1 pt-1 border-t border-slate-800/80">
            <div>
              Destination Hospital: <strong className="text-slate-200">{emergencyCase.hospitalName}</strong>
            </div>
            {emergencyCase.lat && emergencyCase.lng && (
              <div className="font-mono text-[11px] text-slate-500">
                Coords: {emergencyCase.lat.toFixed(4)}, {emergencyCase.lng.toFixed(4)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Journey Pipeline */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-400 ">
              REAL-TIME DISPATCH PROGRESSION
            </h3>
          </div>

          <div className="space-y-3">
            <div
              className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                emergencyCase.pipelineStage >= 1 ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{t.ambulanceDispatched}</div>
                  <div className="text-xs text-slate-500">{t.ambulanceDispatchedDesc}</div>
                </div>
              </div>
              {emergencyCase.pipelineStage === 1 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-600 text-white">
                  Active
                </span>
              )}
            </div>

            <div
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                emergencyCase.pipelineStage >= 2 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                    emergencyCase.pipelineStage >= 2 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">{t.enRouteToPatient}</div>
                  <div className="text-xs text-slate-500">{t.enRouteToPatientDesc}</div>
                </div>
              </div>
              {emergencyCase.pipelineStage === 2 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white">
                  Active
                </span>
              )}
            </div>

            <div
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                emergencyCase.pipelineStage >= 3 ? 'border-purple-300 bg-purple-50/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                    emergencyCase.pipelineStage >= 3 ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">{t.arrivedAtScene}</div>
                  <div className="text-xs text-slate-500">{t.arrivedAtSceneDesc}</div>
                </div>
              </div>
              {emergencyCase.pipelineStage === 3 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-600 text-white">
                  Active
                </span>
              )}
            </div>

            <div
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                emergencyCase.pipelineStage >= 4 ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                    emergencyCase.pipelineStage >= 4 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">{t.inTransitToHospital}</div>
                  <div className="text-xs text-slate-500">{t.inTransitToHospitalDesc}</div>
                </div>
              </div>
              {emergencyCase.pipelineStage === 4 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-600 text-white">
                  Active
                </span>
              )}
            </div>

            <div
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                emergencyCase.pipelineStage >= 5 ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                    emergencyCase.pipelineStage >= 5 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">{t.deliveredToEr}</div>
                  <div className="text-xs text-slate-500">{t.deliveredToErDesc}</div>
                </div>
              </div>
              {emergencyCase.pipelineStage === 5 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white">
                  Delivered
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Case & Hospital Details */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-400 block">
                RESERVED EMERGENCY CASE
              </span>
              <h4 className="text-lg font-black text-slate-900 mt-0.5">
                {patientInfo.isUnidentified ? 'Unknown patient' : patientInfo.patientName || emergencyCase.patientName}
                {!patientInfo.isQuickEmergency && !emergencyCase.isQuickIntake && patientInfo.age !== null && patientInfo.age !== undefined && patientInfo.gender ? (
                  <> ({patientInfo.age}y {patientInfo.gender})</>
                ) : null}
              </h4>
              <p className="text-xs text-slate-500">
                Attendant: {patientInfo.relativeName || emergencyCase.relativeName} ({patientInfo.phone || emergencyCase.relativePhone})
              </p>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-950 block">Payment Mode:</span>
                <span className="text-emerald-800 text-[11px]">{selectedPaymentMode || emergencyCase.insuranceClaimMode}</span>
              </div>
            </div>

            {/* Blood Type Info */}
            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 space-y-1 text-xs">
              <div className="font-bold text-rose-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                <span>
                  Blood Group:{' '}
                  {isBloodKnown ? patientInfo.bloodType : "Don't know (Cross-matching upon arrival)"}
                </span>
              </div>
              <p className="text-rose-800 text-[11px] leading-relaxed">
                Hospital emergency triage notified. Blood bank reserves trauma units immediately after patient cross-match.
              </p>
            </div>

            <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900">Assigned Facility &amp; Bay:</span>
                <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-bold">
                  {emergencyCase.holdStatus === 'confirmed' ? 'Confirmed (En Route)' : 'Active Hold'}
                </span>
              </div>
              <div className="font-black text-slate-900 text-xs sm:text-sm">
                {emergencyCase.hospitalName}
              </div>
              <div className="font-semibold text-purple-950 text-xs">
                {emergencyCase.bedBay}
              </div>
              <div className="pt-1">
                <a
                  href={`tel:${emergencyCase.hospitalPhone}`}
                  className="font-mono text-purple-800 font-bold hover:underline inline-flex items-center gap-1 text-xs"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call Hospital ER: {emergencyCase.hospitalPhone}</span>
                </a>
              </div>
            </div>

            {/* Pilot Contact */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">108 Pilot:</span>
                <strong className="text-slate-900">{emergencyCase.driverName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vehicle:</span>
                <strong className="text-slate-900 font-mono">{emergencyCase.vehicleNo}</strong>
              </div>
              <a
                href={`tel:${emergencyCase.driverPhone}`}
                className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Driver ({emergencyCase.driverPhone})</span>
              </a>
            </div>

            {/* Cancel Reservation Action */}
            {onCancelHold && (emergencyCase.holdStatus === 'active' || emergencyCase.holdStatus === 'confirmed') && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onCancelHold(emergencyCase.caseId)}
                  className="w-full py-2.5 px-3 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>{t.cancelReservation}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
