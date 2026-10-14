export type UserRole = 'patient' | 'nurse' | 'ambulance' | 'admin';

export interface PatientInfo {
  relativeName: string;
  patientName: string;
  // Demographics are optional for an unidentified emergency patient. Never infer them.
  age?: number | null;
  gender?: 'Female' | 'Male' | 'Other' | null;
  phone: string;
  bloodType: string;
  nearestStation: string;
  useGps: boolean;
  userLat?: number;
  userLng?: number;
  accuracyMeters?: number;
  locationSource?: 'gps' | 'station';
  isUnidentified?: boolean;
  // Quick Emergency deliberately collects no demographics. Keep this distinct
  // from an unidentified patient so named quick-intake patients stay private too.
  isQuickEmergency?: boolean;
  admissionId?: string;
}

export interface BedCounts {
  icu: number;
  trauma: number;
  vent: number;
  oxygen: number;
  burns: number;
  general: number;
}

export interface Hospital {
  id: string;
  name: string;
  zone: string;
  nearestStationId: string;
  stationVicinity: string;
  address: string;
  distanceKm: number;
  dynamicDistanceKm?: number;
  lat: number;
  lng: number;
  phone: string;
  isGovernment: boolean;
  has24x7Emergency: boolean;
  beds: BedCounts;
  bloodStock: Record<string, number>;
  specialists: string[];
  cashlessPMJAY: boolean;
  acceptsInsurance: boolean;
  insuranceProviders: string[];
  tpaDeskPhone?: string;
  capacityPercent: number;
  freshMinutesAgo: number;
  isStale?: boolean;
  isRecommended?: boolean;
  imageUrl?: string;
  updatedAt?: string;
}

export interface PatientAdmissionRecord {
  id: string;
  userId?: string | null;
  caseId?: string | null;
  patientName: string;
  age?: number | null;
  gender?: string | null;
  bloodType: string;
  phone: string;
  relativeName: string;
  loginIntakeTime: string;
  intakeAgo: string;
  confirmedHospital: string;
  confirmedBay: string;
  confirmationTime: string;
  confirmationAgo: string;
  dischargeStatus: 'Pending Facility Hold' | 'Admitted / In Care' | 'Discharged';
  dischargeTime?: string;
  notes?: string;
  insuranceType?: string;
  isUnidentified?: boolean;
  isQuickIntake?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserLoginLog {
  id: string;
  userAndContact: string;
  role: 'ADMIN' | 'AMBULANCE PILOT' | 'NURSE STATION' | 'PATIENT / RELATIVE' | 'PATIENT / ATTENDANT';
  facilityOrStation: string;
  loginTimestamp: string;
  timeAgo: string;
  sessionStatus: 'Active Session' | 'Ended';
  ipOrigin: string;
  createdAt?: string;
}

export interface EmergencyCase {
  caseId: string;
  admissionId?: string | null;
  userId?: string | null;
  patientName: string;
  age?: number | null;
  gender?: string | null;
  relativeName: string;
  relativePhone: string;
  bloodType: string;
  injury: string;
  location: string;
  hospitalId?: string | null;
  hospitalName: string;
  hospitalPhone: string;
  bedBay: string;
  bedType?: 'icu' | 'trauma' | 'vent' | 'oxygen' | 'burns' | 'general';
  specialistName: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  etaMinutes: number;
  currentStreet: string;
  lat?: number | null;
  lng?: number | null;
  targetLocation: string;
  pipelineStage: number; // 1 to 5
  insuranceClaimMode?: string;
  holdExpiresAt?: string | null;
  holdStatus?: 'active' | 'confirmed' | 'rejected' | 'expired' | 'cancelled' | 'completed';
  isQuickIntake?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DoctorRecord {
  id: string;
  hospitalId: string;
  name: string;
  status: 'AVAILABLE' | 'IN SURGERY' | 'BUSY' | 'OFF DUTY' | 'ON CALL';
  specialty: string;
  dept: string;
  location: string;
  activeCase: string;
  avatar: string;
  phone: string;
  createdAt?: string;
  updatedAt?: string;
}
