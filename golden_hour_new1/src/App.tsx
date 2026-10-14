/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, Suspense } from 'react';
import {
  UserRole,
  PatientInfo,
  Hospital,
  BedCounts,
} from './types/bedlink';
import { api, AuthSession } from './api/client';
import { BedLinkHeader } from './components/bedlink/BedLinkHeader';
import { BedLinkLoginPage } from './components/bedlink/BedLinkLoginPage';
import { TRANSLATIONS, LanguageCode } from './i18n/translations';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useBackendData } from './hooks/useBackendData';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Lazy-load role views
const PatientPortalView = React.lazy(() =>
  import('./components/bedlink/PatientPortalView').then((m) => ({
    default: m.PatientPortalView,
  }))
);
const NurseStationView = React.lazy(() =>
  import('./components/bedlink/NurseStationView').then((m) => ({
    default: m.NurseStationView,
  }))
);
const AmbulanceConsoleView = React.lazy(() =>
  import('./components/bedlink/AmbulanceConsoleView').then((m) => ({
    default: m.AmbulanceConsoleView,
  }))
);
const AdminDashboardView = React.lazy(() =>
  import('./components/bedlink/AdminDashboardView').then((m) => ({
    default: m.AdminDashboardView,
  }))
);

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentAuthSession, setCurrentAuthSession] = useState<AuthSession | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('English');
  const [activePatientTab, setActivePatientTab] = useState<'radar' | 'tracker'>('radar');
  const [trackedCaseId, setTrackedCaseId] = useState<string | null>(null);

  // Patient Info State starts NULL
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.English;

  // Custom hook: data fetching, live polling, freshness tracking
  const {
    hospitals,
    admissionRecords,
    userLogs,
    emergencyCase,
    apiError,
    isRefreshing,
    isReconnecting,
    activeAdmissionId,
    setActiveAdmissionId,
    refreshBackendData,
    handleHoldBeds,
    handleCancelHold,
    handleEmergencyResponse,
    handleAdvanceStage,
    handleUpdateBedCount,
    handleDischargePatient,
    handleCreateHospital,
  } = useBackendData(currentRole, trackedCaseId);

  // Sync trackedCaseId with emergencyCase
  useEffect(() => {
    if (emergencyCase?.caseId) {
      setTrackedCaseId(emergencyCase.caseId);
    } else if (emergencyCase === null) {
      setTrackedCaseId(null);
    }
  }, [emergencyCase]);

  // Restore existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const sessionData = await api.getCurrentSession();
        if (sessionData && sessionData.user) {
          const s = sessionData.user;
          setCurrentAuthSession(s);
          setCurrentRole(s.role);

          if (s.role === 'patient') {
            const adm = sessionData.admission;
            setPatientInfo({
              patientName: adm?.patientName || s.name || 'Patient',
              relativeName: adm?.relativeName || 'Attendant',
              age: adm?.age ?? null,
              gender: (adm?.gender as PatientInfo['gender']) ?? null,
              phone: adm?.phone || s.phone || '',
              bloodType: adm?.bloodType || "Don't know",
              nearestStation: s.station || 'Andheri Station',
              useGps: false,
              isUnidentified: adm?.isUnidentified,
              isQuickEmergency: adm?.isQuickIntake,
              admissionId: adm?.id || s.admissionId,
            });
            if (adm?.id || s.admissionId) {
              setActiveAdmissionId((adm?.id || s.admissionId) ?? null);
            }
            if (adm?.caseId || s.caseId) {
              setTrackedCaseId((adm?.caseId || s.caseId) ?? null);
            }
          }
        }
      } catch {
        // Not authenticated
      }
    };
    initAuth();
  }, [setActiveAdmissionId]);

  // Handlers using the real AuthSession returned by the server
  const handleLoginAsPatient = (info: PatientInfo, sessionUser: AuthSession) => {
    setPatientInfo(info);
    setCurrentAuthSession(sessionUser);
    setCurrentRole(sessionUser.role);
    setActivePatientTab('radar');
    const resolvedAdmId = info.admissionId || sessionUser.admissionId;
    if (resolvedAdmId) {
      setActiveAdmissionId(resolvedAdmId);
    }
    refreshBackendData();
  };

  const handleLoginAsNurse = (sessionUser: AuthSession) => {
    setCurrentAuthSession(sessionUser);
    setCurrentRole(sessionUser.role);
    refreshBackendData();
  };

  const handleLoginAsAmbulance = (sessionUser: AuthSession) => {
    setCurrentAuthSession(sessionUser);
    setCurrentRole(sessionUser.role);
    refreshBackendData();
  };

  const handleLoginAsAdmin = (sessionUser: AuthSession) => {
    setCurrentAuthSession(sessionUser);
    setCurrentRole(sessionUser.role);
    refreshBackendData();
  };

  const handleDirectEmergencyLogin = async () => {
    const res = await api.login({
      role: 'patient',
      patientName: 'Unknown patient',
      relativeName: 'Emergency Attendant',
      phone: '9820100108',
      // The emergency shortcut deliberately leaves unknown demographics blank.
      age: null,
      gender: null,
      bloodType: "Don't know",
      nearestStation: 'Bandra Station',
      isUnidentified: true,
      isQuickIntake: true,
    });
    const info: PatientInfo = {
      patientName: 'Unknown patient',
      relativeName: 'Emergency Attendant',
      phone: '9820100108',
      age: null,
      gender: null,
      bloodType: "Don't know",
      nearestStation: 'Bandra Station',
      useGps: false,
      isUnidentified: true,
      isQuickEmergency: true,
      admissionId: res.admissionId || res.user.admissionId,
    };
    handleLoginAsPatient(info, res.user);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore
    }
    setCurrentRole(null);
    setCurrentAuthSession(null);
    setPatientInfo(null);
    setTrackedCaseId(null);
  };

  const handleConfirmBedReservation = async (
    hospital: Hospital,
    bay: string,
    insuranceMode: string,
    bedType: keyof BedCounts
  ): Promise<void> => {
    const caseId = emergencyCase?.caseId || 'CASE-GH-' + crypto.randomUUID();
    const admissionId =
      patientInfo?.admissionId ||
      currentAuthSession?.admissionId ||
      activeAdmissionId ||
      admissionRecords[0]?.id ||
      'PAT-INTAKE-' + crypto.randomUUID();

    const updated = await handleHoldBeds({
      caseId,
      admissionId,
      hospitalId: hospital.id,
      bedBay: bay,
      bedType,
      insuranceClaimMode: insuranceMode,
      patientName: patientInfo?.patientName,
      age: patientInfo?.age ?? undefined,
      gender: patientInfo?.gender ?? undefined,
      bloodType: patientInfo?.bloodType,
      relativeName: patientInfo?.relativeName,
      relativePhone: patientInfo?.phone,
      isQuickIntake: patientInfo?.isQuickEmergency ?? false,
    });
    if (updated?.caseId) {
      setTrackedCaseId(updated.caseId);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen gh-canvas text-slate-900 font-sans antialiased flex flex-col">
        {/* Header */}
        <BedLinkHeader
          currentRole={currentRole}
          authSession={currentAuthSession}
          patientInfo={patientInfo}
          activePatientTab={activePatientTab}
          setActivePatientTab={setActivePatientTab}
          onLogout={handleLogout}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          emergencyCase={emergencyCase}
        />

        {/* Offline / Reconnecting / Error Banner */}
        {apiError && (
          <div className="bg-rose-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs sm:text-sm font-semibold">
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>
                  {isReconnecting ? 'Reconnecting to Golden Hour emergency server…' : t.apiErrorBanner}
                </span>
              </div>
              <button
                type="button"
                onClick={() => refreshBackendData()}
                disabled={isRefreshing}
                className="px-3 py-1 bg-white text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shrink-0 min-h-[32px]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{t.retryConnection}</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area with Lazy Load Suspense */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Suspense
            fallback={
              <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-sm font-semibold">Connecting to the Golden Hour grid…</span>
              </div>
            }
          >
            {!currentRole ? (
              <BedLinkLoginPage
                onLoginAsPatient={handleLoginAsPatient}
                onLoginAsNurse={handleLoginAsNurse}
                onLoginAsAmbulance={handleLoginAsAmbulance}
                onLoginAsAdmin={handleLoginAsAdmin}
                onDirectEmergencyLogin={handleDirectEmergencyLogin}
                language={selectedLanguage}
              />
            ) : currentRole === 'patient' ? (
              patientInfo ? (
                <PatientPortalView
                  patientInfo={patientInfo}
                  hospitals={hospitals}
                  emergencyCase={emergencyCase}
                  activeTab={activePatientTab}
                  setActiveTab={setActivePatientTab}
                  onConfirmBedReservation={handleConfirmBedReservation}
                  onCancelHold={handleCancelHold}
                  language={selectedLanguage}
                />
              ) : (
                <div className="p-8 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
                  <RefreshCw className="w-6 h-6 animate-spin text-rose-600 mx-auto mb-2" />
                  <span>Loading patient profile…</span>
                </div>
              )
            ) : currentRole === 'nurse' ? (
              <NurseStationView
                emergencyCase={emergencyCase}
                language={selectedLanguage}
                assignedHospitalId={currentAuthSession?.hospitalId || ''}
                hospitals={hospitals}
                onUpdateBedCount={handleUpdateBedCount}
                onRespondToHold={handleEmergencyResponse}
              />
            ) : currentRole === 'ambulance' ? (
              <AmbulanceConsoleView
                emergencyCase={emergencyCase}
                language={selectedLanguage}
                onAdvanceStage={handleAdvanceStage}
                hospitals={hospitals}
              />
            ) : (
              <AdminDashboardView
                admissionRecords={admissionRecords}
                userLogs={userLogs}
                hospitals={hospitals}
                onDischargePatient={handleDischargePatient}
                onAddHospital={handleCreateHospital}
                language={selectedLanguage}
                onRefreshData={refreshBackendData}
              />
            )}
          </Suspense>
        </main>

        {/* Dev role switcher in dev mode only - uses real backend login sessions */}
        {import.meta.env.DEV && (
          <footer className="bg-white border-t border-slate-200 py-3.5 px-4 sm:px-6 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span>
                <span className="font-bold text-slate-800">Golden Hour Emergency Grid</span>
                <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  [DEV MODE]
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 font-medium">{t.quickTestView}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer min-h-[32px] ${
                    !currentRole ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Intake
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectEmergencyLogin().catch(console.error)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer min-h-[32px] ${
                    currentRole === 'patient' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Patient Radar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.login({
                        role: 'nurse',
                        username: 'NS-7H-104',
                        passcode: '123456',
                        hospitalId: 'hosp-sevenhills',
                      });
                      handleLoginAsNurse(res.user);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer min-h-[32px] ${
                    currentRole === 'nurse' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Nurse
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.login({
                        role: 'ambulance',
                        username: 'AMB-108-9192',
                        passcode: '9192',
                        vehicleNo: 'MH-02-ER-9192',
                      });
                      handleLoginAsAmbulance(res.user);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer min-h-[32px] ${
                    currentRole === 'ambulance' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Ambulance
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.login({
                        role: 'admin',
                        username: 'ADM-OPS-01',
                        passcode: 'admin123',
                      });
                      handleLoginAsAdmin(res.user);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer min-h-[32px] ${
                    currentRole === 'admin' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>
          </footer>
        )}
      </div>
    </ErrorBoundary>
  );
}
