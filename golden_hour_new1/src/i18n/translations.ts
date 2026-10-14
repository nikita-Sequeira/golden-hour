export type LanguageCode = 'English' | 'Hindi' | 'Marathi';

export interface Translations {
  appName: string;
  tagline: string;
  emergencyNetwork: string;
  emergencyButton: string;
  emergencySubtitle: string;
  onlineStatus: string;
  offlineStatus: string;
  logout: string;
  quickTestView: string;
  demoDataBadge: string;
  sampleBedCountsNote: string;
  staleDataWarning: string;
  liveDataFresh: string;
  apiErrorBanner: string;
  retryConnection: string;
  calmDisclaimer: string;

  // Emergency Safety Actions
  call108Action: string;
  call112Action: string;

  // Navigation / Login
  tabPatient: string;
  tabNurse: string;
  tabAmbulance: string;
  tabAdmin: string;
  staffLoginTitle: string;
  staffLoginSubtitle: string;
  backToPatientSearch: string;
  staffPortalToggle: string;

  // Patient Intake
  findHospitalBedNow: string;
  findHospitalBedNowDesc: string;
  quickEmergencyTitle: string;
  quickEmergencySubtitle: string;
  patientNameLabel: string;
  patientNamePlaceholder: string;
  unknownPatientChoice: string;
  phoneLabel: string;
  phonePlaceholder: string;
  relativeNameLabel: string;
  relativeNamePlaceholder: string;
  ageLabel: string;
  genderLabel: string;
  bloodGroupLabel: string;
  bloodGroupUnknown: string;
  female: string;
  male: string;
  other: string;
  selectStationLabel: string;
  locationStatusFinding: string;
  locationStatusFound: string;
  locationStatusFailed: string;
  locationOutsideArea: string;
  useMyGps: string;
  retryLocation: string;
  distancesFromGps: string;
  distancesFromStation: string;
  autofillAadhaar: string;
  fillDetailsManually: string;
  continueButton: string;
  findBed1Tap: string;

  // Emergency Type (merged)
  whatKindOfEmergency: string;
  emergencyBleeding: string;
  emergencyCardiac: string;
  emergencyBurns: string;
  emergencyHeadInjury: string;
  emergencyBreathing: string;
  emergencyOther: string;
  advancedBedTypeToggle: string;
  chooseBedTypeYourself: string;

  // Payment (merged)
  howWillYouPay: string;
  paymentCashless: string;
  paymentCashlessDesc: string;
  paymentSelfPay: string;
  paymentSelfPayDesc: string;
  proximityRange: string;
  within2km: string;

  // Radar & Cards
  bedAvailability: string;
  myEmergencyTracker: string;
  triageRadarTitle: string;
  straightLineDistance: string;
  noHospitalsMatched: string;
  autoWidenedNotice: string;
  reserveBed2Min: string;
  reserveBedSimulatedNote: string;
  freeBeds: string;
  bloodBankUnits: string;
  bloodGroupUnknownNotice: string;
  holdTop3Button: string;
  simultaneousHoldTitle: string;
  simultaneousHoldDesc: string;

  // Bed Hold & SLA
  holdModalTitle: string;
  holdModalSubtitle: string;
  patientDecisionSla: string;
  confirmAndLock: string;
  cancelReservation: string;
  reservationExpired: string;
  reservationActive: string;
  assignedBay: string;
  noBedReservedYet: string;
  findBedFirst: string;

  // Journey Pipeline
  ambulanceDispatched: string;
  ambulanceDispatchedDesc: string;
  enRouteToPatient: string;
  enRouteToPatientDesc: string;
  arrivedAtScene: string;
  arrivedAtSceneDesc: string;
  inTransitToHospital: string;
  inTransitToHospitalDesc: string;
  deliveredToEr: string;
  deliveredToErDesc: string;
  etaMinutes: string;
  callDriver: string;

  // Nurse Station
  nurseStationTitle: string;
  incomingEmergency: string;
  tenSecUpdate: string;
  onDutyDoctorsTitle: string;
  requestAvailability: string;
  updatedByStaff: string;

  // Ambulance Console
  driverConsoleTitle: string;
  sirenActive: string;
  sirenInactive: string;
  callErDesk: string;
  advanceMilestone: string;
  gpsSimulatedBanner: string;

  // Admin
  adminPortalTitle: string;
  tabAdmissions: string;
  tabAuditLogs: string;
  tabHospitalsBeds: string;
  tabSqlStudio: string;
  dischargePatient: string;
  viewDossier: string;
}

import { en } from './locales/en';
import { hi } from './locales/hi';
import { mr } from './locales/mr';

export const TRANSLATIONS: Record<LanguageCode, Translations> = {
  English: en,
  Hindi: hi,
  Marathi: mr,
};
