import React, { useState } from 'react';
import { Building2, Truck, ShieldCheck, ArrowLeft, Phone } from 'lucide-react';
import { PatientInfo } from '../../types/bedlink';
import { AuthSession } from '../../api/client';
import { AadhaarScannerModal } from './AadhaarScannerModal';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { PatientLoginForm } from './login/PatientLoginForm';
import { NurseLoginForm } from './login/NurseLoginForm';
import { AmbulanceLoginForm } from './login/AmbulanceLoginForm';
import { AdminLoginForm } from './login/AdminLoginForm';
import { EmergencyCallBar } from '../common/EmergencyCallBar';
import { WESTERN_LINE_STATIONS } from '../../data/stations';

interface BedLinkLoginPageProps {
  onLoginAsPatient: (info: PatientInfo, sessionUser: AuthSession) => void;
  onLoginAsNurse: (sessionUser: AuthSession) => void;
  onLoginAsAmbulance: (sessionUser: AuthSession) => void;
  onLoginAsAdmin: (sessionUser: AuthSession) => void;
  onDirectEmergencyLogin: () => Promise<void>;
  language: LanguageCode;
}

const LANDMARKS = [
  { id: 'churchgate', area: 'South Mumbai' },
  { id: 'dadar', area: 'Dadar' },
  { id: 'bandra', area: 'Bandra' },
  { id: 'andheri', area: 'Andheri' },
  { id: 'borivali', area: 'Borivali' },
  { id: 'virar', area: 'Vasai–Virar' },
];

export const BedLinkLoginPage: React.FC<BedLinkLoginPageProps> = ({
  onLoginAsPatient,
  onLoginAsNurse,
  onLoginAsAmbulance,
  onLoginAsAdmin,
  language,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  const [viewMode, setViewMode] = useState<'patient' | 'staff'>('patient');
  const [staffTab, setStaffTab] = useState<'nurse' | 'ambulance' | 'admin'>('nurse');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedData, setScannedData] = useState<Partial<PatientInfo> | null>(null);

  const handleAadhaarScanSuccess = (data: Partial<PatientInfo>) => {
    // Fill the form fields for user review and validation, DO NOT auto-login!
    setScannedData(data);
    setIsScannerOpen(false);
  };

  const staffTabs = [
    { id: 'nurse' as const, label: t.tabNurse, icon: Building2, on: 'text-emerald-800', ic: 'text-emerald-600' },
    { id: 'ambulance' as const, label: t.tabAmbulance, icon: Truck, on: 'text-blue-800', ic: 'text-blue-600' },
    { id: 'admin' as const, label: t.tabAdmin, icon: ShieldCheck, on: 'text-violet-800', ic: 'text-violet-600' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="grid lg:grid-cols-[5fr_7fr] rounded-[2rem] overflow-hidden shadow-xl border border-slate-200 bg-white">
        {/* Brand panel */}
        <aside className="gh-hero gh-accent-gold !rounded-none !shadow-none p-7 sm:p-10 lg:p-12 flex flex-col">
          <span className="inline-flex self-start items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amber-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Western Line emergency hospital grid
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold leading-[1.04]">
            {viewMode === 'patient' ? t.findHospitalBedNow : t.staffLoginTitle}
          </h1>
          <p className="mt-4 text-base text-slate-300 leading-relaxed max-w-md">
            {viewMode === 'patient'
              ? t.findHospitalBedNowDesc
              : 'Sign in to manage beds, dispatch and operations for the grid.'}
          </p>

          {/* The line, Churchgate to Virar */}
          <ol className="hidden lg:block mt-auto pt-10">
            {LANDMARKS.map((l, i) => {
              const st = WESTERN_LINE_STATIONS.find((s) => s.id === l.id);
              return (
                <li key={l.id} className="relative pl-8 pb-6 last:pb-0">
                  {i < LANDMARKS.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-white/20" />}
                  <span className="absolute left-0 top-1 w-4 h-4 rounded-full bg-[#0f2c35] border-2 border-amber-400" />
                  <div className="text-sm font-bold text-white leading-5">{st?.name.replace(' Station', '')}</div>
                  <div className="text-xs text-slate-400">{l.area}</div>
                </li>
              );
            })}
          </ol>
          <p className="hidden lg:block mt-6 text-xs text-slate-400">
            {WESTERN_LINE_STATIONS.length} stations covered, Churchgate to Virar.
          </p>

          <a
            href="tel:108"
            className="mt-8 lg:mt-6 inline-flex self-start items-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm min-h-[48px] transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span>{t.call108Action}</span>
          </a>
        </aside>

        {/* Form panel */}
        <section className="p-6 sm:p-10 lg:p-12 bg-white">
          {viewMode === 'patient' ? (
            <PatientLoginForm
              onLogin={onLoginAsPatient}
              onOpenScanner={() => setIsScannerOpen(true)}
              scannedData={scannedData}
              t={t}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
                {staffTabs.map(({ id, label, icon: Icon, on, ic }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStaffTab(id)}
                    aria-pressed={staffTab === id}
                    className={`py-3 px-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px] ${
                      staffTab === id ? `bg-white shadow-sm ${on}` : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${ic}`} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {staffTab === 'nurse' && <NurseLoginForm onLoginSuccess={onLoginAsNurse} t={t} />}
              {staffTab === 'ambulance' && <AmbulanceLoginForm onLoginSuccess={onLoginAsAmbulance} t={t} />}
              {staffTab === 'admin' && <AdminLoginForm onLoginSuccess={onLoginAsAdmin} t={t} />}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 flex justify-center">
            {viewMode === 'patient' ? (
              <button
                type="button"
                onClick={() => setViewMode('staff')}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer min-h-[44px] inline-flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t.staffPortalToggle}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode('patient')}
                className="text-sm font-semibold text-rose-600 hover:text-rose-700 cursor-pointer min-h-[44px] inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.backToPatientSearch}</span>
              </button>
            )}
          </div>
        </section>
      </div>

      <EmergencyCallBar t={t} showDisclaimer={true} />

      <AadhaarScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleAadhaarScanSuccess}
        language={language}
      />
    </div>
  );
};
