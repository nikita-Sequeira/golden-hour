import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, initDatabase, releaseExpiredHolds } from './db';
import { requireAuth, requireRole, signToken, verifyPassword } from './auth';
import {
  LoginSchema,
  BedCountUpdateSchema,
  EmergencyHoldSchema,
  CancelHoldSchema,
  EmergencyResponseSchema,
  EmergencyStageSchema,
  EmergencyLocationSchema,
  CreateAdmissionSchema,
  CreateHospitalSchema,
  DoctorStatusUpdateSchema,
} from './validators';
import fs from 'fs';
import path from 'path';

export const apiRouter = Router();

// Safe JSON parser helper
function safeJsonParse<T>(raw: any, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Dynamic time ago string from ISO date
export function computeTimeAgo(isoString: string): string {
  const timestamp = new Date(isoString).getTime();
  if (isNaN(timestamp)) return 'Recently';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Compute minutes since last update
export function computeFreshMinutesAgo(isoString: string): number {
  const timestamp = new Date(isoString).getTime();
  if (isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

const BED_COLUMN_MAP: Record<string, string> = {
  icu: 'icu_beds',
  trauma: 'trauma_beds',
  vent: 'vent_beds',
  oxygen: 'oxygen_beds',
  burns: 'burns_beds',
  general: 'general_beds',
};

function doesPatientOwnCase(row: any, userId: string): boolean {
  if (!row || !userId) return false;
  if (row.user_id === userId) return true;
  if (row.admission_id) {
    const adm = db
      .prepare('SELECT user_id FROM admission_records WHERE id = ?')
      .get(row.admission_id) as any;
    if (adm && adm.user_id === userId) return true;
  }
  return false;
}

// Formatters
function formatHospital(row: any) {
  const freshMinutesAgo = computeFreshMinutesAgo(row.updated_at);
  const isStale = freshMinutesAgo >= 15;

  return {
    id: row.id,
    name: row.name,
    zone: row.zone || 'Andheri - Jogeshwari',
    nearestStationId: row.nearest_station_id || 'andheri',
    stationVicinity: row.station_vicinity,
    address: row.address || '',
    distanceKm: row.distance_km,
    lat: Number(row.lat) || 19.1197,
    lng: Number(row.lng) || 72.8464,
    phone: row.phone,
    isGovernment: Boolean(row.is_government),
    has24x7Emergency: Boolean(row.has_24x7_emergency),
    beds: {
      icu: row.icu_beds,
      trauma: row.trauma_beds,
      vent: row.vent_beds,
      oxygen: row.oxygen_beds,
      burns: row.burns_beds,
      general: row.general_beds,
    },
    bloodStock: safeJsonParse<Record<string, number>>(row.blood_stock_json, {}),
    specialists: safeJsonParse<string[]>(row.specialists_json, []),
    cashlessPMJAY: Boolean(row.cashless_pmjay),
    acceptsInsurance: Boolean(row.accepts_insurance),
    insuranceProviders: safeJsonParse<string[]>(row.insurance_providers_json, []),
    tpaDeskPhone: row.tpa_desk_phone || '',
    capacityPercent: row.capacity_percent,
    freshMinutesAgo,
    isStale,
    isRecommended: Boolean(row.is_recommended),
    imageUrl: row.image_url || '',
    updatedAt: row.updated_at,
  };
}

function formatAdmission(row: any) {
  return {
    id: row.id,
    userId: row.user_id || null,
    caseId: row.case_id || null,
    patientName: row.patient_name,
    age: row.is_quick_intake ? null : row.age,
    gender: row.is_quick_intake ? null : row.gender,
    bloodType: row.blood_type,
    phone: row.phone,
    relativeName: row.relative_name,
    loginIntakeTime: row.login_intake_time,
    intakeAgo: computeTimeAgo(row.login_intake_time),
    confirmedHospital: row.confirmed_hospital,
    confirmedBay: row.confirmed_bay || '',
    confirmationTime: row.confirmation_time || 'Awaiting response',
    confirmationAgo: row.confirmation_time ? computeTimeAgo(row.confirmation_time) : '',
    dischargeStatus: row.discharge_status,
    dischargeTime: row.discharge_time || undefined,
    notes: row.notes || '',
    insuranceType: row.insurance_type || 'PM-JAY / Cashless In Review',
    isUnidentified: Boolean(row.is_unidentified),
    isQuickIntake: Boolean(row.is_quick_intake),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatLog(row: any) {
  return {
    id: row.id,
    userAndContact: row.user_and_contact,
    role: row.role,
    facilityOrStation: row.facility_or_station,
    loginTimestamp: row.login_timestamp,
    timeAgo: computeTimeAgo(row.login_timestamp),
    sessionStatus: row.session_status,
    ipOrigin: row.ip_origin,
  };
}

function formatEmergencyCase(row: any) {
  return {
    caseId: row.case_id,
    admissionId: row.admission_id || null,
    userId: row.user_id || null,
    patientName: row.patient_name,
    age: row.is_quick_intake ? null : row.age,
    gender: row.is_quick_intake ? null : row.gender,
    relativeName: row.relative_name,
    relativePhone: row.relative_phone,
    bloodType: row.blood_type,
    injury: row.injury,
    location: row.location,
    hospitalId: row.hospital_id || null,
    hospitalName: row.hospital_name,
    hospitalPhone: row.hospital_phone,
    bedBay: row.bed_bay,
    bedType: row.bed_type || 'icu',
    specialistName: row.specialist_name,
    vehicleNo: row.vehicle_no,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    etaMinutes: row.eta_minutes,
    currentStreet: row.current_street,
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : null,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : null,
    targetLocation: row.target_location,
    pipelineStage: row.pipeline_stage,
    insuranceClaimMode: row.insurance_claim_mode,
    holdExpiresAt: row.hold_expires_at || null,
    holdStatus: row.hold_status || 'active',
    isQuickIntake: Boolean(row.is_quick_intake),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatDoctor(row: any) {
  return {
    id: row.id,
    hospitalId: row.hospital_id,
    name: row.name,
    status: row.status,
    specialty: row.specialty,
    dept: row.dept,
    location: row.location,
    activeCase: row.active_case,
    avatar: row.avatar,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* =========================================================================
   1. AUTHENTICATION (Login, Session, Logout)
   ========================================================================= */

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid credentials payload',
      });
    }

    const data = parseResult.data;
    const nowIso = new Date().toISOString();
    const clientIp = req.ip || '127.0.0.1';

    let userSession: any = null;
    let initialAdmissionId: string | null = null;

    if (data.role === 'admin' || data.role === 'nurse' || data.role === 'ambulance') {
      const userRow = db
        .prepare('SELECT * FROM auth_users WHERE username = ? AND role = ?')
        .get(data.username, data.role) as any;

      if (!userRow) {
        return res.status(401).json({ success: false, error: 'Invalid identifier or passcode.' });
      }

      const isValid = verifyPassword(data.passcode, userRow.password_hash, userRow.password_salt);
      if (!isValid) {
        return res.status(401).json({ success: false, error: 'Invalid identifier or passcode.' });
      }

      if (data.role === 'nurse') {
        if (data.hospitalId && data.hospitalId !== userRow.hospital_id) {
          return res.status(403).json({
            success: false,
            error: `Forbidden: Nurse account '${userRow.username}' is assigned to '${userRow.hospital_id}', not '${data.hospitalId}'.`,
          });
        }
      }

      if (data.role === 'ambulance') {
        if (data.vehicleNo && data.vehicleNo !== userRow.vehicle_no) {
          return res.status(403).json({
            success: false,
            error: `Forbidden: Ambulance badge '${userRow.username}' is assigned to vehicle '${userRow.vehicle_no}', not '${data.vehicleNo}'.`,
          });
        }
      }

      userSession = {
        userId: userRow.id,
        role: userRow.role,
        name: userRow.name,
        badgeId: userRow.username,
        hospitalId: userRow.hospital_id || undefined,
        vehicleNo: userRow.vehicle_no || undefined,
      };

      // Record in audit log
      const logStmt = db.prepare(`
        INSERT INTO user_logs (id, user_and_contact, role, facility_or_station, login_timestamp, session_status, ip_origin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      logStmt.run(
        'LOG-' + crypto.randomUUID(),
        `${userRow.name}\n${userRow.phone || ''}`,
        userRow.role.toUpperCase(),
        userRow.hospital_id
          ? `Hospital: ${userRow.hospital_id}`
          : userRow.vehicle_no
          ? `Unit: ${userRow.vehicle_no}`
          : 'Central Operations',
        nowIso,
        'Active Session',
        clientIp,
        nowIso
      );
    } else if (data.role === 'patient') {
      // Patient single-step authentication + de-duplicated intake admission creation
      const patientId = 'PAT-' + crypto.randomUUID();
      const admissionId = 'PAT-INTAKE-' + crypto.randomUUID();
      initialAdmissionId = admissionId;

      const isUnidentified = Boolean(data.isUnidentified || data.patientName === 'Unknown patient');
      const patientDisplayName = isUnidentified ? 'Unknown patient' : data.patientName;

      userSession = {
        userId: patientId,
        role: 'patient',
        name: patientDisplayName,
        station: data.nearestStation,
        phone: data.phone,
        admissionId,
      };

      // Create admission record exactly once
      const admStmt = db.prepare(`
        INSERT INTO admission_records (
          id, user_id, case_id, patient_name, age, gender, blood_type, phone, relative_name,
          login_intake_time, confirmed_hospital, confirmed_bay,
          confirmation_time, discharge_status, notes, insurance_type, is_unidentified, is_quick_intake, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      admStmt.run(
        admissionId,
        patientId,
        null,
        patientDisplayName,
        data.isQuickIntake ? 0 : data.age ?? 0,
        data.isQuickIntake ? 'Not disclosed' : data.gender ?? 'Not disclosed',
        data.bloodType,
        data.phone,
        data.relativeName,
        nowIso,
        'Pending Facility Hold',
        '',
        '',
        'Pending Facility Hold',
        `Emergency intake from ${data.nearestStation}`,
        'PM-JAY / Cashless In Review',
        isUnidentified ? 1 : 0,
        data.isQuickIntake ? 1 : 0,
        nowIso,
        nowIso
      );

      // Audit log entry
      const logStmt = db.prepare(`
        INSERT INTO user_logs (id, user_and_contact, role, facility_or_station, login_timestamp, session_status, ip_origin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      logStmt.run(
        'LOG-' + crypto.randomUUID(),
        `${patientDisplayName} (Contact: ${data.relativeName})\n${data.phone}`,
        'PATIENT / ATTENDANT',
        `${data.nearestStation} Corridor`,
        nowIso,
        'Active Session',
        clientIp,
        nowIso
      );
    }

    const token = signToken(userSession);

    // Set secure httpOnly cookie with Golden Hour name
    res.cookie('golden_hour_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.clearCookie('saarthi_session');

    return res.json({
      success: true,
      token,
      user: userSession,
      admissionId: initialAdmissionId,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Authentication failed' });
  }
});

apiRouter.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;

  // If patient, fetch their current active admission record
  let currentAdmission = null;
  if (user.role === 'patient') {
    currentAdmission = db
      .prepare('SELECT * FROM admission_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(user.userId);
  }

  return res.json({
    success: true,
    user,
    admission: currentAdmission ? formatAdmission(currentAdmission) : null,
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('golden_hour_session');
  res.clearCookie('saarthi_session');
  return res.json({ success: true, message: 'Logged out successfully' });
});

/* =========================================================================
   2. HOSPITALS & BEDS
   ========================================================================= */

// Public endpoint - stripped of PII, returns facility data only
apiRouter.get('/hospitals', (req: Request, res: Response) => {
  try {
    releaseExpiredHolds();

    const { insurance } = req.query;
    let query = 'SELECT * FROM hospitals';
    const params: any[] = [];

    if (insurance === 'insurance_only') {
      query += ' WHERE accepts_insurance = 1';
    } else if (insurance === 'cash_only') {
      query += ' WHERE accepts_insurance = 0';
    }

    query += ' ORDER BY distance_km ASC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    const hospitals = rows.map(formatHospital);

    return res.json({ success: true, count: hospitals.length, data: hospitals });
  } catch (err: any) {
    console.error('Error fetching hospitals:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/hospitals', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const parseResult = CreateHospitalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid hospital data',
      });
    }

    const h = parseResult.data;
    const id = h.id || 'hosp-' + crypto.randomUUID().slice(0, 8);
    const nowIso = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM hospitals WHERE id = ?').get(id);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Hospital with id '${id}' already exists.`,
      });
    }

    const stmt = db.prepare(`
      INSERT INTO hospitals (
        id, name, zone, nearest_station_id, station_vicinity, address, distance_km, lat, lng, phone,
        is_government, has_24x7_emergency,
        icu_beds, trauma_beds, vent_beds, oxygen_beds, burns_beds, general_beds,
        blood_stock_json, specialists_json, cashless_pmjay, accepts_insurance,
        insurance_providers_json, tpa_desk_phone, capacity_percent,
        is_recommended, image_url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      h.name,
      h.zone,
      h.nearestStationId,
      h.stationVicinity,
      h.address,
      Number(h.distanceKm) || 1.5,
      Number(h.lat) || 19.1197,
      Number(h.lng) || 72.8464,
      h.phone,
      h.isGovernment ? 1 : 0,
      h.has24x7Emergency ? 1 : 0,
      Math.max(0, Number(h.beds?.icu) || 0),
      Math.max(0, Number(h.beds?.trauma) || 0),
      Math.max(0, Number(h.beds?.vent) || 0),
      Math.max(0, Number(h.beds?.oxygen) || 0),
      Math.max(0, Number(h.beds?.burns) || 0),
      Math.max(0, Number(h.beds?.general) || 0),
      JSON.stringify(h.bloodStock || { 'O+': 10, 'A+': 5 }),
      JSON.stringify(h.specialists || ['Dr. Emergency Medical Officer']),
      h.cashlessPMJAY ? 1 : 0,
      h.acceptsInsurance ? 1 : 0,
      JSON.stringify(h.insuranceProviders || ['PM-JAY']),
      h.tpaDeskPhone || '',
      Math.max(0, Math.min(100, Number(h.capacityPercent) || 50)),
      h.isRecommended ? 1 : 0,
      h.imageUrl || '',
      nowIso
    );

    const created = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(id);
    return res.status(201).json({ success: true, data: formatHospital(created) });
  } catch (err: any) {
    console.error('Error creating hospital:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/hospitals/:id/beds', requireRole('nurse', 'admin'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Nurse may only modify their assigned hospital
    if (user.role === 'nurse' && (!user.hospitalId || user.hospitalId !== id)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Nurses can only update bed inventory for their assigned facility (${user.hospitalId}).`,
      });
    }

    const parseResult = BedCountUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.issues[0]?.message || 'Invalid bed counts' });
    }

    const { icu, trauma, vent, oxygen, burns, general } = parseResult.data;
    const nowIso = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Hospital not found.' });
    }

    const stmt = db.prepare(`
      UPDATE hospitals SET
        icu_beds = COALESCE(?, icu_beds),
        trauma_beds = COALESCE(?, trauma_beds),
        vent_beds = COALESCE(?, vent_beds),
        oxygen_beds = COALESCE(?, oxygen_beds),
        burns_beds = COALESCE(?, burns_beds),
        general_beds = COALESCE(?, general_beds),
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      icu !== undefined ? icu : null,
      trauma !== undefined ? trauma : null,
      vent !== undefined ? vent : null,
      oxygen !== undefined ? oxygen : null,
      burns !== undefined ? burns : null,
      general !== undefined ? general : null,
      nowIso,
      id
    );

    const updated = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(id);
    return res.json({ success: true, data: formatHospital(updated) });
  } catch (err: any) {
    console.error('Error updating hospital beds:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   3. ADMISSIONS & DISCHARGE (Scoped with Authentication)
   ========================================================================= */

apiRouter.get('/admissions', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query = 'SELECT * FROM admission_records';
    const params: any[] = [];

    if (user.role === 'patient') {
      // Patient sees only their own record
      query += ' WHERE user_id = ?';
      params.push(user.userId);
    } else if (user.role === 'nurse') {
      // Nurse sees records associated with their hospital
      if (user.hospitalId) {
        const hosp = db.prepare('SELECT name FROM hospitals WHERE id = ?').get(user.hospitalId) as any;
        if (hosp) {
          query += ' WHERE confirmed_hospital = ?';
          params.push(hosp.name);
        } else {
          return res.json({ success: true, count: 0, data: [] });
        }
      } else {
        return res.json({ success: true, count: 0, data: [] });
      }
    }
    // Admin sees all

    query += ' ORDER BY created_at DESC';
    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    const admissions = rows.map(formatAdmission);
    return res.json({ success: true, count: admissions.length, data: admissions });
  } catch (err: any) {
    console.error('Error fetching admissions:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/admissions', requireAuth, (req: Request, res: Response) => {
  try {
    const parseResult = CreateAdmissionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid admission data',
      });
    }

    const a = parseResult.data;
    const user = (req as any).user;
    const id = 'PAT-INTAKE-' + crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO admission_records (
        id, user_id, case_id, patient_name, age, gender, blood_type, phone, relative_name,
        login_intake_time, confirmed_hospital, confirmed_bay,
          confirmation_time, discharge_status, notes, insurance_type, is_unidentified, is_quick_intake, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      user.userId || null,
      a.caseId || null,
      a.patientName,
      a.age,
      a.gender,
      a.bloodType,
      a.phone,
      a.relativeName,
      nowIso,
      'Pending Facility Hold',
      '',
      '',
      'Pending Facility Hold',
      a.notes || 'Emergency intake from Western Line sector',
      a.insuranceType || 'PM-JAY / Cashless In Review',
      a.isUnidentified ? 1 : 0,
        0,
      nowIso,
      nowIso
    );

    const created = db.prepare('SELECT * FROM admission_records WHERE id = ?').get(id);
    return res.status(201).json({ success: true, data: formatAdmission(created) });
  } catch (err: any) {
    console.error('Error registering patient admission:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/admissions/:id/discharge', requireRole('nurse', 'admin'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const nowIso = new Date().toISOString();

    const existingAdm = db.prepare('SELECT * FROM admission_records WHERE id = ?').get(id) as any;
    if (!existingAdm) {
      return res.status(404).json({ success: false, error: 'Admission record not found.' });
    }

    if (user.role === 'nurse') {
      const nurseHosp = user.hospitalId
        ? (db.prepare('SELECT * FROM hospitals WHERE id = ?').get(user.hospitalId) as any)
        : null;
      if (!nurseHosp || existingAdm.confirmed_hospital !== nurseHosp.name) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Nurses may only discharge admissions belonging to their assigned hospital.',
        });
      }
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare(`
        UPDATE admission_records SET
          discharge_status = 'Discharged',
          discharge_time = ?,
          notes = 'Patient stabilized and formally discharged by attending team.',
          updated_at = ?
        WHERE id = ?
      `).run(nowIso, nowIso, id);

      // Find any active/confirmed emergency cases linked to this admission and release held beds + mark completed
      const linkedCases = db
        .prepare(`
          SELECT * FROM emergency_cases
          WHERE (admission_id = ? OR (? != '' AND case_id = ?))
            AND hold_status IN ('active', 'confirmed')
        `)
        .all(id, existingAdm.case_id || '', existingAdm.case_id || '') as any[];

      for (const c of linkedCases) {
        if (c.hospital_id && c.bed_type) {
          const col = BED_COLUMN_MAP[c.bed_type] || 'icu_beds';
          db.prepare(`UPDATE hospitals SET ${col} = ${col} + 1, updated_at = ? WHERE id = ?`).run(
            nowIso,
            c.hospital_id
          );
        }
        db.prepare(`
          UPDATE emergency_cases SET
            hold_status = 'completed',
            hold_expires_at = NULL,
            updated_at = ?
          WHERE case_id = ?
        `).run(nowIso, c.case_id);
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    const updated = db.prepare('SELECT * FROM admission_records WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Patient successfully discharged.', data: formatAdmission(updated) });
  } catch (err: any) {
    console.error('Error discharging patient:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   4. USER ACCESS LOGS (Admin only)
   ========================================================================= */

apiRouter.get('/logs', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM user_logs ORDER BY created_at DESC LIMIT 100');
    const rows = stmt.all();
    const logs = rows.map(formatLog);
    return res.json({ success: true, count: logs.length, data: logs });
  } catch (err: any) {
    console.error('Error fetching logs:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   5. EMERGENCY CASES & ATOMIC BED HOLD TRANSACTION WITH EXPIRATION
   ========================================================================= */

// GET /api/emergency/active - Role-scoped with strict IDOR checks
apiRouter.get('/emergency/active', requireAuth, (req: Request, res: Response) => {
  try {
    releaseExpiredHolds();

    const user = (req as any).user;
    const caseId = typeof req.query.caseId === 'string' && req.query.caseId.trim() ? req.query.caseId.trim() : undefined;

    let row: any = null;

    if (caseId) {
      const candidate = db
        .prepare("SELECT * FROM emergency_cases WHERE case_id = ? AND hold_status IN ('active', 'confirmed')")
        .get(caseId) as any;
      if (!candidate) {
        return res.status(404).json({ success: false, error: 'No active emergency case found.' });
      }

      if (user.role === 'patient') {
        if (doesPatientOwnCase(candidate, user.userId)) {
          row = candidate;
        }
      } else if (user.role === 'nurse') {
        if (user.hospitalId && candidate.hospital_id === user.hospitalId) {
          row = candidate;
        }
      } else if (user.role === 'ambulance') {
        if (user.vehicleNo && candidate.vehicle_no === user.vehicleNo) {
          row = candidate;
        }
      } else if (user.role === 'admin') {
        row = candidate;
      }
    } else if (user.role === 'patient') {
      row = db
        .prepare(`
          SELECT * FROM emergency_cases
          WHERE (user_id = ? OR admission_id IN (SELECT id FROM admission_records WHERE user_id = ?))
            AND hold_status IN ('active', 'confirmed')
          ORDER BY updated_at DESC LIMIT 1
        `)
        .get(user.userId, user.userId);
    } else if (user.role === 'nurse') {
      if (user.hospitalId) {
        row = db
          .prepare(`
            SELECT * FROM emergency_cases
            WHERE hospital_id = ? AND hold_status IN ('active', 'confirmed')
            ORDER BY updated_at DESC LIMIT 1
          `)
          .get(user.hospitalId);
      }
    } else if (user.role === 'ambulance') {
      if (user.vehicleNo) {
        row = db
          .prepare(`
            SELECT * FROM emergency_cases
            WHERE vehicle_no = ? AND hold_status IN ('active', 'confirmed')
            ORDER BY updated_at DESC LIMIT 1
          `)
          .get(user.vehicleNo);
      }
    } else if (user.role === 'admin') {
      row = db
        .prepare(`
          SELECT * FROM emergency_cases
          WHERE hold_status IN ('active', 'confirmed')
          ORDER BY updated_at DESC LIMIT 1
        `)
        .get();
    }

    if (!row) {
      return res.status(404).json({ success: false, error: 'No active emergency case found.' });
    }

    return res.json({ success: true, data: formatEmergencyCase(row) });
  } catch (err: any) {
    console.error('Error fetching active case:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/emergency/hold - Atomic SQL Transaction with 2-minute expiration & previous-hold restoration
apiRouter.post('/emergency/hold', requireRole('patient', 'admin'), (req: Request, res: Response) => {
  try {
    releaseExpiredHolds();

    const user = (req as any).user;
    const parseResult = EmergencyHoldSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid hold request payload',
      });
    }

    const {
      caseId,
      admissionId,
      hospitalId,
      bedBay,
      bedType,
      insuranceClaimMode,
      patientName,
      age,
      gender,
      bloodType,
      relativeName,
      relativePhone,
      isQuickIntake,
    } = parseResult.data;

    const bedCol = BED_COLUMN_MAP[bedType] || 'icu_beds';
    const nowIso = new Date().toISOString();
    // 2-minute hold expiration timestamp
    const holdExpiresAt = new Date(Date.now() + 120 * 1000).toISOString();

    // Atomic transaction
    db.exec('BEGIN IMMEDIATE;');
    try {
      // 1. Verify admissionId exists and belongs to the logged-in patient (if role === 'patient')
      const admRow = db.prepare('SELECT * FROM admission_records WHERE id = ?').get(admissionId) as any;
      if (!admRow) {
        db.exec('ROLLBACK;');
        return res.status(404).json({ success: false, error: 'Admission record not found.' });
      }
      if (user.role === 'patient' && admRow.user_id !== user.userId) {
        db.exec('ROLLBACK;');
        return res.status(403).json({
          success: false,
          error: 'Forbidden: admissionId does not belong to the logged-in patient.',
        });
      }

      // 2. Check if caseId already exists and verify ownership + restore previously held bed if active/confirmed
      const existingCase = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId) as any;
      if (existingCase) {
        if (user.role === 'patient' && !doesPatientOwnCase(existingCase, user.userId)) {
          db.exec('ROLLBACK;');
          return res.status(403).json({
            success: false,
            error: 'Forbidden: This emergency case belongs to another patient.',
          });
        }

        if (
          (existingCase.hold_status === 'active' || existingCase.hold_status === 'confirmed') &&
          existingCase.hospital_id &&
          existingCase.bed_type
        ) {
          const oldCol = BED_COLUMN_MAP[existingCase.bed_type] || 'icu_beds';
          db.prepare(`UPDATE hospitals SET ${oldCol} = ${oldCol} + 1, updated_at = ? WHERE id = ?`).run(
            nowIso,
            existingCase.hospital_id
          );
        }
      }

      // 3. Verify hospital exists and bed is available
      const hosp = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospitalId) as any;
      if (!hosp) {
        db.exec('ROLLBACK;');
        return res.status(404).json({ success: false, error: 'Hospital not found.' });
      }

      const availableCount = Number(hosp[bedCol]) || 0;
      if (availableCount <= 0) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          success: false,
          error: `No ${bedType.toUpperCase()} beds available at ${hosp.name}. Please select another facility.`,
        });
      }

      // 4. Decrement bed count on target hospital
      db.prepare(`UPDATE hospitals SET ${bedCol} = ${bedCol} - 1, updated_at = ? WHERE id = ?`).run(
        nowIso,
        hospitalId
      );

      // 5. Upsert emergency case
      if (existingCase) {
        const updateCaseStmt = db.prepare(`
          UPDATE emergency_cases SET
            admission_id = COALESCE(?, admission_id),
            user_id = COALESCE(?, user_id),
            hospital_id = ?,
            hospital_name = ?,
            hospital_phone = ?,
            bed_bay = ?,
            bed_type = ?,
            insurance_claim_mode = ?,
            patient_name = COALESCE(?, patient_name),
            age = COALESCE(?, age),
            gender = COALESCE(?, gender),
            blood_type = COALESCE(?, blood_type),
            relative_name = COALESCE(?, relative_name),
            relative_phone = COALESCE(?, relative_phone),
            is_quick_intake = ?,
            hold_expires_at = ?,
            hold_status = 'active',
            updated_at = ?
          WHERE case_id = ?
        `);
        updateCaseStmt.run(
          admissionId,
          user.userId || null,
          hospitalId,
          hosp.name,
          hosp.phone,
          bedBay,
          bedType,
          insuranceClaimMode,
          patientName || null,
          age !== undefined ? age : null,
          gender || null,
          bloodType || null,
          relativeName || null,
          relativePhone || null,
            isQuickIntake ? 1 : Boolean(admRow.is_quick_intake) ? 1 : 0,
          holdExpiresAt,
          nowIso,
          caseId
        );
      } else {
        const insertCaseStmt = db.prepare(`
          INSERT INTO emergency_cases (
            case_id, admission_id, user_id, patient_name, age, gender, relative_name, relative_phone,
            blood_type, injury, location, hospital_id, hospital_name, hospital_phone, bed_bay, bed_type,
            specialist_name, vehicle_no, driver_name, driver_phone, eta_minutes,
            current_street, lat, lng, target_location, pipeline_stage, insurance_claim_mode,
            hold_expires_at, hold_status, is_quick_intake, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertCaseStmt.run(
          caseId,
          admissionId,
          user.userId || admRow.user_id || null,
          patientName || admRow.patient_name || user.name || 'Emergency Patient',
          isQuickIntake ? 0 : age !== undefined ? age : admRow.age,
          isQuickIntake ? 'Not disclosed' : gender ?? admRow.gender,
          relativeName || admRow.relative_name || 'Attendant',
          relativePhone || admRow.phone || '+91 98201 00000',
          bloodType || admRow.blood_type || "Don't know",
          'Acute emergency condition requiring rapid admission',
          `Near ${user.station || 'Western Line'} Sector`,
          hospitalId,
          hosp.name,
          hosp.phone,
          bedBay,
          bedType,
          safeJsonParse<string[]>(hosp.specialists_json, ['Trauma Lead'])[0] || 'Trauma Lead',
          'MH-02-ER-9192',
          'Ramesh Sawant (ALS Pilot)',
          '+91 98700 11223',
          4,
          `En route to ${hosp.name} emergency ramp`,
          hosp.lat || 19.1197,
          hosp.lng || 72.8464,
          `${hosp.name} Emergency Bay`,
          1,
          insuranceClaimMode,
          holdExpiresAt,
          'active',
          isQuickIntake ? 1 : Boolean(admRow.is_quick_intake) ? 1 : 0,
          nowIso,
          nowIso
        );
      }

      // 6. Update the admission record
      const updateAdmStmt = db.prepare(`
        UPDATE admission_records SET
          case_id = ?,
          confirmed_hospital = ?,
          confirmed_bay = ?,
          confirmation_time = ?,
          discharge_status = 'Admitted / In Care',
          notes = ?,
          insurance_type = ?,
          updated_at = ?
        WHERE id = ?
      `);
      updateAdmStmt.run(
        caseId,
        hosp.name,
        bedBay,
        nowIso,
        `Bed locked via Golden Hour (${hosp.name}) - ${insuranceClaimMode}`,
        insuranceClaimMode,
        nowIso,
        admissionId
      );

      db.exec('COMMIT;');

      const updatedCase = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId);
      return res.json({ success: true, data: formatEmergencyCase(updatedCase) });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err: any) {
    console.error('Error reserving bed in transaction:', err);
    return res.status(500).json({ success: false, error: err.message || 'Bed reservation transaction failed' });
  }
});

