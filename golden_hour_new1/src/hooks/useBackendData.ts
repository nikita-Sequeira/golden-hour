import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Hospital,
  PatientAdmissionRecord,
  UserLoginLog,
  EmergencyCase,
  UserRole,
  BedCounts,
} from '../types/bedlink';
import { api, DatabaseStatus } from '../api/client';

export function useBackendData(currentRole: UserRole | null, currentCaseId?: string | null) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [admissionRecords, setAdmissionRecords] = useState<PatientAdmissionRecord[]>([]);
  const [userLogs, setUserLogs] = useState<UserLoginLog[]>([]);
  const [emergencyCase, setEmergencyCase] = useState<EmergencyCase | null>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeAdmissionId, setActiveAdmissionId] = useState<string | null>(null);

  const failureCountRef = useRef<number>(0);
  const pollIntervalRef = useRef<number>(7000);
  const isDocumentVisibleRef = useRef<boolean>(true);

  // Recalculate hospital freshness client-side
  const computeClientFreshness = (list: Hospital[]): Hospital[] => {
    return list.map((hosp) => {
      if (!hosp.updatedAt) return hosp;
      const ts = new Date(hosp.updatedAt).getTime();
      if (isNaN(ts)) return hosp;
      const minutesAgo = Math.max(0, Math.floor((Date.now() - ts) / 60000));
      return {
        ...hosp,
        freshMinutesAgo: minutesAgo,
        isStale: minutesAgo >= 15,
      };
    });
  };

  // Full refresh of all relevant endpoints
  const refreshBackendData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const hospPromise = api.getHospitals();
      // Only fetch admissions and emergency case if authenticated; use undefined on transient error to preserve previous state
      const admPromise: Promise<PatientAdmissionRecord[] | undefined> = currentRole
        ? api.getAdmissions().catch(() => undefined)
        : Promise.resolve([] as PatientAdmissionRecord[]);
      const emerPromise: Promise<EmergencyCase | null | undefined> = currentRole
        ? api.getActiveEmergency(currentCaseId || undefined).catch(() => undefined)
        : Promise.resolve(null);
      const statusPromise: Promise<DatabaseStatus | null | undefined> =
        currentRole === 'admin'
          ? api.getDatabaseStatus().catch(() => undefined)
          : Promise.resolve(null);
      const logsPromise: Promise<UserLoginLog[] | null | undefined> =
        currentRole === 'admin'
          ? api.getLogs().catch(() => undefined)
          : Promise.resolve(null);

      const [hospData, admData, emerData, statusData, logData] = await Promise.all([
        hospPromise,
        admPromise,
        emerPromise,
        statusPromise,
        logsPromise,
      ]);

      setHospitals(computeClientFreshness(hospData));
      if (admData !== undefined) {
        setAdmissionRecords(admData);
      }
      if (emerData !== undefined) {
        setEmergencyCase(emerData);
      }
      if (statusData) {
        setDbStatus(statusData);
      }
      if (logData) {
        setUserLogs(logData);
      }

      setApiError(null);
      setIsReconnecting(false);
      failureCountRef.current = 0;
      pollIntervalRef.current = 7000;
    } catch (err: any) {
      console.warn('Backend sync error:', err);
      failureCountRef.current += 1;
      if (failureCountRef.current >= 2) {
        setIsReconnecting(true);
        // Exponential backoff
        pollIntervalRef.current = Math.min(30000, pollIntervalRef.current * 1.5);
      }
      setApiError(err.message || 'Unable to connect to Golden Hour emergency server.');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentRole, currentCaseId]);

  // Initial load
  useEffect(() => {
    refreshBackendData();
  }, [refreshBackendData]);

  // Polling with backoff, visibility pause, role-aware refreshes, and transient error protection
  useEffect(() => {
    const handleVisibilityChange = () => {
      isDocumentVisibleRef.current = !document.hidden;
      if (!document.hidden) {
        refreshBackendData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let timerId: any = null;

    const runPoll = async () => {
      if (document.hidden || !isDocumentVisibleRef.current) {
        timerId = setTimeout(runPoll, pollIntervalRef.current);
        return;
      }

      try {
        const hospPromise: Promise<Hospital[] | undefined> = api.getHospitals().catch(() => undefined);
        const emerPromise: Promise<EmergencyCase | null | undefined> = currentRole
          ? api.getActiveEmergency(currentCaseId || undefined).catch(() => undefined)
          : Promise.resolve(null);
        const admPromise: Promise<PatientAdmissionRecord[] | undefined> =
          currentRole === 'patient' || currentRole === 'nurse' || currentRole === 'admin'
            ? api.getAdmissions().catch(() => undefined)
            : Promise.resolve(undefined);
        const logsPromise: Promise<UserLoginLog[] | undefined> =
          currentRole === 'admin'
            ? api.getLogs().catch(() => undefined)
            : Promise.resolve(undefined);
        const statusPromise: Promise<DatabaseStatus | undefined> =
          currentRole === 'admin'
            ? api.getDatabaseStatus().catch(() => undefined)
            : Promise.resolve(undefined);

        const [freshHospitals, freshEmer, freshAdm, freshLogs, freshStatus] = await Promise.all([
          hospPromise,
          emerPromise,
          admPromise,
          logsPromise,
          statusPromise,
        ]);

        if (freshHospitals !== undefined) {
          setHospitals(computeClientFreshness(freshHospitals));
          setApiError(null);
          setIsReconnecting(false);
          failureCountRef.current = 0;
        } else {
          failureCountRef.current += 1;
          if (failureCountRef.current >= 2) {
            setIsReconnecting(true);
          }
        }

        // Only update emergencyCase if the call succeeded (either returning a case or null on a real 404)
        if (freshEmer !== undefined) {
          setEmergencyCase(freshEmer);
        }

        if (freshAdm !== undefined) {
          setAdmissionRecords(freshAdm);
        }

        if (freshLogs !== undefined) {
          setUserLogs(freshLogs);
        }

        if (freshStatus !== undefined) {
          setDbStatus(freshStatus);
        }
      } catch {
        failureCountRef.current += 1;
        if (failureCountRef.current >= 2) {
          setIsReconnecting(true);
        }
      }

      timerId = setTimeout(runPoll, pollIntervalRef.current);
    };

    timerId = setTimeout(runPoll, pollIntervalRef.current);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerId) clearTimeout(timerId);
    };
  }, [currentRole, currentCaseId, refreshBackendData]);

  // Recalculate isStale every 20 seconds as time passes
  useEffect(() => {
    const freshnessTimer = setInterval(() => {
      setHospitals((prev) => computeClientFreshness(prev));
    }, 20000);
    return () => clearInterval(freshnessTimer);
  }, []);

  // Mutation handlers
  const handleHoldBeds = async (data: {
    caseId: string;
    admissionId: string;
    hospitalId: string;
    bedBay: string;
    bedType: 'icu' | 'trauma' | 'vent' | 'oxygen' | 'burns' | 'general';
    insuranceClaimMode: string;
    patientName?: string;
    age?: number;
    gender?: string;
    bloodType?: string;
    relativeName?: string;
    relativePhone?: string;
    isQuickIntake?: boolean;
  }) => {
    const updatedCase = await api.holdEmergencyBeds(data);
    setEmergencyCase(updatedCase);
    await refreshBackendData();
    return updatedCase;
  };

  const handleCancelHold = async (caseId: string) => {
    await api.cancelHold(caseId);
    setEmergencyCase(null);
    await refreshBackendData();
  };

  const handleEmergencyResponse = async (caseId: string, decision: 'accept' | 'reject') => {
    const updated = await api.respondToEmergencyHold(caseId, decision);
    setEmergencyCase(updated);
    await refreshBackendData();
    return updated;
  };

  const handleAdvanceStage = async (
    caseId: string,
    stage: number,
    street?: string,
    etaMinutes?: number,
    lat?: number,
    lng?: number
  ) => {
    const updated = await api.advanceEmergencyStage(caseId, stage, street, etaMinutes, lat, lng);
    setEmergencyCase(updated);
    return updated;
  };

  const handleUpdateBedCount = async (
    hospitalId: string,
    type: keyof BedCounts,
    delta: number
  ) => {
    const hosp = hospitals.find((h) => h.id === hospitalId);
    if (!hosp) return;
    const currentCount = hosp.beds[type] || 0;
    const newCount = Math.max(0, currentCount + delta);

    const updated = await api.updateHospitalBeds(hospitalId, { [type]: newCount });
    setHospitals((prev) => prev.map((h) => (h.id === hospitalId ? updated : h)));
  };

  const handleDischargePatient = async (id: string) => {
    const updated = await api.dischargePatient(id);
    setAdmissionRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    await refreshBackendData();
  };

  const handleCreateHospital = async (data: any) => {
    const created = await api.createHospital(data);
    setHospitals((prev) => [created, ...prev]);
    return created;
  };

  return {
    hospitals,
    admissionRecords,
    userLogs,
    emergencyCase,
    dbStatus,
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
  };
}
