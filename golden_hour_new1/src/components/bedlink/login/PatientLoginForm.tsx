import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  MapPin,
  Navigation,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  User,
} from 'lucide-react';
import { PatientInfo } from '../../../types/bedlink';
import { WESTERN_LINE_STATIONS } from '../../../data/stations';
import { Translations } from '../../../i18n/translations';
import { api, AuthSession } from '../../../api/client';
import { useLocation } from '../../../hooks/useLocation';

interface PatientLoginFormProps {
  onLogin: (info: PatientInfo, sessionUser: AuthSession) => void;
  onOpenScanner: () => void;
  scannedData?: Partial<PatientInfo> | null;
  t: Translations;
}

interface FormErrors {
  patientName?: string;
  relativeName?: string;
  phone?: string;
  age?: string;
}

const INDIAN_PHONE_REGEX = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;

const Step: React.FC<{ n: number; title: string; hint?: string; last?: boolean; children: React.ReactNode }> = ({
  n,
  title,
  hint,
  last,
  children,
}) => (
  <section className="grid grid-cols-[2rem_1fr] gap-x-4">
    <div className="flex flex-col items-center">
      <span className="w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center shrink-0">
        {n}
      </span>
      {!last && <span className="flex-1 w-px bg-slate-200 mt-2" />}
    </div>
    <div className={last ? '' : 'pb-8'}>
      <h3 className="font-display text-xl font-bold text-slate-900 leading-8">{title}</h3>
      {hint && <p className="text-sm text-slate-500 -mt-0.5">{hint}</p>}
      <div className="mt-3.5 space-y-4">{children}</div>
    </div>
  </section>
);