// POST /api/emergency/respond - Assigned nurse accepts a hold or rejects it and offers the next suitable facility.
apiRouter.post('/emergency/respond', requireRole('nurse', 'admin'), (req: Request, res: Response) => {
  try {
    releaseExpiredHolds();
    const parsed = EmergencyResponseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'A case and decision are required.' });
    const user = (req as any).user;
    const { caseId, decision } = parsed.data;
    const nowIso = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE;');
    try {
      const existing = db.prepare("SELECT * FROM emergency_cases WHERE case_id = ? AND hold_status = 'active'").get(caseId) as any;
      if (!existing) {
        db.exec('ROLLBACK;');
        return res.status(409).json({ success: false, error: 'This request is no longer awaiting a hospital response.' });
      }
      if (user.role === 'nurse' && existing.hospital_id !== user.hospitalId) {
        db.exec('ROLLBACK;');
        return res.status(403).json({ success: false, error: 'You can respond only for your assigned hospital.' });
      }
      if (decision === 'accept') {
        db.prepare("UPDATE emergency_cases SET hold_status = 'confirmed', hold_expires_at = NULL, updated_at = ? WHERE case_id = ?").run(nowIso, caseId);
        db.exec('COMMIT;');
        const updated = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId);
        return res.json({ success: true, message: 'Bed accepted and held for the inbound ambulance.', data: formatEmergencyCase(updated) });
      }

      const bedCol = BED_COLUMN_MAP[existing.bed_type] || 'icu_beds';
      // Release this facility, then atomically offer the best available alternative by freshness and load.
      db.prepare(`UPDATE hospitals SET ${bedCol} = ${bedCol} + 1, updated_at = ? WHERE id = ?`).run(nowIso, existing.hospital_id);
      const next = db.prepare(`SELECT * FROM hospitals WHERE id != ? AND ${bedCol} > 0 ORDER BY updated_at DESC, capacity_percent ASC LIMIT 1`).get(existing.hospital_id) as any;
      if (!next) {
        db.prepare("UPDATE emergency_cases SET hold_status = 'rejected', hold_expires_at = NULL, updated_at = ? WHERE case_id = ?").run(nowIso, caseId);
        db.exec('COMMIT;');
        return res.json({ success: true, message: 'Facility declined. No matching alternative is currently available.', data: null });
      }
      db.prepare(`UPDATE hospitals SET ${bedCol} = ${bedCol} - 1, updated_at = ? WHERE id = ?`).run(nowIso, next.id);
      const expires = new Date(Date.now() + 120000).toISOString();
      db.prepare(`UPDATE emergency_cases SET hospital_id = ?, hospital_name = ?, hospital_phone = ?, bed_bay = ?, hold_status = 'active', hold_expires_at = ?, updated_at = ? WHERE case_id = ?`)
        .run(next.id, next.name, next.phone, `${String(existing.bed_type).toUpperCase()} Bay #01`, expires, nowIso, caseId);
      db.prepare(`UPDATE admission_records SET confirmed_hospital = ?, confirmed_bay = ?, confirmation_time = '', notes = ?, updated_at = ? WHERE id = ?`)
        .run(next.name, `${String(existing.bed_type).toUpperCase()} Bay #01`, `Previous facility declined; automatically offered to ${next.name}.`, nowIso, existing.admission_id);
      db.exec('COMMIT;');
      const updated = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId);
      return res.json({ success: true, message: `Facility declined. Hold automatically offered to ${next.name}.`, data: formatEmergencyCase(updated) });
    } catch (error) { db.exec('ROLLBACK;'); throw error; }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Could not record the hospital response.' });
  }
});

