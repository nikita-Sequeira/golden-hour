import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Phone,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { EmergencyCase, Hospital } from '../../types/bedlink';
import { PortalShell, ShellButton } from '../common/PortalShell';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { api } from '../../api/client';
import { calculateDistanceKm } from '../../utils/geo';

interface AmbulanceConsoleViewProps {
  emergencyCase: EmergencyCase | null;
  onAdvanceStage?: (caseId: string, stage: number, street?: string, etaMinutes?: number, lat?: number, lng?: number) => void;
  language: LanguageCode;
  hospitals?: Hospital[];
}

export const AmbulanceConsoleView: React.FC<AmbulanceConsoleViewProps> = ({
  emergencyCase,
  onAdvanceStage,
  language,
  hospitals = [],
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  const [currentStage, setCurrentStage] = useState(emergencyCase?.pipelineStage || 2);
  const [sirenActive, setSirenActive] = useState(true);

  // Live coordinates state
  const [currentLat, setCurrentLat] = useState<number>(emergencyCase?.lat || 19.0544);
  const [currentLng, setCurrentLng] = useState<number>(emergencyCase?.lng || 72.8402);
  const [currentStreetName, setCurrentStreetName] = useState<string>(
    emergencyCase?.currentStreet || 'Western Express Highway, Bandra Corridor'
  );
  const [gpsStatus, setGpsStatus] = useState<'watching' | 'simulated' | 'error'>('watching');
  const [lastPatchedTime, setLastPatchedTime] = useState<number>(Date.now());
  const [secondsSinceLastSend, setSecondsSinceLastSend] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(Date.now());

  // Keep the console aligned with the persisted case after a stage mutation or
  // a background refresh; this prevents stale local state from masking progress.
  useEffect(() => {
    if (!emergencyCase) return;
    setCurrentStage(emergencyCase.pipelineStage);
    setCurrentStreetName(emergencyCase.currentStreet);
  }, [emergencyCase?.caseId, emergencyCase?.pipelineStage, emergencyCase?.currentStreet]);

  // Find assigned destination hospital
  const targetHospital =
    hospitals.find((h) => h.id === emergencyCase?.hospitalId || h.name === emergencyCase?.hospitalName) ||
    hospitals[0];

  const destinationLat = targetHospital?.lat || 19.1228;
  const destinationLng = targetHospital?.lng || 72.8797;
  const destinationHospitalName = emergencyCase?.hospitalName || targetHospital?.name || 'Assigned Hospital ER';

  // Dynamic ETA calculation
  const distanceToDest = calculateDistanceKm(currentLat, currentLng, destinationLat, destinationLng);
  const dynamicEta = Math.max(1, Math.round(distanceToDest * 3.5)); // ~3.5 min/km Mumbai traffic

  // Throttled sender
  const sendLocationUpdate = async (lat: number, lng: number, streetText?: string, eta?: number) => {
    if (!emergencyCase) return;
    const now = Date.now();
    if (now - lastSentRef.current < 4000) return;
    lastSentRef.current = now;
    setLastPatchedTime(now);

    const etaVal = eta !== undefined ? eta : dynamicEta;
    const streetVal = streetText || currentStreetName;

    try {
      await api.updateAmbulanceLocation(emergencyCase.caseId, lat, lng, streetVal, etaVal);
    } catch (err) {
      console.warn('Failed to update ambulance telemetry:', err);
    }
  };

  // Watch position with strict cleanup on unmount & role switch
  useEffect(() => {
    if (!emergencyCase) return;

    if (typeof window !== 'undefined' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentLat(lat);
          setCurrentLng(lng);
          setGpsStatus('watching');
          sendLocationUpdate(lat, lng);
        },
        (err) => {
          console.warn('Ambulance watchPosition unavailable or blocked:', err.message);
          setGpsStatus('simulated');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else {
      setGpsStatus('simulated');
    }

    return () => {
      if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [emergencyCase?.caseId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceLastSend(Math.floor((Date.now() - lastPatchedTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastPatchedTime]);

  if (!emergencyCase || (emergencyCase.holdStatus !== 'active' && emergencyCase.holdStatus !== 'confirmed')) {
    return (
      <div className="bg-white rounded-3xl border border-dashed border-blue-300 p-8 sm:p-12 text-center space-y-3">
        <Truck className="w-12 h-12 text-blue-500 mx-auto" />
        <h3 className="text-xl font-extrabold text-slate-900">No emergency dispatched</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          This unit is on standby on the Western Line. When a commuter reserves a bed, the route and live coordinates appear here.
        </p>
      </div>
    );
  }

  const handleSimulateStep = () => {
    const stepLat = currentLat + (destinationLat - currentLat) * 0.25 + (Math.random() - 0.5) * 0.001;
    const stepLng = currentLng + (destinationLng - currentLng) * 0.25 + (Math.random() - 0.5) * 0.001;
    setCurrentLat(stepLat);
    setCurrentLng(stepLng);
    setGpsStatus('simulated');
    lastSentRef.current = 0;
    sendLocationUpdate(stepLat, stepLng);
  };

  const stages = [
    {
      num: 2,
      title: t.enRouteToPatient,
      desc: t.enRouteToPatientDesc,
      street: `Western Express Highway, en route to ${emergencyCase.location || 'Scene'}`,
    },
    {
      num: 3,
      title: t.arrivedAtScene,
      desc: t.arrivedAtSceneDesc,
      street: `At Patient Scene - ${emergencyCase.location || 'Station Corridor'}`,
    },
    {
      num: 4,
      title: t.inTransitToHospital,
      desc: t.inTransitToHospitalDesc,
      street: `Approaching ${destinationHospitalName} Emergency Bay`,
    },
    {
      num: 5,
      title: t.deliveredToEr,
      desc: t.deliveredToErDesc,
      street: `${destinationHospitalName} - ${emergencyCase.bedBay || 'Emergency Bay'}`,
    },
  ];

  const handleStageClick = (st: typeof stages[0]) => {
    setCurrentStage(st.num);
    setCurrentStreetName(st.street);
    const stageEta = st.num === 5 ? 0 : dynamicEta;
    if (onAdvanceStage) {
      onAdvanceStage(emergencyCase.caseId, st.num, st.street, stageEta, currentLat, currentLng);
    }
    lastSentRef.current = 0;
    sendLocationUpdate(currentLat, currentLng, st.street, stageEta);
  };

  const gpsLive = gpsStatus === 'watching';

  return (
    <PortalShell
      accent="blue"
      icon={Truck}
      title={t.driverConsoleTitle}
      subtitle={`${emergencyCase.driverName} · ${emergencyCase.vehicleNo}`}
      status={
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-semibold ${
            gpsLive ? 'bg-emerald-400/15 border-emerald-300/30 text-emerald-100' : 'bg-amber-400/15 border-amber-300/30 text-amber-100'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${gpsLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          {gpsLive ? 'Live GPS on' : 'Simulated route'}
        </span>
      }
      actions={
        <>
          <ShellButton tone={sirenActive ? 'danger' : 'ghost'} onClick={() => setSirenActive(!sirenActive)}>
            <Flame className="w-4 h-4" />
            <span>{sirenActive ? t.sirenActive : t.sirenInactive}</span>
          </ShellButton>
          <a
            href={`tel:${emergencyCase.hospitalPhone}`}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors min-h-[48px] flex-1 lg:flex-none"
          >
            <Phone className="w-4 h-4" />
            <span>{t.callErDesk}</span>
          </a>
        </>
      }
    >
      {!gpsLive && (
        <div role="alert" className="p-4 bg-amber-400 text-slate-950 rounded-2xl flex items-center gap-3 font-bold text-sm shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{t.gpsSimulatedBanner}</span>
        </div>
      )}

      {/* Arrival: the one number the driver needs */}
      <section className="rounded-3xl bg-slate-950 text-white p-6 sm:p-8 shadow-lg grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-center">
        <div>
          <div className="text-sm font-semibold text-slate-400">Arrival in</div>
          <div className="font-display font-extrabold leading-none text-blue-300 tabular-nums">
            <span className="text-7xl sm:text-8xl">{currentStage === 5 ? '0' : dynamicEta}</span>
            <span className="text-2xl sm:text-3xl ml-2 text-slate-300">min</span>
          </div>
        </div>
        <div className="space-y-3 min-w-0">
          <div>
            <div className="text-sm font-semibold text-slate-400">Taking the patient to</div>
            <div className="font-display text-2xl sm:text-3xl font-bold truncate">{destinationHospitalName}</div>
            <div className="text-emerald-300 font-semibold">{emergencyCase.bedBay || 'Emergency bay 01'}</div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-300">
            <span>About {distanceToDest.toFixed(1)} km away</span>
            <span className="truncate">{currentStreetName}</span>
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-[3fr_2fr] gap-5">
        {/* Milestones as a vertical route */}
        <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
          <h3 className="font-display text-2xl font-bold text-slate-900">{t.advanceMilestone}</h3>
          <p className="text-sm text-slate-500 mt-1">Tap a stage to update the family and the hospital team instantly.</p>

          <ol className="mt-5">
            {stages.map((st, idx) => {
              const isPassed = currentStage >= st.num;
              const isCurrent = currentStage === st.num;
              return (
                <li key={st.num} className="relative pl-14 pb-5 last:pb-0">
                  {idx < stages.length - 1 && (
                    <span className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${isPassed && !isCurrent ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  )}
                  <span
                    className={`absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : isPassed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 border border-slate-300'
                    }`}
                  >
                    {isPassed && !isCurrent ? <CheckCircle2 className="w-5 h-5" /> : st.num - 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStageClick(st)}
                    className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer min-h-[64px] ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50'
                        : isPassed
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-base text-slate-900">{st.title}</div>
                      {isCurrent && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-600 text-white shrink-0">Current</span>}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">{st.desc}</div>
                    <div className="text-xs text-slate-500 font-mono mt-1 truncate">{st.street}</div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="space-y-5">
          {/* Patient */}
          <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-display text-xl font-bold text-slate-900">Patient</h3>
            <div>
              <div className="text-lg font-bold text-slate-900">
                {emergencyCase.patientName}
                {!emergencyCase.isQuickIntake && emergencyCase.age !== null && emergencyCase.age !== undefined && emergencyCase.gender ? ` (${emergencyCase.age}y, ${emergencyCase.gender})` : ''}
              </div>
              <div className="text-sm text-slate-600">
                Blood group <strong className="text-rose-600">{emergencyCase.bloodType || "Don't know"}</strong>
              </div>
            </div>
            <div className="text-sm text-slate-600 border-t border-slate-100 pt-3">
              <div>Contact: <strong className="text-slate-900">{emergencyCase.relativeName}</strong></div>
              <div className="font-mono">{emergencyCase.relativePhone}</div>
              <div className="mt-2">Specialist: <strong className="text-slate-900">{emergencyCase.specialistName || 'Trauma lead'}</strong></div>
            </div>
          </section>

          {/* Telemetry */}
          <section className="bg-slate-900 text-white rounded-3xl p-5 space-y-3 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-xl font-bold flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                Live position
              </h3>
              <span className="text-xs text-slate-400 font-mono">sent {secondsSinceLastSend}s ago</span>
            </div>
            <div className="font-mono text-emerald-300 text-sm">
              {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
            </div>
            <button
              type="button"
              onClick={handleSimulateStep}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-bold cursor-pointer min-h-[48px] transition-colors"
            >
              Move one step along the route
            </button>
          </section>
        </div>
      </div>
    </PortalShell>
  );
};
