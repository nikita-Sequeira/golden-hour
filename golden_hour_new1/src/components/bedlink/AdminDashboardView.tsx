import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  Building2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Database,
  Activity,
  FileClock,
} from 'lucide-react';
import { PortalShell, ShellButton, PortalNavItem } from '../common/PortalShell';
import { PatientAdmissionRecord, UserLoginLog, Hospital } from '../../types/bedlink';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { api, DatabaseStatus, SqlQueryResult } from '../../api/client';
import { AdminAdmissionsTab } from './admin/AdminAdmissionsTab';
import { AdminAuditLogsTab } from './admin/AdminAuditLogsTab';
import { AdminHospitalsTab } from './admin/AdminHospitalsTab';
import { AdminSqlStudioTab } from './admin/AdminSqlStudioTab';
import { AdminAddHospitalModal } from './admin/AdminAddHospitalModal';
import { PatientDossierModal } from './admin/PatientDossierModal';

interface AdminDashboardViewProps {
  admissionRecords: PatientAdmissionRecord[];
  userLogs: UserLoginLog[];
  hospitals: Hospital[];
  onDischargePatient: (recordId: string) => void;
  onAddHospital: (hospital: Hospital) => void;
  language: LanguageCode;
  onRefreshData?: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  admissionRecords,
  userLogs,
  hospitals,
  onDischargePatient,
  onAddHospital,
  language,
  onRefreshData,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  const [activeTab, setActiveTab] = useState<'admissions' | 'audit' | 'hospitals' | 'sql_studio'>('admissions');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordForDossier, setSelectedRecordForDossier] = useState<PatientAdmissionRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAddHospOpen, setIsAddHospOpen] = useState(false);

  // SQL Studio State
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM admission_records ORDER BY created_at DESC LIMIT 10;');
  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDbStatus = async () => {
    try {
      const status = await api.getDatabaseStatus();
      setDbStatus(status);
    } catch (err: any) {
      console.warn('Failed to load DB status:', err.message);
    }
  };

  useEffect(() => {
    loadDbStatus();
  }, [activeTab]);

  const handleRunSql = async (queryToRun?: string) => {
    const q = queryToRun || sqlQuery;
    if (!q.trim()) return;
    setIsExecutingSql(true);
    setQueryResult(null);
    try {
      const result = await api.executeSqlQuery(q);
      setQueryResult(result);
      if (result.success) {
        showToast(`Read-only SQL executed in ${result.executionMs} ms!`);
        loadDbStatus();
        if (onRefreshData) onRefreshData();
      } else {
        showToast(`SQL Error: ${result.error || 'Execution failed'}`);
      }
    } catch (err: any) {
      setQueryResult({ success: false, error: err.message });
      showToast(`Error: ${err.message}`);
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleResetDb = async () => {
    try {
      const res = await api.resetDatabase();
      if (res.success) {
        showToast('Database reset and synced successfully.');
        loadDbStatus();
        if (onRefreshData) onRefreshData();
      } else {
        showToast(`Reset blocked: ${res.error || 'Not permitted'}`);
      }
    } catch (err: any) {
      showToast(`Reset failed: ${err.message}`);
    }
  };

  const admittedCount = admissionRecords.filter((r) => r.dischargeStatus === 'Admitted / In Care').length;
  const dischargedCount = admissionRecords.filter((r) => r.dischargeStatus === 'Discharged').length;

  const nav: PortalNavItem[] = [
    { id: 'admissions', label: t.tabAdmissions, icon: Users, badge: admissionRecords.length },
    { id: 'audit', label: t.tabAuditLogs, icon: Clock, badge: userLogs.length },
    { id: 'hospitals', label: t.tabHospitalsBeds, icon: Building2, badge: hospitals.length },
    { id: 'sql_studio', label: t.tabSqlStudio, icon: Database, badge: 'Read-only' },
  ];

  const kpis = [
    { label: 'Patient records', value: admissionRecords.length, note: 'Tracked in the database', icon: Users, chip: 'bg-violet-100 text-violet-700' },
    { label: 'Currently admitted', value: admittedCount, note: 'In care now', icon: Activity, chip: 'bg-emerald-100 text-emerald-700' },
    { label: 'Discharged', value: dischargedCount, note: 'Stabilized and released', icon: CheckCircle2, chip: 'bg-blue-100 text-blue-700' },
    { label: 'Audit entries', value: userLogs.length, note: 'Sign-in sessions logged', icon: FileClock, chip: 'bg-amber-100 text-amber-700' },
    { label: 'Hospitals', value: hospitals.length, note: 'On the Western corridor', icon: Building2, chip: 'bg-rose-100 text-rose-700' },
    { label: 'Database', value: dbStatus ? `${dbStatus.sizeKb} KB` : 'Connected', note: 'SQLite, WAL mode', icon: Database, chip: 'bg-slate-200 text-slate-700' },
  ];

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 gh-pop">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      <PortalShell
        accent="violet"
        icon={ShieldCheck}
        title={t.adminPortalTitle}
        subtitle="Western Railway grid hub"
        nav={nav}
        activeNav={activeTab}
        onNav={(id) => setActiveTab(id as typeof activeTab)}
        actions={
          <>
            <ShellButton
              onClick={() => {
                loadDbStatus();
                if (onRefreshData) onRefreshData();
                showToast('Synchronized with the backend and database.');
              }}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Sync data</span>
            </ShellButton>
            <ShellButton tone="primary" onClick={() => setIsAddHospOpen(true)}>
              <Plus className="w-4 h-4" />
              <span>Add hospital</span>
            </ShellButton>
          </>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
          {kpis.map(({ label, value, note, icon: Icon, chip }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${chip}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-500">{label}</div>
                <div className="font-display text-3xl font-extrabold text-slate-900 leading-tight tabular-nums truncate">{value}</div>
                <div className="text-xs text-slate-500 truncate">{note}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs">
          <h2 className="font-display text-2xl font-bold text-slate-900 mb-5">
            {nav.find((n) => n.id === activeTab)?.label}
          </h2>

          {activeTab === 'admissions' && (
            <AdminAdmissionsTab
              admissionRecords={admissionRecords}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onDischargePatient={onDischargePatient}
              onSelectRecord={(rec) => setSelectedRecordForDossier(rec)}
              t={t}
            />
          )}
          {activeTab === 'audit' && <AdminAuditLogsTab userLogs={userLogs} />}
          {activeTab === 'hospitals' && <AdminHospitalsTab hospitals={hospitals} t={t} />}
          {activeTab === 'sql_studio' && (
            <AdminSqlStudioTab
              dbStatus={dbStatus}
              sqlQuery={sqlQuery}
              setSqlQuery={setSqlQuery}
              queryResult={queryResult}
              isExecutingSql={isExecutingSql}
              onRunSql={handleRunSql}
              onResetDb={handleResetDb}
            />
          )}
        </div>
      </PortalShell>

      <AdminAddHospitalModal
        isOpen={isAddHospOpen}
        onClose={() => setIsAddHospOpen(false)}
        onAddHospital={onAddHospital}
      />

      <PatientDossierModal record={selectedRecordForDossier} onClose={() => setSelectedRecordForDossier(null)} />
    </>
  );
};