// POST /api/emergency/cancel-hold - Patient, assigned hospital nurse, or admin cancels bed reservation & restores bed
apiRouter.post('/emergency/cancel-hold', requireAuth, (req: Request, res: Response) => {
  try {
    const parseResult = CancelHoldSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'caseId is required to cancel reservation' });
    }

    const { caseId } = parseResult.data;
    const user = (req as any).user;
    const nowIso = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE;');
    try {
      const existing = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId) as any;
      if (!existing) {
        db.exec('ROLLBACK;');
        return res.status(404).json({ success: false, error: 'Reservation case not found' });
      }

      // Ownership check: patient owner, nurse of that hospital, or admin
      let isAuthorized = false;
      if (user.role === 'admin') {
        isAuthorized = true;
      } else if (user.role === 'patient') {
        isAuthorized = doesPatientOwnCase(existing, user.userId);
      } else if (user.role === 'nurse') {
        isAuthorized = Boolean(user.hospitalId && existing.hospital_id === user.hospitalId);
      }

      if (!isAuthorized) {
        db.exec('ROLLBACK;');
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You are not authorized to cancel this emergency reservation.',
        });
      }

      // Restore bed count if hold was active or confirmed
      if (
        (existing.hold_status === 'active' || existing.hold_status === 'confirmed') &&
        existing.hospital_id &&
        existing.bed_type
      ) {
        const col = BED_COLUMN_MAP[existing.bed_type] || 'icu_beds';
        db.prepare(`UPDATE hospitals SET ${col} = ${col} + 1, updated_at = ? WHERE id = ?`).run(
          nowIso,
          existing.hospital_id
        );
      }

      // Update case to cancelled
      db.prepare(`
        UPDATE emergency_cases SET
          hold_status = 'cancelled',
          hold_expires_at = NULL,
          updated_at = ?
        WHERE case_id = ?
      `).run(nowIso, caseId);

      // Revert admission status
      if (existing.admission_id) {
        db.prepare(`
          UPDATE admission_records SET
            discharge_status = 'Pending Facility Hold',
            confirmed_hospital = 'Pending Facility Hold',
            confirmed_bay = '',
            confirmation_time = '',
            notes = 'Bed reservation cancelled by patient / attendant.',
            updated_at = ?
          WHERE id = ?
        `).run(nowIso, existing.admission_id);
      }

      db.exec('COMMIT;');
      return res.json({ success: true, message: 'Reservation cancelled and bed released.' });
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err: any) {
    console.error('Cancel hold error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to cancel hold' });
  }
});

