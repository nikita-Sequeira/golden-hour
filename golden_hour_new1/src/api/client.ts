import { Hospital, PatientAdmissionRecord, UserLoginLog, EmergencyCase, BedCounts } from '../types/bedlink';

export interface DatabaseStatus {
  engine: string;
  databaseFile: string;
  sizeKb: number;
  journalMode: string;
  tables: {
    hospitals: number;
    admission_records: number;
    user_logs: number;
    doctors: number;
    emergency_cases: number;
    auth_users: number;
  };
  nodeVersion: string;
  serverUptimeSec: number;
  timestamp: string;
}

export interface SqlQueryResult {
  success: boolean;
  type?: 'SELECT' | 'EXEC';
  rowCount?: number;
  changes?: number;
  executionMs?: number;
  rows?: any[];
  error?: string;
}

export interface AuthSession {
  userId: string;
  role: 'admin' | 'nurse' | 'ambulance' | 'patient';
  name: string;
  badgeId?: string;
  hospitalId?: string;
  vehicleNo?: string;
  station?: string;
  phone?: string;
  admissionId?: string;
  caseId?: string;
}

// Token storage helper with legacy cleanup
function getStoredToken(): string | null {
  try {
    // One-time cleanup of legacy token
    if (localStorage.getItem('saarthi_auth_token')) {
      const old = localStorage.getItem('saarthi_auth_token');
      localStorage.removeItem('saarthi_auth_token');
      if (old && !localStorage.getItem('golden_hour_token')) {
        localStorage.setItem('golden_hour_token', old);
      }
    }
    return localStorage.getItem('golden_hour_token');
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem('golden_hour_token', token);
    } else {
      localStorage.removeItem('golden_hour_token');
    }
    // Ensure old key is cleared
    localStorage.removeItem('saarthi_auth_token');
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

// Fetch wrapper with auth header and credentials
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export const api = {
  // Auth
  async login(credentials: any): Promise<{ token: string; user: AuthSession; admissionId?: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Authentication failed');
    }
    setStoredToken(json.token);
    return { token: json.token, user: json.user, admissionId: json.admissionId };
  },

  async getCurrentSession(): Promise<{ user: AuthSession; admission?: PatientAdmissionRecord | null } | null> {
    try {
      const res = await authFetch('/api/auth/me');
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.success || !json.user) return null;
      return { user: json.user, admission: json.admission || null };
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  // Hospitals
  async getHospitals(insuranceFilter?: string): Promise<Hospital[]> {
    const query = insuranceFilter && insuranceFilter !== 'all' ? `?insurance=${insuranceFilter}` : '';
    const res = await authFetch(`/api/hospitals${query}`);
    if (!res.ok) throw new Error('Failed to fetch hospitals from server');
    const json = await res.json();
    return json.data;
  },

  async createHospital(hosp: Partial<Hospital>): Promise<Hospital> {
    const res = await authFetch('/api/hospitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hosp),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create hospital');
    }
    const json = await res.json();
    return json.data;
  },

  async updateHospitalBeds(id: string, beds: Partial<BedCounts>): Promise<Hospital> {
    const res = await authFetch(`/api/hospitals/${id}/beds`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(beds),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update hospital beds');
    }
    const json = await res.json();
    return json.data;
  },

  // Admissions
  async getAdmissions(): Promise<PatientAdmissionRecord[]> {
    const res = await authFetch('/api/admissions');
    if (!res.ok) throw new Error('Failed to fetch admission records');
    const json = await res.json();
    return json.data;
  },

  async createAdmission(data: Partial<PatientAdmissionRecord>): Promise<PatientAdmissionRecord> {
    const res = await authFetch('/api/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record patient admission');
    }
    const json = await res.json();
    return json.data;
  },

  async dischargePatient(id: string): Promise<PatientAdmissionRecord> {
    const res = await authFetch(`/api/admissions/${id}/discharge`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to discharge patient');
    }
    const json = await res.json();
    return json.data;
  },

  // Audit Logs (Admin only)
  async getLogs(): Promise<UserLoginLog[]> {
    const res = await authFetch('/api/logs');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch user logs');
    }
    const json = await res.json();
    return json.data;
  },

  // Emergency Case - returns null ONLY on a real HTTP 404; throws on transient/network/5xx errors
  async getActiveEmergency(caseId?: string): Promise<EmergencyCase | null> {
    const q = caseId ? `?caseId=${encodeURIComponent(caseId)}` : '';
    const res = await authFetch(`/api/emergency/active${q}`);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch active emergency case');
    }
    const json = await res.json();
    return json.data;
  },

  async holdEmergencyBeds(data: {
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
  }): Promise<EmergencyCase> {
    const res = await authFetch('/api/emergency/hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to hold emergency bed');
    }
    return json.data;
  },

  async cancelHold(caseId: string): Promise<void> {
    const res = await authFetch('/api/emergency/cancel-hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to cancel bed reservation');
    }
  },

  async respondToEmergencyHold(caseId: string, decision: 'accept' | 'reject'): Promise<EmergencyCase | null> {
    const res = await authFetch('/api/emergency/respond', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId, decision }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to record hospital response');
    return json.data || null;
  },

  async advanceEmergencyStage(
    caseId: string,
    stage: number,
    street?: string,
    etaMinutes?: number,
    lat?: number,
    lng?: number
  ): Promise<EmergencyCase> {
    const res = await authFetch('/api/emergency/stage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, stage, street, etaMinutes, lat, lng }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to advance emergency stage');
    }
    return json.data;
  },

  async updateAmbulanceLocation(
    caseId: string,
    lat: number,
    lng: number,
    street?: string,
    etaMinutes?: number
  ): Promise<EmergencyCase> {
    const res = await authFetch('/api/emergency/location', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, lat, lng, street, etaMinutes }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to update vehicle location');
    }
    return json.data;
  },

  // Doctors
  async getDoctors(hospitalId?: string): Promise<any[]> {
    const q = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : '';
    const res = await authFetch(`/api/doctors${q}`);
    if (!res.ok) throw new Error('Failed to fetch doctors');
    const json = await res.json();
    return json.data;
  },

  async updateDoctorStatus(id: string, status: string, location?: string): Promise<any> {
    const res = await authFetch(`/api/doctors/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, location }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update doctor status');
    }
    const json = await res.json();
    return json.data;
  },

  // Database Management
  async getDatabaseStatus(): Promise<DatabaseStatus> {
    const res = await authFetch('/api/db/status');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch database status (Admin access required)');
    }
    const json = await res.json();
    return json.data;
  },

  async executeSqlQuery(query: string): Promise<SqlQueryResult> {
    const res = await authFetch('/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    return await res.json();
  },

  async resetDatabase(): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await authFetch('/api/db/reset', {
      method: 'POST',
    });
    return await res.json();
  },
};
