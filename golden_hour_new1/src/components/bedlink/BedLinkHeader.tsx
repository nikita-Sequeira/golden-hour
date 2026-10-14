import React from 'react';
import { UserRole, PatientInfo, EmergencyCase } from '../../types/bedlink';
import { AuthSession } from '../../api/client';
import { Globe, LogOut } from 'lucide-react';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { GoldenHourLogo } from '../common/GoldenHourLogo';

interface BedLinkHeaderProps {
  currentRole: UserRole | null;
  authSession?: AuthSession | null;
  patientInfo: PatientInfo | null;
  activePatientTab: 'radar' | 'tracker';
  setActivePatientTab: (tab: 'radar' | 'tracker') => void;
  onLogout: () => void;
  selectedLanguage: LanguageCode;
  setSelectedLanguage: (lang: LanguageCode) => void;
  emergencyCase?: EmergencyCase | null;
  onSwitchToStaff?: () => void;
}

export const BedLinkHeader: React.FC<BedLinkHeaderProps> = ({
  currentRole,
  authSession,
  patientInfo,
  activePatientTab,
  setActivePatientTab,
  onLogout,
  selectedLanguage,
  setSelectedLanguage,
  emergencyCase,
  onSwitchToStaff,
}) => {
  const languageOptions: Array<{ code: LanguageCode; nativeLabel: string }> = [
    { code: 'English', nativeLabel: 'English' },
    { code: 'Hindi', nativeLabel: 'हिन्दी' },
    { code: 'Marathi', nativeLabel: 'मराठी' },
  ];

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.English;
  const hasActiveHold = Boolean(
    emergencyCase && (emergencyCase.holdStatus === 'active' || emergencyCase.holdStatus === 'confirmed')
  );

  const roleBg =
    currentRole === 'nurse' ? 'bg-emerald-600' : currentRole === 'ambulance' ? 'bg-blue-600' : currentRole === 'admin' ? 'bg-violet-600' : 'bg-rose-600';
  const initial = (authSession?.name || patientInfo?.patientName || currentRole || 'G').toString().trim().charAt(0).toUpperCase();

  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
      {/* Active Hold Status Ticker if patient has reserved a bed */}
      {currentRole === 'patient' && hasActiveHold && emergencyCase && (
        <div className="bg-slate-950 text-white text-xs py-2 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="text-slate-400 font-semibold">{t.reservationActive}:</span>
            <strong className="text-white truncate">
              {emergencyCase.hospitalName} ({emergencyCase.bedBay})
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setActivePatientTab('tracker')}
            aria-label="View live 108 ambulance tracker"
            className="flex items-center gap-1.5 text-rose-300 hover:text-white font-bold text-xs transition-colors cursor-pointer shrink-0 ml-2"
          >
            <span>{t.myEmergencyTracker}</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
            aria-label="Golden Hour Home"
          >
            <GoldenHourLogo size={32} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl sm:text-[1.4rem] font-extrabold text-slate-900 tracking-tight leading-none group-hover:text-rose-600 transition-colors">
                  Golden Hour
                </span>
                <span className="hidden md:inline text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Western Railway
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block leading-tight mt-0.5">
                {t.tagline}
              </p>
            </div>
          </button>
        </div>

        {/* Center Tabs for Patient View */}
        {currentRole === 'patient' && (
          <nav aria-label="Patient views" className="hidden sm:flex items-center bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActivePatientTab('radar')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activePatientTab === 'radar'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.bedAvailability}
            </button>
            <button
              type="button"
              onClick={() => setActivePatientTab('tracker')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                activePatientTab === 'tracker'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.myEmergencyTracker}
            </button>
          </nav>
        )}

        {/* Right side controls: Language switcher & Role Info */}
        <div className="flex items-center gap-3">
          {/* Trilingual Switcher with native scripts */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 hidden md:block" />
            {languageOptions.map(({ code, nativeLabel }) => (
              <button
                key={code}
                type="button"
                onClick={() => setSelectedLanguage(code)}
                aria-label={`Switch language to ${nativeLabel}`}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                  selectedLanguage === code
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                {nativeLabel}
              </button>
            ))}
          </div>

          {/* Logged in role profile or staff login switch */}
          {currentRole ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold text-white shrink-0 ${roleBg}`} aria-hidden="true">{initial}</div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {currentRole === 'patient'
                    ? patientInfo?.isUnidentified
                      ? 'Unknown patient'
                      : patientInfo?.patientName || authSession?.name || 'Patient Session'
                    : authSession?.name ||
                      (currentRole === 'nurse'
                        ? 'Hospital Nurse'
                        : currentRole === 'ambulance'
                        ? '108 Ambulance Pilot'
                        : 'Central Operations')}
                </div>
                <div className="text-[11px] text-slate-500 font-semibold">
                  {currentRole === 'patient'
                    ? t.tabPatient
                    : currentRole === 'nurse'
                    ? t.tabNurse
                    : currentRole === 'ambulance'
                    ? t.tabAmbulance
                    : t.tabAdmin}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title={t.logout}
                aria-label={t.logout}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : onSwitchToStaff ? (
            <button
              type="button"
              onClick={onSwitchToStaff}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors cursor-pointer min-h-[44px] flex items-center"
            >
              {t.staffPortalToggle}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
