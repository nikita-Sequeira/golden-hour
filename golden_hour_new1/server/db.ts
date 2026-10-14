import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { hashPassword } from './auth';
import seedHospitalsData from './data/hospitals.seed.json';

// Ensure data directory exists relative to workspace root (process.cwd())
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Rebrand migration: migrate existing saarthi_emergency.db to golden_hour.db
const oldDbPath = path.join(dataDir, 'saarthi_emergency.db');
const dbPath = path.join(dataDir, 'golden_hour.db');

if (!fs.existsSync(dbPath) && fs.existsSync(oldDbPath)) {
  try {
    fs.copyFileSync(oldDbPath, dbPath);
    console.log('[Database] Migrated existing database from saarthi_emergency.db to golden_hour.db');
  } catch (copyErr) {
    console.warn('[Database] Could not copy old db file:', copyErr);
  }
}

export const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      name TEXT NOT NULL,
      hospital_id TEXT,
      vehicle_no TEXT,
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      zone TEXT NOT NULL DEFAULT 'Andheri - Jogeshwari',
      nearest_station_id TEXT NOT NULL DEFAULT 'andheri',
      station_vicinity TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      distance_km REAL NOT NULL DEFAULT 1.5,
      lat REAL NOT NULL DEFAULT 19.1197,
      lng REAL NOT NULL DEFAULT 72.8464,
      phone TEXT NOT NULL,
      is_government INTEGER NOT NULL DEFAULT 0,
      has_24x7_emergency INTEGER NOT NULL DEFAULT 1,
      icu_beds INTEGER NOT NULL DEFAULT 0,
      trauma_beds INTEGER NOT NULL DEFAULT 0,
      vent_beds INTEGER NOT NULL DEFAULT 0,
      oxygen_beds INTEGER NOT NULL DEFAULT 0,
      burns_beds INTEGER NOT NULL DEFAULT 0,
      general_beds INTEGER NOT NULL DEFAULT 0,
      blood_stock_json TEXT NOT NULL DEFAULT '{}',
      specialists_json TEXT NOT NULL DEFAULT '[]',
      cashless_pmjay INTEGER NOT NULL DEFAULT 1,
      accepts_insurance INTEGER NOT NULL DEFAULT 1,
      insurance_providers_json TEXT NOT NULL DEFAULT '[]',
      tpa_desk_phone TEXT,
      capacity_percent INTEGER NOT NULL DEFAULT 50,
      is_recommended INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admission_records (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      case_id TEXT,
      patient_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      blood_type TEXT NOT NULL,
      phone TEXT NOT NULL,
      relative_name TEXT NOT NULL,
      login_intake_time TEXT NOT NULL,
      confirmed_hospital TEXT NOT NULL DEFAULT 'Pending Facility Hold',
      confirmed_bay TEXT DEFAULT '',
      confirmation_time TEXT DEFAULT '',
      discharge_status TEXT NOT NULL DEFAULT 'Pending Facility Hold',
      discharge_time TEXT,
      notes TEXT,
      insurance_type TEXT DEFAULT 'PM-JAY / Cashless In Review',
      is_unidentified INTEGER NOT NULL DEFAULT 0,
      is_quick_intake INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_logs (
      id TEXT PRIMARY KEY,
      user_and_contact TEXT NOT NULL,
      role TEXT NOT NULL,
      facility_or_station TEXT NOT NULL,
      login_timestamp TEXT NOT NULL,
      session_status TEXT NOT NULL DEFAULT 'Active Session',
      ip_origin TEXT NOT NULL DEFAULT '127.0.0.1',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emergency_cases (
      case_id TEXT PRIMARY KEY,
      admission_id TEXT,
      user_id TEXT,
      patient_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      relative_name TEXT NOT NULL,
      relative_phone TEXT NOT NULL,
      blood_type TEXT NOT NULL,
      injury TEXT NOT NULL,
      location TEXT NOT NULL,
      hospital_id TEXT,
      hospital_name TEXT NOT NULL,
      hospital_phone TEXT NOT NULL,
      bed_bay TEXT NOT NULL,
      bed_type TEXT NOT NULL DEFAULT 'icu',
      specialist_name TEXT NOT NULL,
      vehicle_no TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      driver_phone TEXT NOT NULL,
      eta_minutes INTEGER NOT NULL,
      current_street TEXT NOT NULL,
      lat REAL DEFAULT 19.1156,
      lng REAL DEFAULT 72.8521,
      target_location TEXT NOT NULL,
      pipeline_stage INTEGER NOT NULL DEFAULT 1,
      is_quick_intake INTEGER NOT NULL DEFAULT 0,
      insurance_claim_mode TEXT DEFAULT 'Cashless Insurance / PM-JAY',
      hold_expires_at TEXT,
      hold_status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      hospital_id TEXT NOT NULL DEFAULT 'hosp-sevenhills',
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      specialty TEXT NOT NULL,
      dept TEXT NOT NULL,
      location TEXT NOT NULL,
      active_case TEXT DEFAULT 'No Active Case',
      avatar TEXT,
      phone TEXT DEFAULT '+91 22 6767 6767',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Schema migrations for pre-existing tables
  try {
    const hospCols = db.prepare('PRAGMA table_info(hospitals)').all() as Array<{ name: string }>;
    const hospColNames = hospCols.map((c) => c.name);
    if (!hospColNames.includes('zone')) {
      db.exec("ALTER TABLE hospitals ADD COLUMN zone TEXT NOT NULL DEFAULT 'Andheri - Jogeshwari';");
    }
    if (!hospColNames.includes('nearest_station_id')) {
      db.exec("ALTER TABLE hospitals ADD COLUMN nearest_station_id TEXT NOT NULL DEFAULT 'andheri';");
    }
    if (!hospColNames.includes('address')) {
      db.exec("ALTER TABLE hospitals ADD COLUMN address TEXT NOT NULL DEFAULT '';");
    }
    if (!hospColNames.includes('is_government')) {
      db.exec('ALTER TABLE hospitals ADD COLUMN is_government INTEGER NOT NULL DEFAULT 0;');
    }
    if (!hospColNames.includes('has_24x7_emergency')) {
      db.exec('ALTER TABLE hospitals ADD COLUMN has_24x7_emergency INTEGER NOT NULL DEFAULT 1;');
    }

    const caseCols = db.prepare('PRAGMA table_info(emergency_cases)').all() as Array<{ name: string }>;
    const caseColNames = caseCols.map((c) => c.name);
    if (!caseColNames.includes('user_id')) {
      db.exec('ALTER TABLE emergency_cases ADD COLUMN user_id TEXT;');
    }
    if (!caseColNames.includes('hold_expires_at')) {
      db.exec('ALTER TABLE emergency_cases ADD COLUMN hold_expires_at TEXT;');
    }
    if (!caseColNames.includes('hold_status')) {
      db.exec("ALTER TABLE emergency_cases ADD COLUMN hold_status TEXT NOT NULL DEFAULT 'active';");
    }
    if (!caseColNames.includes('is_quick_intake')) {
      db.exec('ALTER TABLE emergency_cases ADD COLUMN is_quick_intake INTEGER NOT NULL DEFAULT 0;');
    }

    const admCols = db.prepare('PRAGMA table_info(admission_records)').all() as Array<{ name: string }>;
    const admColNames = admCols.map((c) => c.name);
    if (!admColNames.includes('user_id')) {
      db.exec('ALTER TABLE admission_records ADD COLUMN user_id TEXT;');
    }
    if (!admColNames.includes('is_unidentified')) {
      db.exec('ALTER TABLE admission_records ADD COLUMN is_unidentified INTEGER NOT NULL DEFAULT 0;');
    }
    if (!admColNames.includes('is_quick_intake')) {
      db.exec('ALTER TABLE admission_records ADD COLUMN is_quick_intake INTEGER NOT NULL DEFAULT 0;');
    }
  } catch (migErr) {
    console.warn('[Database] Migration notice:', migErr);
  }

  // Idempotent upsert of all hospitals & seed data
  seedOrSyncDatabase();
}

export function releaseExpiredHolds() {
  try {
    const nowIso = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE;');
    try {
      const expiredCases = db
        .prepare(`
          SELECT * FROM emergency_cases
          WHERE hold_status = 'active' AND hold_expires_at IS NOT NULL AND hold_expires_at < ?
        `)
        .all(nowIso) as any[];

      for (const c of expiredCases) {
        if (c.hospital_id && c.bed_type) {
          const colMap: Record<string, string> = {
            icu: 'icu_beds',
            trauma: 'trauma_beds',
            vent: 'vent_beds',
            oxygen: 'oxygen_beds',
            burns: 'burns_beds',
            general: 'general_beds',
          };
          const col = colMap[c.bed_type] || 'icu_beds';
          db.prepare(`UPDATE hospitals SET ${col} = ${col} + 1, updated_at = ? WHERE id = ?`).run(
            nowIso,
            c.hospital_id
          );
        }

        db.prepare(`UPDATE emergency_cases SET hold_status = 'expired', updated_at = ? WHERE case_id = ?`).run(
          nowIso,
          c.case_id
        );

        if (c.admission_id) {
          db.prepare(`
            UPDATE admission_records
            SET discharge_status = 'Pending Facility Hold', confirmed_hospital = 'Hold Expired - Please re-select', updated_at = ?
            WHERE id = ? AND discharge_status = 'Admitted / In Care'
          `).run(nowIso, c.admission_id);
        }
      }
      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }
  } catch (err) {
    console.warn('[Database] Error checking expired holds:', err);
  }
}

function seedOrSyncDatabase() {
  const nowIso = new Date().toISOString();

  // 1. Seed Auth Users (Insert if not exists)
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO auth_users (id, role, username, password_hash, password_salt, name, hospital_id, vehicle_no, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin
  const adminHash = hashPassword('admin123');
  insertUser.run('usr-admin-1', 'admin', 'ADM-OPS-01', adminHash.hash, adminHash.salt, 'Central Operations Officer', null, null, '+91 22 2262 0108', nowIso);

  // Ambulance Driver
  const ambHash = hashPassword('9192');
  insertUser.run('usr-amb-1', 'ambulance', 'AMB-108-9192', ambHash.hash, ambHash.salt, 'Ramesh Sawant (ALS Pilot)', null, 'MH-02-ER-9192', '+91 98700 11223', nowIso);

  // Demo Nurses across zones
  const nurseHash = hashPassword('123456');
  insertUser.run('usr-nurse-1', 'nurse', 'NS-7H-104', nurseHash.hash, nurseHash.salt, 'Sister Sneha Kadam', 'hosp-sevenhills', null, '+91 22 6767 6767', nowIso);
  insertUser.run('usr-nurse-2', 'nurse', 'NS-BH-101', nurseHash.hash, nurseHash.salt, 'Sister Mary Dsouza', 'hosp-bombay', null, '+91 22 2206 7676', nowIso);
  insertUser.run('usr-nurse-3', 'nurse', 'NS-LIL-101', nurseHash.hash, nurseHash.salt, 'Sister Ananya Roy', 'hosp-lilavati', null, '+91 22 2675 1000', nowIso);
  insertUser.run('usr-nurse-4', 'nurse', 'NS-NAN-101', nurseHash.hash, nurseHash.salt, 'Sister Preeti Nair', 'hosp-nanavati', null, '+91 22 2626 7500', nowIso);
  insertUser.run('usr-nurse-5', 'nurse', 'NS-SHAT-101', nurseHash.hash, nurseHash.salt, 'Sister Kavita Shinde', 'hosp-shatabdi-kandivali', null, '+91 22 2805 1141', nowIso);
  insertUser.run('usr-nurse-6', 'nurse', 'NS-CG-101', nurseHash.hash, nurseHash.salt, 'Sister Rita Fernandes', 'hosp-cardinal-gracias', null, '+91 250 232 2252', nowIso);

  // 2. Load hospitals seed data from bundled JSON (with fallback to server/data/hospitals.seed.json)
  try {
    let seedHospitals: any[] = Array.isArray(seedHospitalsData) ? seedHospitalsData : [];
    if (seedHospitals.length === 0) {
      const fallbackPath = path.resolve(process.cwd(), 'server/data/hospitals.seed.json');
      if (fs.existsSync(fallbackPath)) {
        seedHospitals = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
      }
    }

    const checkHospitalStmt = db.prepare('SELECT id FROM hospitals WHERE id = ?');
    const insertHospitalStmt = db.prepare(`
      INSERT INTO hospitals (
        id, name, zone, nearest_station_id, station_vicinity, address, distance_km, lat, lng, phone,
        is_government, has_24x7_emergency,
        icu_beds, trauma_beds, vent_beds, oxygen_beds, burns_beds, general_beds,
        blood_stock_json, specialists_json, cashless_pmjay, accepts_insurance,
        insurance_providers_json, tpa_desk_phone, capacity_percent,
        is_recommended, image_url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateMetadataStmt = db.prepare(`
      UPDATE hospitals SET
        name = ?, zone = ?, nearest_station_id = ?, station_vicinity = ?, address = ?,
        lat = ?, lng = ?, phone = ?, is_government = ?, has_24x7_emergency = ?,
        specialists_json = ?, cashless_pmjay = ?, accepts_insurance = ?,
        insurance_providers_json = ?, tpa_desk_phone = ?, is_recommended = ?
      WHERE id = ?
    `);

    for (const h of seedHospitals) {
      const existing = checkHospitalStmt.get(h.id);
      if (!existing) {
        insertHospitalStmt.run(
          h.id,
          h.name,
          h.zone || 'Andheri - Jogeshwari',
          h.nearestStationId || 'andheri',
          h.stationVicinity || 'Near Western Line',
          h.address || '',
          h.distanceKm || 1.5,
          h.lat || 19.1197,
          h.lng || 72.8464,
          h.phone || '+91 22 2820 0000',
          h.isGovernment ? 1 : 0,
          h.has24x7Emergency ? 1 : 0,
          h.icu ?? 6,
          h.trauma ?? 4,
          h.vent ?? 4,
          h.oxygen ?? 15,
          h.burns ?? 2,
          h.general ?? 30,
          JSON.stringify(h.bloodStock || { 'O+': 10, 'A+': 8, 'B+': 10 }),
          JSON.stringify(h.specialists || ['Dr. Emergency Medical Officer']),
          h.cashlessPMJAY ? 1 : 0,
          h.acceptsInsurance ? 1 : 0,
          JSON.stringify(h.insuranceProviders || ['PM-JAY']),
          h.tpaDeskPhone || '',
          h.capacityPercent || 50,
          h.isRecommended ? 1 : 0,
          h.imageUrl || '',
          nowIso
        );
      } else {
        // Keep existing nurse-updated bed counts, update metadata only
        updateMetadataStmt.run(
          h.name,
          h.zone || 'Andheri - Jogeshwari',
          h.nearestStationId || 'andheri',
          h.stationVicinity || 'Near Western Line',
          h.address || '',
          h.lat || 19.1197,
          h.lng || 72.8464,
          h.phone || '+91 22 2820 0000',
          h.isGovernment ? 1 : 0,
          h.has24x7Emergency ? 1 : 0,
          JSON.stringify(h.specialists || ['Dr. Emergency Medical Officer']),
          h.cashlessPMJAY ? 1 : 0,
          h.acceptsInsurance ? 1 : 0,
          JSON.stringify(h.insuranceProviders || ['PM-JAY']),
          h.tpaDeskPhone || '',
          h.isRecommended ? 1 : 0,
          h.id
        );
      }
    }
    console.log(`[Database] Synced ${seedHospitals.length} hospitals across Western Railway grid.`);

    // One demo-only nurse account per seeded hospital. IDs are deterministic so
    // the credentials documented in DEMO_NURSE_CREDENTIALS.md survive restarts.
    const allHospitals = db.prepare('SELECT id, name, phone FROM hospitals ORDER BY id').all() as any[];
    for (const [index, hospital] of allHospitals.entries()) {
      const demoNumber = String(index + 1).padStart(3, '0');
      insertUser.run(
        `usr-nurse-demo-${demoNumber}`,
        'nurse',
        `NS-DEMO-${demoNumber}`,
        nurseHash.hash,
        nurseHash.salt,
        `Demo Nurse — ${hospital.name}`,
        hospital.id,
        null,
        hospital.phone || null,
        nowIso
      );
    }
  } catch (err) {
    console.warn('[Database] Could not seed hospitals from JSON:', err);
  }

  // 3. Seed Doctors for Seven Hills and other facilities if empty
  const docCount = (db.prepare('SELECT COUNT(*) as c FROM doctors').get() as any).c;
  if (docCount === 0) {
    const insertDoc = db.prepare(`
      INSERT INTO doctors (id, hospital_id, name, status, specialty, dept, location, active_case, avatar, phone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialDoctors = [
      {
        id: 'doc1',
        hospital_id: 'hosp-sevenhills',
        name: 'Dr. Rohan Mehta',
        status: 'AVAILABLE',
        specialty: 'Trauma & Emergency Specialist',
        dept: 'Emergency & Critical Care - MBBS, MD (Emergency Medicine)',
        location: 'In Emergency Triage Bay',
        activeCase: 'No Active Case',
        avatar: '',
        phone: '+91 22 6767 6701',
      },
      {
        id: 'doc2',
        hospital_id: 'hosp-sevenhills',
        name: 'Dr. Anita Deshmukh',
        status: 'AVAILABLE',
        specialty: 'Vascular & Trauma Surgeon',
        dept: 'Vascular Surgery - MS, MCh (Vascular)',
        location: 'On standby for acute blood loss trauma',
        activeCase: 'Available for Trauma consult',
        avatar: '',
        phone: '+91 22 6767 6702',
      },
      {
        id: 'doc3',
        hospital_id: 'hosp-sevenhills',
        name: 'Dr. Vikramaditya Rao',
        status: 'IN SURGERY',
        specialty: 'Interventional Cardiologist',
        dept: 'Cardiology & Cath Lab - MD, DM (Cardio)',
        location: 'Cath Lab Room 2',
        activeCase: 'In Surgery',
        avatar: '',
        phone: '+91 22 6767 6703',
      },
      {
        id: 'doc4',
        hospital_id: 'hosp-sevenhills',
        name: 'Dr. Farhan Qureshi',
        status: 'AVAILABLE',
        specialty: 'Neurosurgeon',
        dept: 'Neurosurgery - MS, MCh (Neurosurgery)',
        location: 'Trauma ICU Floor 3',
        activeCase: 'No Active Case',
        avatar: '',
        phone: '+91 22 6767 6704',
      },
      {
        id: 'doc5',
        hospital_id: 'hosp-bombay',
        name: 'Dr. Sorabji Mehta',
        status: 'AVAILABLE',
        specialty: 'Senior Intensivist & Critical Care',
        dept: 'Critical Care Unit',
        location: 'ICU Triage',
        activeCase: 'No Active Case',
        avatar: '',
        phone: '+91 22 2206 7679',
      },
    ];

    for (const d of initialDoctors) {
      insertDoc.run(d.id, d.hospital_id, d.name, d.status, d.specialty, d.dept, d.location, d.activeCase, d.avatar, d.phone, nowIso, nowIso);
    }
  }
}
