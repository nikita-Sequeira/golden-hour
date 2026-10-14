import { Hospital, PatientAdmissionRecord, UserLoginLog, EmergencyCase } from '../types/bedlink';
import { WESTERN_STATION_NAMES } from './stations';

export const WESTERN_LINE_STATIONS = WESTERN_STATION_NAMES;

export const INITIAL_HOSPITALS: Hospital[] = [];
export const INITIAL_ADMISSION_RECORDS: PatientAdmissionRecord[] = [];
export const INITIAL_USER_LOGS: UserLoginLog[] = [];
export const INITIAL_EMERGENCY_CASE: EmergencyCase | null = null;
