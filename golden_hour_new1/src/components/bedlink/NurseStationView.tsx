import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  CheckCircle2,
  Truck,
  Radio,
  Bed,
  Stethoscope,
} from 'lucide-react';
import { EmergencyCase, Hospital, BedCounts } from '../../types/bedlink';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { PortalShell, ShellButton, PortalNavItem } from '../common/PortalShell';
import { BedInventoryEditor } from './nurse/BedInventoryEditor';
import { DoctorRosterPanel } from './nurse/DoctorRosterPanel';

interface NurseStationViewProps {
  emergencyCase: EmergencyCase | null;
  language: LanguageCode;
  assignedHospitalId: string;
  hospitals: Hospital[];
  onUpdateBedCount: (
    hospitalId: string,
    type: keyof BedCounts,
    delta: number
  ) => void;
  onRespondToHold: (caseId: string, decision: 'accept' | 'reject') => Promise<EmergencyCase | null>;
}

export const NurseStationView: React.FC<NurseStationViewProps> = ({
  emergencyCase,
  language,
  assignedHospitalId,
  hospitals,
  onUpdateBedCount,
  onRespondToHold,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  // Read-only modal/expanded view for tracking ambulance
  const [showAmbulanceTracker, setShowAmbulanceTracker] = useState(false);
  const [pagedDoctorNotice, setPagedDoctorNotice] = useState<string | null>(null);
  const [section, setSection] = useState<'incoming' | 'beds' | 'doctors'>('incoming');

  // SLA countdown
  const [slaCountdown, setSlaCountdown] = useState(120);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlaCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!emergencyCase?.holdExpiresAt) return;
    const tick = () => setSlaCountdown(Math.max(0, Math.ceil((new Date(emergencyCase.holdExpiresAt!).getTime() - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [emergencyCase?.caseId, emergencyCase?.holdExpiresAt]);

  const currentHospital = hospitals.find((h) => h.id === assignedHospitalId);

  if (!currentHospital) {
    return <div className="bg-white rounded-3xl border border-amber-200 p-8 text-center space-y-2">
      <Building2 className="w-9 h-9 text-amber-600 mx-auto" />
      <h2 className="font-black text-slate-900">Hospital assignment unavailable</h2>
      <p className="text-xs text-slate-500">Your nurse account is not assigned to a currently available facility. Sign in again or ask an administrator to verify the assignment.</p>
    </div>;
  }

  const bedCounts = currentHospital.beds;

  const handlePageDoctor = (name: string) => {
    setPagedDoctorNotice(name);
    setTimeout(() => setPagedDoctorNotice(null), 4000);
  };

  const sampleDoctors = [
    {
      id: 'doc1',
      name: 'Dr. Rohan Mehta',
      status: 'AVAILABLE',
      specialty: 'Trauma & Emergency Specialist',
      dept: 'Emergency & Critical Care - MBBS, MD',
      location: 'In Emergency Triage Bay',
      activeCase: emergencyCase ? `Standby for Case #${emergencyCase.caseId}` : 'Standby for triage',
      avatar: '',
      phone: '+91 22 6767 6701',
    },
    {
      id: 'doc2',
      name: 'Dr. Anita Deshmukh',
      status: 'AVAILABLE',
      specialty: 'Vascular & Trauma Surgeon',
      dept: 'Vascular Surgery - MS, MCh (Vascular)',
      location: 'Surgical ICU Floor 2',
      activeCase: 'Available for vascular trauma',
      avatar: '',
      phone: '+91 22 6767 6702',
    },
    {
      id: 'doc3',
      name: 'Dr. Vikramaditya Rao',
      status: 'IN SURGERY',
      specialty: 'Interventional Cardiologist',
      dept: 'Cardiology & Cath Lab - MD, DM',
      location: 'Cath Lab Room 2',
      activeCase: 'In Surgery',
      avatar: '',
      phone: '+91 22 6767 6703',
    },
    {
      id: 'doc4',
      name: 'Dr. Farhan Qureshi',
      status: 'AVAILABLE',
      specialty: 'Neurosurgeon',
      dept: 'Neurosurgery - MS, MCh',
      location: 'Trauma ICU Floor 3',
      activeCase: 'Available for Neuro consult',
      avatar: '',
      phone: '+91 22 6767 6704',
    },
  ];

  const isCaseActiveOrConfirmed =
    Boolean(emergencyCase) &&
    (emergencyCase?.holdStatus === 'active' || emergencyCase?.holdStatus === 'confirmed');

  const nav: PortalNavItem[] = [
    { id: 'incoming', label: 'Incoming case', icon: Radio, alert: Boolean(emergencyCase && isCaseActiveOrConfirmed) },
    { id: 'beds', label: 'Bed inventory', icon: Bed },
    { id: 'doctors', label: 'Doctor roster', icon: Stethoscope, badge: sampleDoctors.length },
  ];

  const bedSummary: Array<{ key: keyof BedCounts; label: string }> = [
    { key: 'icu', label: 'ICU' },
    { key: 'trauma', label: 'Trauma' },
    { key: 'vent', label: 'Ventilators' },
    { key: 'oxygen', label: 'Oxygen' },
    { key: 'burns', label: 'Burns' },
    { key: 'general', label: 'General' },
  ];

  return (
    <>
      {pagedDoctorNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 gh-pop">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">Emergency alert paged to {pagedDoctorNotice}</span>
        </div>
      )}

      <PortalShell
        accent="teal"
        icon={Building2}
        title={currentHospital.name}
        subtitle={`${currentHospital.stationVicinity}`}
        status={
          emergencyCase && isCaseActiveOrConfirmed ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-300/30 text-rose-100 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              Emergency inbound
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-400/15 border border-emerald-300/30 text-emerald-100 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Triage desk clear
            </span>
          )
        }
        nav={nav}
        activeNav={section}
        onNav={(id) => setSection(id as typeof section)}
        actions={
          <a
            href={`tel:${currentHospital.phone}`}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors min-h-[48px] flex-1 lg:flex-none"
          >
            <Phone className="w-4 h-4" />
            <span>Call facility desk</span>
          </a>
        }
      >
        {/* Live bed counts, always visible */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {bedSummary.map(({ key, label }) => (
            <div key={key} className="bg-white rounded-2xl border border-slate-200 px-3.5 py-3 shadow-xs">
              <div className="text-sm font-semibold text-slate-500">{label}</div>
              <div className={`font-display text-3xl font-extrabold tabular-nums leading-tight ${bedCounts[key] === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {bedCounts[key]}
              </div>
            </div>
          ))}
        </div>

        {section === 'incoming' && (
          <div className="space-y-5">
      {/* Incoming Emergency Request Card (Scoped to this hospital) */}
      {emergencyCase && isCaseActiveOrConfirmed ? (
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-lg border border-rose-900/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-900/40 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-xs font-bold text-rose-300">
                {t.incomingEmergency}
              </span>
              <span className="text-xs font-mono text-slate-400">
                #{emergencyCase.caseId}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {emergencyCase.holdStatus === 'confirmed' ? (
                <span className="text-xs font-black font-mono text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-700">
                  Confirmed • Ambulance En Route
                </span>
              ) : (
                <>
                  <span className="text-xs text-slate-400">2-Minute Reservation Hold:</span>
                  <span className="text-base font-black font-mono text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-800">
                    {Math.floor(slaCountdown / 60)}:
                    {(slaCountdown % 60).toString().padStart(2, '0')}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-bold text-xs">
                Patient Vitals &amp; Condition
              </span>
              <div className="font-extrabold text-sm text-white">
                {emergencyCase.patientName}
                {!emergencyCase.isQuickIntake && emergencyCase.age !== null && emergencyCase.age !== undefined && emergencyCase.gender ? ` (${emergencyCase.age}y • ${emergencyCase.gender})` : ''}
              </div>
              <div className="text-rose-400 font-bold">{emergencyCase.injury}</div>
              <div className="text-slate-400">
                Blood Group: <strong>{emergencyCase.bloodType || "Don't know"}</strong>
              </div>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-bold text-xs">
                Reserved Bed &amp; Attendant
              </span>
              <div className="font-extrabold text-sm text-emerald-400">
                {emergencyCase.bedBay || 'Emergency Bay #01'}
              </div>
              <div className="text-slate-300">
                Contact: {emergencyCase.relativeName} ({emergencyCase.relativePhone})
              </div>
              <div className="text-slate-400 font-medium">
                Claim Mode: {emergencyCase.insuranceClaimMode || 'PM-JAY Cashless'}
              </div>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-2">
              <div>
                <span className="text-slate-400 font-bold text-xs">
                  108 Inbound Telemetry
                </span>
                <div className="font-extrabold text-sm text-white flex items-center gap-1.5 mt-0.5">
                  <Truck className="w-4 h-4 text-rose-500" />
                  <span>ETA ~{emergencyCase.etaMinutes} mins</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {emergencyCase.currentStreet}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAmbulanceTracker(!showAmbulanceTracker)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span>{showAmbulanceTracker ? 'Hide Live Telemetry' : 'View Ambulance Telemetry'}</span>
              </button>
            </div>
          </div>

          {emergencyCase.holdStatus === 'active' && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button type="button" disabled={responding} onClick={async () => { setResponding(true); try { await onRespondToHold(emergencyCase.caseId, 'accept'); } finally { setResponding(false); } }} className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-xs">
                {responding ? 'Saving response…' : 'Accept & hold this bed'}
              </button>
              <button type="button" disabled={responding} onClick={async () => { setResponding(true); try { await onRespondToHold(emergencyCase.caseId, 'reject'); } finally { setResponding(false); } }} className="flex-1 min-h-[44px] rounded-xl bg-rose-700 hover:bg-rose-600 disabled:opacity-60 text-white font-black text-xs">
                Decline — offer next facility
              </button>
            </div>
          )}

          {/* Read-only telemetry modal / panel for Nurse */}
          {showAmbulanceTracker && (
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-rose-400" />
                  <span>Read-Only Telemetry for Vehicle {emergencyCase.vehicleNo}</span>
                </span>
                <span className="text-emerald-400 font-mono text-[11px]">
                  Stage {emergencyCase.pipelineStage} of 5
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <span className="text-xs text-slate-500 block font-bold">Pilot</span>
                  <span className="text-white font-bold">{emergencyCase.driverName}</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <span className="text-xs text-slate-500 block font-bold">Pilot Contact</span>
                  <a href={`tel:${emergencyCase.driverPhone}`} className="text-rose-400 font-mono font-bold hover:underline">
                    {emergencyCase.driverPhone}
                  </a>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl">
                  <span className="text-xs text-slate-500 block font-bold">Current Roadway</span>
                  <span className="text-slate-300 truncate block">{emergencyCase.currentStreet}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 bg-white rounded-3xl border border-dashed border-emerald-300 text-center space-y-1.5">
          <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
          <h3 className="font-extrabold text-slate-900 text-lg">No emergency inbound</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            The triage desk is clear. New commuter bed holds appear here the moment they are placed.
          </p>
        </div>
      )}

          </div>
        )}

        {section === 'beds' && (
          <BedInventoryEditor
            hospital={currentHospital}
            bedCounts={bedCounts}
            onUpdate={(type, delta) => onUpdateBedCount(currentHospital.id, type, delta)}
            t={t}
          />
        )}

        {section === 'doctors' && (
          <DoctorRosterPanel
            doctors={sampleDoctors}
            caseId={emergencyCase?.caseId || 'STANDBY'}
            onPageDoctor={handlePageDoctor}
            t={t}
          />
        )}
      </PortalShell>
    </>
  );
};
