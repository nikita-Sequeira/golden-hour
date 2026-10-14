
import { z } from 'zod';
 
const indianPhoneRegex = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
 
export const LoginSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('admin'),
    username: z.string().trim().min(1, 'Username is required'),
    passcode: z.string().trim().min(1, 'Passcode is required'),
  }),
  z.object({
    role: z.literal('nurse'),
    username: z.string().trim().min(1, 'Staff ID is required'),
    passcode: z.string().trim().min(1, 'Passcode is required'),
    hospitalId: z.string().trim().min(1, 'Hospital is required').optional(),
  }),
  z.object({
    role: z.literal('ambulance'),
    username: z.string().trim().min(1, 'Driver Badge ID is required'),
    passcode: z.string().trim().min(1, 'Passcode is required'),
    vehicleNo: z.string().trim().min(1, 'Vehicle number is required').optional(),
  }),
  z.object({
    role: z.literal('patient'),
    patientName: z
      .string()
      .trim()
      .min(1, "Please enter the patient's name (or select 'I don't know their name')"),
    relativeName: z.string().trim().min(1, "Please enter the attendant/contact person's name"),
    phone: z
      .string()
      .trim()
      .regex(indianPhoneRegex, 'Please enter a valid 10-digit Indian phone number'),
    age: z
      .coerce
      .number()
      .int('Age must be a whole number')
      .min(0, 'Age must be at least 0')
      .max(120, 'Age cannot exceed 120')
      .nullable()
      .optional(),
    gender: z.enum(['Female', 'Male', 'Other']).nullable().optional(),
    bloodType: z.string().trim().default("Don't know"),
    nearestStation: z.string().trim().default('Andheri Station'),
    isUnidentified: z.boolean().optional().default(false),
    isQuickIntake: z.boolean().optional().default(false),
  }),
]);
 
export const BedCountUpdateSchema = z.object({
  icu: z.number().int().nonnegative().optional(),
  trauma: z.number().int().nonnegative().optional(),
  vent: z.number().int().nonnegative().optional(),
  oxygen: z.number().int().nonnegative().optional(),
  burns: z.number().int().nonnegative().optional(),
  general: z.number().int().nonnegative().optional(),
});
 
export const EmergencyHoldSchema = z.object({
  caseId: z.string().trim().min(1, 'caseId is required'),
  admissionId: z.string().trim().min(1, 'admissionId is required'),
  hospitalId: z.string().trim().min(1, 'hospitalId is required'),
  bedBay: z.string().trim().min(1, 'bedBay is required'),
  bedType: z.enum(['icu', 'trauma', 'vent', 'oxygen', 'burns', 'general']).default('icu'),
  insuranceClaimMode: z.string().trim().min(1, 'Payment/insurance mode is required'),
  patientName: z.string().trim().optional(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(['Female', 'Male', 'Other']).optional(),
  bloodType: z.string().trim().optional(),
  relativeName: z.string().trim().optional(),
  relativePhone: z.string().trim().optional(),
  isQuickIntake: z.boolean().optional().default(false),
});
 
export const CancelHoldSchema = z.object({
  caseId: z.string().trim().min(1, 'caseId is required'),
});
 
export const EmergencyResponseSchema = z.object({
  caseId: z.string().trim().min(1, 'caseId is required'),
  decision: z.enum(['accept', 'reject']),
});
 
export const EmergencyStageSchema = z.object({
  caseId: z.string().trim().min(1),
  stage: z.number().int().min(1).max(5),
  street: z.string().trim().optional(),
  etaMinutes: z.number().int().nonnegative().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
 
export const EmergencyLocationSchema = z.object({
  caseId: z.string().trim().min(1),
  lat: z.number(),
  lng: z.number(),
  street: z.string().trim().optional(),
  etaMinutes: z.number().int().nonnegative().optional(),
});
 
export const DoctorStatusUpdateSchema = z.object({
  status: z.enum(['AVAILABLE', 'IN SURGERY', 'BUSY', 'OFF DUTY', 'ON CALL']),
  location: z.string().trim().optional(),
});
 
export const CreateHospitalSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Hospital id must match /^[a-z0-9-]+$/')
    .optional(),
  name: z.string().trim().min(1, 'Hospital name is required'),
  zone: z.string().trim().default('Andheri - Jogeshwari'),
  nearestStationId: z.string().trim().default('andheri'),
  stationVicinity: z.string().trim().default('Near Western Line'),
  address: z.string().trim().default(''),
  distanceKm: z.number().optional().default(1.5),
  lat: z.number().optional().default(19.1197),
  lng: z.number().optional().default(72.8464),
  phone: z.string().trim().min(1, 'Hospital phone is required'),
  isGovernment: z.boolean().optional().default(false),
  has24x7Emergency: z.boolean().optional().default(true),
  beds: BedCountUpdateSchema.optional(),
  bloodStock: z.record(z.string(), z.number()).optional(),
  specialists: z.array(z.string()).optional(),
  cashlessPMJAY: z.boolean().optional(),
  acceptsInsurance: z.boolean().optional(),
  insuranceProviders: z.array(z.string()).optional(),
  tpaDeskPhone: z.string().trim().optional(),
  capacityPercent: z.number().optional(),
  isRecommended: z.boolean().optional(),
  imageUrl: z.string().trim().optional(),
});
 
export const CreateAdmissionSchema = z.object({
  caseId: z.string().trim().optional(),
  patientName: z.string().trim().min(1, 'Patient name is required'),
  age: z.coerce.number().int().min(0).max(120),
  gender: z.enum(['Female', 'Male', 'Other']),
  bloodType: z.string().trim().default("Don't know"),
  phone: z.string().trim().regex(indianPhoneRegex, 'Valid 10-digit Indian phone required'),
  relativeName: z.string().trim().min(1, 'Attendant name is required'),
  notes: z.string().trim().optional(),
  insuranceType: z.string().trim().optional(),
  isUnidentified: z.boolean().optional().default(false),
});
 
export const AadhaarScanInputSchema = z.object({
  image: z.string().min(50, 'Image payload must be a valid base64 data string'),
});
 
// Gemini output is untrusted: it may omit null fields, abbreviate gender ("M"),
// return age as a string, etc. Normalise before validating instead of failing the scan.
const lenientString = z.preprocess(
  (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim()),
  z.string().nullable()
);
 
export const AadhaarExtractedSchema = z.object({
  isAadhaarDetected: z.preprocess(
    (v) => (typeof v === 'boolean' ? v : v === undefined || v === null ? true : String(v).toLowerCase() !== 'false'),
    z.boolean()
  ),
  patientName: lenientString,
  dob: lenientString,
  age: z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isFinite(n) && n >= 0 && n <= 130 ? n : null;
  }, z.number().nullable()),
  gender: z.preprocess((v) => {
    if (v === undefined || v === null || String(v).trim() === '') return null;
    const g = String(v).trim().toLowerCase();
    if (g.startsWith('f')) return 'Female';
    if (g.startsWith('m')) return 'Male';
    return 'Other';
  }, z.enum(['Female', 'Male', 'Other']).nullable()),
  aadhaarNumberMasked: lenientString,
  relativeName: lenientString,
  phone: lenientString,
  bloodType: lenientString,
  address: lenientString,
  nearestStation: lenientString,
});