// PATCH /api/emergency/stage - Advance milestone (Ambulance or Admin)
apiRouter.patch('/emergency/stage', requireRole('ambulance', 'admin'), (req: Request, res: Response) => {
  try {
    const parseResult = EmergencyStageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid stage data',
      });
    }

    const { caseId, stage, street, etaMinutes, lat, lng } = parseResult.data;
    const user = (req as any).user;
    const nowIso = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Emergency case not found' });
    }

    if (user.role === 'ambulance' && existing.vehicle_no !== user.vehicleNo) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Ambulance pilots may only update cases assigned to their vehicle.',
      });
    }
    if (stage < existing.pipeline_stage) {
      return res.status(409).json({
        success: false,
        error: `Dispatch progression cannot move backwards (currently at stage ${existing.pipeline_stage}).`,
      });
    }

    const shouldConfirmHold =
      stage >= 2 && (existing.hold_status === 'active' || existing.hold_status === 'confirmed');
    const newHoldStatus = shouldConfirmHold ? 'confirmed' : existing.hold_status;
    const newHoldExpiresAt = shouldConfirmHold ? null : existing.hold_expires_at;

    const stmt = db.prepare(`
      UPDATE emergency_cases SET
        pipeline_stage = ?,
        current_street = COALESCE(?, current_street),
        eta_minutes = COALESCE(?, eta_minutes),
        lat = COALESCE(?, lat),
        lng = COALESCE(?, lng),
        hold_status = ?,
        hold_expires_at = ?,
        updated_at = ?
      WHERE case_id = ?
    `);

    stmt.run(
      stage,
      street || null,
      etaMinutes !== undefined ? etaMinutes : null,
      lat !== undefined ? lat : null,
      lng !== undefined ? lng : null,
      newHoldStatus,
      newHoldExpiresAt,
      nowIso,
      caseId
    );

    const updated = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId);
    return res.json({ success: true, data: formatEmergencyCase(updated) });
  } catch (err: any) {
    console.error('Error updating emergency stage:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/emergency/location - Real-time GPS Telemetry (Ambulance or Admin)
apiRouter.patch('/emergency/location', requireRole('ambulance', 'admin'), (req: Request, res: Response) => {
  try {
    const parseResult = EmergencyLocationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'Invalid location telemetry data',
      });
    }

    const { caseId, lat, lng, street, etaMinutes } = parseResult.data;
    const user = (req as any).user;
    const nowIso = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Emergency case not found' });
    }

    if (user.role === 'ambulance' && existing.vehicle_no !== user.vehicleNo) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Ambulance pilots may only update telemetry for cases assigned to their vehicle.',
      });
    }

    const shouldConfirmHold = existing.hold_status === 'active' || existing.hold_status === 'confirmed';
    const newHoldStatus = shouldConfirmHold ? 'confirmed' : existing.hold_status;
    const newHoldExpiresAt = shouldConfirmHold ? null : existing.hold_expires_at;

    const stmt = db.prepare(`
      UPDATE emergency_cases SET
        lat = ?,
        lng = ?,
        current_street = COALESCE(?, current_street),
        eta_minutes = COALESCE(?, eta_minutes),
        hold_status = ?,
        hold_expires_at = ?,
        updated_at = ?
      WHERE case_id = ?
    `);

    stmt.run(
      lat,
      lng,
      street || null,
      etaMinutes !== undefined ? etaMinutes : null,
      newHoldStatus,
      newHoldExpiresAt,
      nowIso,
      caseId
    );

    const updated = db.prepare('SELECT * FROM emergency_cases WHERE case_id = ?').get(caseId);
    return res.json({ success: true, data: formatEmergencyCase(updated) });
  } catch (err: any) {
    console.error('Error updating emergency location:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   6. DOCTORS (Authenticated)
   ========================================================================= */

apiRouter.get('/doctors', requireAuth, (req: Request, res: Response) => {
  try {
    const { hospitalId } = req.query;
    let query = 'SELECT * FROM doctors';
    const params: any[] = [];
    if (hospitalId) {
      query += ' WHERE hospital_id = ?';
      params.push(hospitalId);
    }
    query += ' ORDER BY name ASC';
    const rows = db.prepare(query).all(...params);
    return res.json({ success: true, data: rows.map(formatDoctor) });
  } catch (err: any) {
    console.error('Error fetching doctors:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/doctors/:id/status', requireRole('nurse', 'admin'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const parseResult = DoctorStatusUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error:
          parseResult.error.issues[0]?.message ||
          'Invalid doctor status. Allowed values: AVAILABLE, IN SURGERY, BUSY, OFF DUTY, ON CALL.',
      });
    }

    const existing = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Doctor not found.' });
    }

    if (user.role === 'nurse' && existing.hospital_id !== user.hospitalId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Nurses may only update status for doctors assigned to their own hospital.',
      });
    }

    const { status, location } = parseResult.data;
    const nowIso = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE doctors SET
        status = ?,
        location = COALESCE(?, location),
        updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, location || null, nowIso, id);

    const updated = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
    return res.json({ success: true, data: formatDoctor(updated) });
  } catch (err: any) {
    console.error('Error updating doctor status:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================================
   7. DATABASE MANAGEMENT & STRICT READ-ONLY SQL RUNNER (Admin only)
   ========================================================================= */

apiRouter.get('/db/status', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    const dbPath = path.join(dataDir, 'golden_hour.db');
    let dbSizeKb = 0;
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbSizeKb = Math.round(stats.size / 1024);
    }

    const hospitalCount = (db.prepare('SELECT COUNT(*) as c FROM hospitals').get() as any).c;
    const admissionsCount = (db.prepare('SELECT COUNT(*) as c FROM admission_records').get() as any).c;
    const logsCount = (db.prepare('SELECT COUNT(*) as c FROM user_logs').get() as any).c;
    const doctorsCount = (db.prepare('SELECT COUNT(*) as c FROM doctors').get() as any).c;
    const casesCount = (db.prepare('SELECT COUNT(*) as c FROM emergency_cases').get() as any).c;
    const usersCount = (db.prepare('SELECT COUNT(*) as c FROM auth_users').get() as any).c;

    const journalMode = (db.prepare('PRAGMA journal_mode').get() as any).journal_mode;

    return res.json({
      success: true,
      data: {
        engine: 'SQLite 3 (Node.js 22 native DatabaseSync)',
        databaseFile: dbPath,
        sizeKb: dbSizeKb,
        journalMode,
        tables: {
          hospitals: hospitalCount,
          admission_records: admissionsCount,
          user_logs: logsCount,
          doctors: doctorsCount,
          emergency_cases: casesCount,
          auth_users: usersCount,
        },
        nodeVersion: process.version,
        serverUptimeSec: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Error fetching DB status:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/db/query', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'SQL query string is required.' });
    }

    const trimmed = query.trim();
    const withoutTrailingSemi = trimmed.replace(/;+\s*$/, '');

    // Reject multiple statements separated by ';'
    if (withoutTrailingSemi.includes(';')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Multiple SQL statements are not allowed.',
      });
    }

    // Block queries referencing auth_users or password columns
    if (/\b(auth_users|password_hash|password_salt|sqlite_master|sqlite_schema|sqlite_temp_master)\b/i.test(withoutTrailingSemi)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Queries referencing auth_users or credential columns are restricted.',
      });
    }

    const isReadOnly = /^(SELECT|EXPLAIN|PRAGMA\s+table_info|PRAGMA\s+database_list|PRAGMA\s+journal_mode)/i.test(
      withoutTrailingSemi
    );
    const hasForbiddenKeywords = /\b(DROP|DELETE|INSERT|UPDATE|ALTER|TRUNCATE|ATTACH|DETACH|CREATE|REPLACE|VACUUM|PRAGMA\s+writable_schema)\b/i.test(
      withoutTrailingSemi
    );

    if (!isReadOnly || hasForbiddenKeywords) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: The SQL runner is strictly read-only. Data modification and DDL statements are disabled.',
      });
    }

    const startTime = performance.now();
    const stmt = db.prepare(withoutTrailingSemi);
    const rows = stmt.all();
    const executionMs = Math.round((performance.now() - startTime) * 100) / 100;

    return res.json({
      success: true,
      type: 'SELECT',
      rowCount: rows.length,
      executionMs,
      rows,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/db/reset', requireRole('admin'), (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DB_RESET !== 'true') {
    return res.status(403).json({
      success: false,
      error: 'Database reset is restricted. Set ALLOW_DB_RESET=true in non-production environments.',
    });
  }

  try {
    db.exec(`
      DROP TABLE IF EXISTS auth_users;
      DROP TABLE IF EXISTS hospitals;
      DROP TABLE IF EXISTS admission_records;
      DROP TABLE IF EXISTS user_logs;
      DROP TABLE IF EXISTS emergency_cases;
      DROP TABLE IF EXISTS doctors;
    `);
    initDatabase();
    return res.json({ success: true, message: 'Database reset and seeded with default data.' });
  } catch (err: any) {
    console.error('Error resetting DB:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/db/export', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const hospitals = db.prepare('SELECT * FROM hospitals').all();
    const admissions = db.prepare('SELECT * FROM admission_records').all();
    const logs = db.prepare('SELECT * FROM user_logs').all();
    const cases = db.prepare('SELECT * FROM emergency_cases').all();
    const doctors = db.prepare('SELECT * FROM doctors').all();
    const users = db.prepare('SELECT id, role, username, name, hospital_id, vehicle_no, created_at FROM auth_users').all();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="golden_hour_backup.json"');
    return res.json({
      exportedAt: new Date().toISOString(),
      engine: 'SQLite 3 / Node.js 22',
      tables: {
        hospitals,
        admissions,
        logs,
        cases,
        doctors,
        users,
      },
    });
  } catch (err: any) {
    console.error('Error exporting DB:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