export const PatientLoginForm: React.FC<PatientLoginFormProps> = ({
  onLogin,
  onOpenScanner,
  scannedData,
  t,
}) => {
  const [mode, setMode] = useState<'quick' | 'full'>('quick');

  // Form State
  const [patientName, setPatientName] = useState('');
  const [isUnknownName, setIsUnknownName] = useState(false);
  const [relativeName, setRelativeName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientGender, setPatientGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [selectedBlood, setSelectedBlood] = useState<string>("Don't know");

  // Validation & Error State
  const [errors, setErrors] = useState<FormErrors>({});
  const [, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field refs for focus on invalid
  const patientNameRef = useRef<HTMLInputElement>(null);
  const relativeNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);

  // Location Hook
  const location = useLocation('Bandra Station');

  // Request GPS on mount for speed
  useEffect(() => {
    location.requestGps();
  }, [location.requestGps]);

  // Apply scanned Aadhaar data if provided
  useEffect(() => {
    if (scannedData) {
      if (scannedData.patientName) {
        setPatientName(scannedData.patientName);
        setIsUnknownName(false);
      }
      if (scannedData.relativeName) setRelativeName(scannedData.relativeName);
      if (scannedData.phone) setPhoneNumber(scannedData.phone);
      if (scannedData.age !== undefined && scannedData.age !== null) setPatientAge(String(scannedData.age));
      if (scannedData.gender) setPatientGender(scannedData.gender);
      if (scannedData.bloodType) setSelectedBlood(scannedData.bloodType);
      if (scannedData.nearestStation) location.selectStationManually(scannedData.nearestStation);
      setMode('full');
    }
  }, [scannedData, location.selectStationManually]);

  const bloodOptions = ["Don't know", 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  // Inline Validation Helper
  const validateField = (field: keyof FormErrors, value?: any): string | undefined => {
    if (field === 'patientName') {
      if (isUnknownName) return undefined;
      const v = (value !== undefined ? value : patientName).trim();
      if (!v) return "Please enter the patient's name (or choose 'I don't know their name').";
    }
    if (field === 'relativeName') {
      if (mode === 'quick') return undefined; // Quick emergency requires only patient & contact phone
      const v = (value !== undefined ? value : relativeName).trim();
      if (!v) return "Please enter your name or attendant's name.";
    }
    if (field === 'phone') {
      const v = (value !== undefined ? value : phoneNumber).trim();
      if (!v) return 'Please enter a 10-digit phone number to reach you.';
      if (!INDIAN_PHONE_REGEX.test(v)) return 'Please enter a valid 10-digit Indian phone number.';
    }
    if (field === 'age') {
      if (mode === 'quick') return undefined;
      const raw = value !== undefined ? value : patientAge;
      if (raw === '' || raw === null || raw === undefined) return 'Please enter patient age (0-120).';
      const num = Number(raw);
      if (isNaN(num) || num < 0 || num > 120 || !Number.isInteger(num)) {
        return 'Age must be a whole number between 0 and 120.';
      }
    }
    return undefined;
  };

  const handleBlur = (field: keyof FormErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const validateAll = (): boolean => {
    const newErrors: FormErrors = {};
    const patientNameErr = validateField('patientName');
    if (patientNameErr) newErrors.patientName = patientNameErr;

    const phoneErr = validateField('phone');
    if (phoneErr) newErrors.phone = phoneErr;

    if (mode === 'full') {
      const relativeErr = validateField('relativeName');
      if (relativeErr) newErrors.relativeName = relativeErr;

      const ageErr = validateField('age');
      if (ageErr) newErrors.age = ageErr;
    }

    setErrors(newErrors);
    setTouched({ patientName: true, relativeName: true, phone: true, age: true });

    // Focus first invalid field
    if (newErrors.patientName && patientNameRef.current) {
      patientNameRef.current.focus();
    } else if (newErrors.phone && phoneRef.current) {
      phoneRef.current.focus();
    } else if (newErrors.relativeName && relativeNameRef.current) {
      relativeNameRef.current.focus();
    } else if (newErrors.age && ageRef.current) {
      ageRef.current.focus();
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);

    const isUnidentified = isUnknownName || !patientName.trim();
    const resolvedPatientName = isUnidentified ? 'Unknown patient' : patientName.trim();
    const resolvedRelativeName = relativeName.trim() || (isUnidentified ? 'Emergency Attendant' : 'Attendant');
    // The quick path intentionally does not collect or infer demographics.
    const isQuickEmergency = mode === 'quick';
    const resolvedAge = isQuickEmergency ? null : Number(patientAge);
    const resolvedGender = isQuickEmergency ? null : patientGender;
    const resolvedStation = location.selectedStationName || 'Bandra Station';

    try {
      const res = await api.login({
        role: 'patient',
        patientName: resolvedPatientName,
        relativeName: resolvedRelativeName,
        phone: phoneNumber.trim(),
        age: resolvedAge,
        gender: resolvedGender,
        bloodType: selectedBlood,
        nearestStation: resolvedStation,
        isUnidentified,
        isQuickIntake: isQuickEmergency,
      });

      const info: PatientInfo = {
        patientName: resolvedPatientName,
        relativeName: resolvedRelativeName,
        phone: phoneNumber.trim(),
        age: resolvedAge,
        gender: resolvedGender,
        bloodType: selectedBlood,
        nearestStation: resolvedStation,
        useGps: location.source === 'gps',
        userLat: location.coords?.lat,
        userLng: location.coords?.lng,
        accuracyMeters: location.accuracyMeters,
        locationSource: location.source,
        isUnidentified,
        isQuickEmergency,
        admissionId: res.admissionId || res.user.admissionId,
      };

      onLogin(info, res.user);
    } catch (err: any) {
      console.error('Patient login failed:', err);
      setServerError(err.message || 'Unable to connect to emergency server. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (hasError?: boolean, extra = '') =>
    `w-full px-4 rounded-xl border bg-white text-base font-semibold text-slate-900 placeholder:font-medium placeholder:text-slate-400 min-h-[52px] ${
      hasError ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
    } ${extra}`;
  const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';

  return (
    <div className="space-y-7">
      {/* Mode: quick vs full */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-2xl" role="group" aria-label="Intake type">
        <button
          type="button"
          onClick={() => setMode('quick')}
          aria-pressed={mode === 'quick'}
          className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px] ${
            mode === 'quick' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>{t.quickEmergencyTitle}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('full')}
          aria-pressed={mode === 'full'}
          className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px] ${
            mode === 'full' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Full details</span>
        </button>
      </div>

      {serverError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-rose-900"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{serverError}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 shrink-0 cursor-pointer min-h-[44px]"
          >
            Try again
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* 1 · Location */}
        <Step n={1} title="Where are you?" hint="We rank hospitals by distance from here.">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <select
              id="stationSelect"
              aria-label={t.selectStationLabel}
              value={location.selectedStationName}
              onChange={(e) => location.selectStationManually(e.target.value)}
              className={inputCls(false, 'flex-1')}
            >
              {WESTERN_LINE_STATIONS.map((station) => (
                <option key={station.id} value={station.name}>
                  {station.name} ({station.zone})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={location.requestGps}
              disabled={location.isLoading}
              className="px-4 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[52px] shrink-0"
            >
              <Navigation className={`w-4 h-4 ${location.isLoading ? 'animate-spin' : ''}`} />
              <span>{location.isLoading ? t.locationStatusFinding : t.useMyGps}</span>
            </button>
          </div>
          {location.statusText && (
            <div
              className={`px-3.5 py-2.5 rounded-xl text-sm flex items-center gap-2 ${
                location.isOutsideArea
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : location.source === 'gps'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {location.source === 'gps' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span className="font-medium">{location.statusText}</span>
            </div>
          )}
        </Step>

        {/* 2 · Patient */}
        <Step n={2} title="Who needs a bed?">
          <button
            type="button"
            onClick={onOpenScanner}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-amber-400 bg-amber-50/70 hover:bg-amber-50 text-left cursor-pointer min-h-[56px]"
          >
            <span className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <ScanLine className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-900">{t.autofillAadhaar}</span>
              <span className="block text-xs text-slate-600">You can edit every detail before sending.</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="patientNameInput" className="text-sm font-semibold text-slate-700">
                {t.patientNameLabel}
              </label>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !isUnknownName;
                  setIsUnknownName(nextVal);
                  if (nextVal) {
                    setPatientName('Unknown patient');
                    setErrors((prev) => ({ ...prev, patientName: undefined }));
                  } else {
                    setPatientName('');
                  }
                }}
                aria-pressed={isUnknownName}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors cursor-pointer min-h-[36px] ${
                  isUnknownName
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-300'
                }`}
              >
                {isUnknownName ? '✓ ' + t.unknownPatientChoice : t.unknownPatientChoice}
              </button>
            </div>
            <input
              id="patientNameInput"
              ref={patientNameRef}
              type="text"
              required={!isUnknownName}
              disabled={isUnknownName}
              aria-invalid={Boolean(errors.patientName)}
              aria-describedby={errors.patientName ? 'patientNameError' : undefined}
              placeholder={isUnknownName ? 'Marked as unknown patient' : t.patientNamePlaceholder}
              value={isUnknownName ? 'Unknown patient' : patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                if (errors.patientName) setErrors((prev) => ({ ...prev, patientName: undefined }));
              }}
              onBlur={() => handleBlur('patientName')}
              className={inputCls(Boolean(errors.patientName), isUnknownName ? 'bg-slate-50 italic opacity-80' : '')}
            />
            {errors.patientName && (
              <p id="patientNameError" role="alert" className="text-sm text-rose-600 font-semibold mt-1.5">
                {errors.patientName}
              </p>
            )}
          </div>

          <div>
            <span className={labelCls}>{t.bloodGroupLabel}</span>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {bloodOptions.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setSelectedBlood(b)}
                  aria-pressed={selectedBlood === b}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-colors cursor-pointer min-h-[48px] ${
                    b === "Don't know" ? 'col-span-2 sm:col-span-1 ' : ''
                  }${
                    selectedBlood === b
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {mode === 'full' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ageInput" className={labelCls}>
                  {t.ageLabel} (0–120)
                </label>
                <input
                  id="ageInput"
                  ref={ageRef}
                  type="number"
                  min="0"
                  max="120"
                  required
                  aria-invalid={Boolean(errors.age)}
                  aria-describedby={errors.age ? 'ageError' : undefined}
                  placeholder="e.g. 28"
                  value={patientAge}
                  onChange={(e) => {
                    setPatientAge(e.target.value);
                    if (errors.age) setErrors((prev) => ({ ...prev, age: undefined }));
                  }}
                  onBlur={() => handleBlur('age')}
                  className={inputCls(Boolean(errors.age))}
                />
                {errors.age && (
                  <p id="ageError" role="alert" className="text-sm text-rose-600 font-semibold mt-1.5">
                    {errors.age}
                  </p>
                )}
              </div>
              <div>
                <span className={labelCls}>{t.genderLabel}</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['Female', 'Male', 'Other'] as const).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setPatientGender(g)}
                      aria-pressed={patientGender === g}
                      className={`rounded-xl text-sm font-bold border transition-colors cursor-pointer min-h-[52px] ${
                        patientGender === g
                          ? 'bg-rose-50 border-rose-500 text-rose-700'
                          : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {g === 'Female' ? t.female : g === 'Male' ? t.male : t.other}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Step>

        {/* 3 · Contact */}
        <Step n={3} title="How can we reach you?" last>
          {mode === 'full' && (
            <div>
              <label htmlFor="relativeNameInput" className={labelCls}>
                {t.relativeNameLabel}
              </label>
              <input
                id="relativeNameInput"
                ref={relativeNameRef}
                type="text"
                required
                aria-invalid={Boolean(errors.relativeName)}
                aria-describedby={errors.relativeName ? 'relativeNameError' : undefined}
                placeholder={t.relativeNamePlaceholder}
                value={relativeName}
                onChange={(e) => {
                  setRelativeName(e.target.value);
                  if (errors.relativeName) setErrors((prev) => ({ ...prev, relativeName: undefined }));
                }}
                onBlur={() => handleBlur('relativeName')}
                className={inputCls(Boolean(errors.relativeName))}
              />
              {errors.relativeName && (
                <p id="relativeNameError" role="alert" className="text-sm text-rose-600 font-semibold mt-1.5">
                  {errors.relativeName}
                </p>
              )}
            </div>
          )}
          <div>
            <label htmlFor="phoneInput" className={labelCls}>
              {t.phoneLabel}
            </label>
            <input
              id="phoneInput"
              ref={phoneRef}
              type="tel"
              inputMode="tel"
              required
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'phoneError' : undefined}
              placeholder="e.g. 9820154321"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              onBlur={() => handleBlur('phone')}
              className={inputCls(Boolean(errors.phone))}
            />
            {errors.phone && (
              <p id="phoneError" role="alert" className="text-sm text-rose-600 font-semibold mt-1.5">
                {errors.phone}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-base sm:text-lg shadow-md transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 min-h-[60px]"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Connecting…</span>
              </>
            ) : (
              <>
                <span>{mode === 'quick' ? t.findBed1Tap : t.continueButton}</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </Step>
      </form>
    </div>
  );
};
