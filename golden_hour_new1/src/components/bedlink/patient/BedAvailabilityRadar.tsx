import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Phone,
  ShieldCheck,
  Navigation,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Droplets,
  Bed,
  CheckCircle2,
  Building2,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react';
import { Hospital, BedCounts, PatientInfo } from '../../../types/bedlink';
import { WESTERN_LINE_STATIONS, WESTERN_STATIONS_MAP } from '../../../data/stations';
import { Translations } from '../../../i18n/translations';
import { calculateDistanceKm } from '../../../utils/geo';

interface BedAvailabilityRadarProps {
  selectedStation: string;
  setSelectedStation: (st: string) => void;
  userCoords: { lat: number; lng: number } | null;
  locationSource: 'gps' | 'station';
  onRequestGps: () => void;
  gpsLoading?: boolean;
  gpsStatusText?: string;
  isOutsideArea?: boolean;
  patientInfo: PatientInfo;
  hospitals: Hospital[];
  selectedPaymentMode: 'Cashless Insurance / PM-JAY' | 'Self-Pay / Cash';
  setSelectedPaymentMode: (mode: 'Cashless Insurance / PM-JAY' | 'Self-Pay / Cash') => void;
  requiredBedType: keyof BedCounts;
  setRequiredBedType: (val: keyof BedCounts) => void;
  emergencyType: string;
  setEmergencyType: (val: string) => void;
  onOpenHoldModal: (rankedList: Hospital[]) => void;
  onSelectFinalHospital: (hospital: Hospital, bay: string) => Promise<void>;
  isHoldingBed?: boolean;
  t: Translations;
}

export const BedAvailabilityRadar: React.FC<BedAvailabilityRadarProps> = ({
  selectedStation,
  setSelectedStation,
  userCoords,
  locationSource,
  onRequestGps,
  gpsLoading = false,
  gpsStatusText,
  patientInfo,
  hospitals,
  selectedPaymentMode,
  setSelectedPaymentMode,
  requiredBedType,
  setRequiredBedType,
  emergencyType,
  setEmergencyType,
  onOpenHoldModal,
  onSelectFinalHospital,
  isHoldingBed = false,
  t,
}) => {
  const [showAdvancedBedType, setShowAdvancedBedType] = useState(false);
  const [within2kmOnly, setWithin2kmOnly] = useState(false);
  const [expandedHospitalId, setExpandedHospitalId] = useState<string | null>(null);

  // Patient blood group awareness
  const hasKnownBlood =
    Boolean(patientInfo.bloodType) &&
    patientInfo.bloodType !== "Don't know" &&
    patientInfo.bloodType !== 'Unknown';

  const [bloodFilter] = useState<string>(
    hasKnownBlood ? patientInfo.bloodType : "Don't know"
  );

  // Mapping from emergency condition to recommended bed type
  const emergencyOptions = [
    { id: 'bleeding', label: t.emergencyBleeding, bed: 'trauma' as keyof BedCounts },
    { id: 'cardiac', label: t.emergencyCardiac, bed: 'icu' as keyof BedCounts },
    { id: 'breathing', label: t.emergencyBreathing, bed: 'vent' as keyof BedCounts },
    { id: 'head_injury', label: t.emergencyHeadInjury, bed: 'trauma' as keyof BedCounts },
    { id: 'burns', label: t.emergencyBurns, bed: 'burns' as keyof BedCounts },
    { id: 'other', label: t.emergencyOther, bed: 'general' as keyof BedCounts },
  ];

  const handleEmergencyChange = (id: string) => {
    const selected = emergencyOptions.find((o) => o.id === id);
    if (selected) {
      setEmergencyType(selected.id);
      setRequiredBedType(selected.bed);
    }
  };

  // Determine reference location for distances (GPS vs Station)
  const referenceCoords = useMemo(() => {
    if (locationSource === 'gps' && userCoords && typeof userCoords.lat === 'number' && typeof userCoords.lng === 'number') {
      return { lat: userCoords.lat, lng: userCoords.lng, isGps: true };
    }
    const stationData = WESTERN_STATIONS_MAP[selectedStation];
    if (stationData) {
      return { lat: stationData.lat, lng: stationData.lng, isGps: false };
    }
    return null;
  }, [locationSource, userCoords, selectedStation]);

  // Calculate real distances dynamically (never fall back to stale DB distanceKm), filter and rank hospitals
  const { rankedHospitals, autoWidened } = useMemo(() => {
    // 1. Calculate dynamic straight-line distance for every hospital
    const withDistance = hospitals.map((hosp) => {
      const hasValidCoords =
        referenceCoords !== null &&
        typeof hosp.lat === 'number' &&
        typeof hosp.lng === 'number' &&
        !isNaN(hosp.lat) &&
        !isNaN(hosp.lng);

      const distance = hasValidCoords
        ? calculateDistanceKm(referenceCoords.lat, referenceCoords.lng, hosp.lat, hosp.lng)
        : undefined;

      return {
        ...hosp,
        dynamicDistanceKm: distance,
      };
    });

    // 2. Filter by insurance / payment selection
    const paymentFiltered = withDistance.filter((h) => {
      if (selectedPaymentMode === 'Cashless Insurance / PM-JAY') {
        return h.acceptsInsurance || h.cashlessPMJAY;
      }
      return true; // Self-pay / cash accepted everywhere
    });

    // 3. Filter by required bed type (only hospitals with available beds)
    const bedFiltered = paymentFiltered.filter((h) => {
      const bedsCount = h.beds[requiredBedType] ?? 0;
      return bedsCount > 0;
    });

    // 4. Check proximity: if user selected within 2km or auto-widening
    let autoWidenTriggered = false;
    let radiusFiltered = bedFiltered;

    if (within2kmOnly) {
      const closeOnly = bedFiltered.filter(
        (h) => h.dynamicDistanceKm !== undefined && h.dynamicDistanceKm <= 2.0
      );
      if (closeOnly.length === 0 && bedFiltered.length > 0) {
        // Auto-widen to 6 km
        autoWidenTriggered = true;
        radiusFiltered = bedFiltered.filter(
          (h) => h.dynamicDistanceKm !== undefined && h.dynamicDistanceKm <= 6.0
        );
        if (radiusFiltered.length === 0) {
          radiusFiltered = bedFiltered; // Show nearest available
        }
      } else {
        radiusFiltered = closeOnly;
      }
    }

    // 5. Rank like dispatch: capability first, then travel time, data freshness, and current load.
    // A straight-line distance is deliberately labelled as an estimate, not a route promise.
    const sorted = [...radiusFiltered].sort((a, b) => {
      const score = (h: Hospital) => {
        const travelMinutes = (h.dynamicDistanceKm ?? 99) * 3.5;
        const freshnessPenalty = Math.min(h.freshMinutesAgo ?? 60, 60) * 0.7;
        const loadPenalty = Math.max(0, h.capacityPercent ?? 100) * 0.12;
        const bloodPenalty = hasKnownBlood && bloodFilter !== "Don't know" && !(h.bloodStock[bloodFilter] > 0) ? 8 : 0;
        return travelMinutes + freshnessPenalty + loadPenalty + bloodPenalty;
      };
      if (hasKnownBlood && bloodFilter && bloodFilter !== "Don't know") {
        const stockA = a.bloodStock[bloodFilter] || 0;
        const stockB = b.bloodStock[bloodFilter] || 0;
        if (stockA > 0 && stockB === 0) return -1;
        if (stockB > 0 && stockA === 0) return 1;
      }
      return score(a) - score(b);
    });

    // Keep choices focused: three very close options, otherwise the five best operational matches.
    const nearbyCount = sorted.filter((h) => (h.dynamicDistanceKm ?? Infinity) <= 2).length;
    return { rankedHospitals: sorted.slice(0, nearbyCount > 0 ? 3 : 5), autoWidened: autoWidenTriggered };
  }, [
    hospitals,
    referenceCoords,
    selectedPaymentMode,
    requiredBedType,
    within2kmOnly,
    hasKnownBlood,
    bloodFilter,
  ]);

  const toggleExpand = (id: string) => {
    setExpandedHospitalId((prev) => (prev === id ? null : id));
  };

  const getBedLabel = (type: keyof BedCounts) => {
    switch (type) {
      case 'icu': return 'ICU (Intensive Care)';
      case 'trauma': return 'Trauma Bay (Resuscitation)';
      case 'vent': return 'Ventilator (Mechanical)';
      case 'oxygen': return 'Oxygen Bed (HDU)';
      case 'burns': return 'Burns Unit';
      case 'general': return 'General Ward';
    }
  };

  return (
    <div className="grid xl:grid-cols-[24rem_minmax(0,1fr)] gap-5 xl:gap-7 items-start">
      {/* Left: what you need (stays in view while scrolling results) */}
      <div className="space-y-5 xl:sticky xl:top-24">
      {/* Header section with location indicator */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                {t.emergencyNetwork}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-300">
                {t.sampleBedCountsNote}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              {t.triageRadarTitle}
            </h2>
          </div>

          {/* Location button & status */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRequestGps}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200 transition-colors cursor-pointer min-h-[44px]"
            >
              <Navigation className={`w-4 h-4 text-blue-600 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>{gpsLoading ? t.locationStatusFinding : t.useMyGps}</span>
            </button>
          </div>
        </div>

        {/* Distance Origin Banner */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">
              {referenceCoords?.isGps
                ? t.distancesFromGps
                : `${t.distancesFromStation} ${selectedStation}`}
              :
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              {referenceCoords
                ? `${referenceCoords.lat.toFixed(4)}, ${referenceCoords.lng.toFixed(4)}`
                : 'distance unknown'}
            </span>
          </div>

          {/* Station selector fallback */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium hidden sm:inline">Station:</span>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
            >
              {WESTERN_LINE_STATIONS.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {gpsStatusText && (
          <div className="text-xs text-slate-600 px-1 font-medium">
            {gpsStatusText}
          </div>
        )}
      </div>

      {/* Unified Emergency & Payment Controls */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6">
          {/* Question 1: What kind of emergency? */}
          <div className="space-y-2">
            <label className="block font-display text-lg font-bold text-slate-900 ">
              {t.whatKindOfEmergency}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
              {emergencyOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleEmergencyChange(opt.id)}
                  className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all cursor-pointer min-h-[44px] flex items-center justify-between ${
                    emergencyType === opt.id
                      ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="leading-snug">{opt.label}</span>
                  {emergencyType === opt.id && (
                    <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 ml-1.5" />
                  )}
                </button>
              ))}
            </div>

            {/* Advanced Bed Type Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedBedType(!showAdvancedBedType)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer py-1"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{t.advancedBedTypeToggle}</span>
                {showAdvancedBedType ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvancedBedType && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl mt-2 space-y-2 text-xs">
                  <div className="font-bold text-slate-700">{t.chooseBedTypeYourself}:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(['icu', 'trauma', 'vent', 'oxygen', 'burns', 'general'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRequiredBedType(type)}
                        className={`p-2 rounded-xl text-center text-xs font-bold border transition-colors cursor-pointer min-h-[38px] ${
                          requiredBedType === type
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {getBedLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Question 2: How will you pay? */}
          <div className="space-y-2">
            <label className="block font-display text-lg font-bold text-slate-900 ">
              {t.howWillYouPay}
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedPaymentMode('Cashless Insurance / PM-JAY')}
                className={`w-full p-3.5 rounded-2xl text-left border transition-all cursor-pointer min-h-[44px] flex items-start gap-3 ${
                  selectedPaymentMode === 'Cashless Insurance / PM-JAY'
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                    {t.paymentCashless}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t.paymentCashlessDesc}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMode('Self-Pay / Cash')}
                className={`w-full p-3.5 rounded-2xl text-left border transition-all cursor-pointer min-h-[44px] flex items-start gap-3 ${
                  selectedPaymentMode === 'Self-Pay / Cash'
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                    {t.paymentSelfPay}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t.paymentSelfPayDesc}
                  </div>
                </div>
              </button>
            </div>

            {/* Proximity range toggle */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">{t.proximityRange}:</span>
              <button
                type="button"
                onClick={() => setWithin2kmOnly(!within2kmOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer min-h-[38px] ${
                  within2kmOnly
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {within2kmOnly ? '✓ ' + t.within2km : t.within2km}
              </button>
            </div>
          </div>
        </div>

        {/* Blood group status notice */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="text-slate-600">
            {hasKnownBlood ? (
              <span>
                Prioritizing facilities with stock of{' '}
                <strong className="text-rose-600">{patientInfo.bloodType}</strong>
              </span>
            ) : (
              <span className="text-slate-500 italic">
                {t.bloodGroupUnknownNotice}
              </span>
            )}
          </div>
          <div className="text-slate-500 font-semibold">
            Target Bed: <strong className="text-slate-900">{getBedLabel(requiredBedType)}</strong>
          </div>
        </div>
      </div>

      </div>

      {/* Right: ranked hospitals */}
      <div className="space-y-5 min-w-0">
      {/* Auto-widened notice if applicable */}
      {autoWidened && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-2 text-xs text-amber-900 font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t.autoWidenedNotice}</span>
        </div>
      )}

      {/* Multi-Hospital Hold Banner */}
      <div className="gh-hero gh-accent-red p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-400/20">
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Simultaneous Hold (Top 3 Ranked)</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold">
              {t.simultaneousHoldTitle}
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              {t.simultaneousHoldDesc}
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              disabled={rankedHospitals.length === 0}
              onClick={() => onOpenHoldModal(rankedHospitals)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-lg  transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[48px]"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>{t.holdTop3Button}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hospital Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
              {rankedHospitals.length} Best nearby matches for this location
            </h3>
          </div>
        </div>

        {rankedHospitals.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <h4 className="font-extrabold text-slate-900 text-base">{t.noHospitalsMatched}</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              No nearby hospital has a free {getBedLabel(requiredBedType)} bed matching these choices. Try a different payment option or call 108 for dispatch support.
            </p>
            <button
              type="button"
              onClick={() => {
                setWithin2kmOnly(false);
                setSelectedPaymentMode('Self-Pay / Cash');
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer min-h-[44px]"
            >
              Widen search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {rankedHospitals.map((hosp, index) => {
              const isExpanded = expandedHospitalId === hosp.id;
              const bedCount = hosp.beds[requiredBedType] ?? 0;
              const bloodUnits = hasKnownBlood ? hosp.bloodStock[bloodFilter] || 0 : null;

              return (
                <div
                  key={hosp.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  {/* Card Header with clean Hospital Emblem */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          hosp.isGovernment
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-display font-extrabold text-slate-900 text-xl leading-tight">
                              {hosp.name}
                            </h4>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full text-white ${index === 0 ? 'bg-rose-600' : 'bg-slate-900'}`}>{index === 0 ? 'Best match' : `#${index + 1}`}</span>
                            {hosp.isGovernment && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                Govt / Municipal
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{hosp.address || hosp.stationVicinity}</span>
                          </p>
                        </div>
                      </div>

                      {/* Distance Badge: strictly dynamicDistanceKm or "distance unknown" */}
                      <div className="text-right shrink-0">
                        <div className="font-display text-2xl font-extrabold text-rose-600 tabular-nums">
                          {hosp.dynamicDistanceKm !== undefined
                            ? `~${hosp.dynamicDistanceKm} km`
                            : 'distance unknown'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {hosp.dynamicDistanceKm !== undefined ? `~${Math.max(1, Math.round(hosp.dynamicDistanceKm * 3.5))} min travel estimate` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Freshness / Verification Banner */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className={`text-[11px] font-semibold flex items-center gap-1 ${hosp.isStale ? 'text-amber-700' : 'text-emerald-700'}`}>
                        <span className={`w-2 h-2 rounded-full ${hosp.isStale ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                        <span>{hosp.freshMinutesAgo} min ago • {hosp.capacityPercent}% occupied</span>
                      </span>
                      {hosp.acceptsInsurance ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Cashless &amp; PM-JAY</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          Cash Billing
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body: High-need bed availability */}
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-rose-700 ">
                            Needed Bed: {requiredBedType.toUpperCase()}
                          </div>
                          <div className="font-display text-3xl font-extrabold text-rose-950 mt-0.5 leading-none">
                            {bedCount} {t.freeBeds}
                          </div>
                        </div>
                        <Bed className="w-6 h-6 text-rose-600 shrink-0" />
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-slate-600 ">
                            {hasKnownBlood ? `${patientInfo.bloodType} Blood Bank` : 'Blood Bank'}
                          </div>
                          <div className="font-display text-3xl font-extrabold text-slate-900 mt-0.5 leading-none">
                            {hasKnownBlood && bloodUnits !== null
                              ? `${bloodUnits} Units`
                              : 'Stock on call'}
                          </div>
                        </div>
                        <Droplets className="w-6 h-6 text-rose-500 shrink-0" />
                      </div>
                    </div>

                    {/* Expand Breakdown Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(hosp.id)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer min-h-[38px]"
                    >
                      <span>
                        {isExpanded ? 'Hide Full Bed & Specialist Breakdown' : 'Show All 6 Bed Types, Specialists & TPAs'}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                        {/* 6 Bed Types Grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-xs">
                          <div className="p-2 rounded-xl bg-purple-50 border border-purple-200">
                            <div className="text-[10px] font-bold text-purple-700">ICU</div>
                            <div className="text-xs font-black text-purple-950">{hosp.beds.icu}</div>
                          </div>
                          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                            <div className="text-[10px] font-bold text-rose-700">Trauma</div>
                            <div className="text-xs font-black text-rose-950">{hosp.beds.trauma}</div>
                          </div>
                          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200">
                            <div className="text-[10px] font-bold text-blue-700">Vent</div>
                            <div className="text-xs font-black text-blue-950">{hosp.beds.vent}</div>
                          </div>
                          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                            <div className="text-[10px] font-bold text-emerald-700">Oxygen</div>
                            <div className="text-xs font-black text-emerald-950">{hosp.beds.oxygen}</div>
                          </div>
                          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                            <div className="text-[10px] font-bold text-amber-700">Burns</div>
                            <div className="text-xs font-black text-amber-950">{hosp.beds.burns}</div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                            <div className="text-[10px] font-bold text-slate-600">General</div>
                            <div className="text-xs font-black text-slate-800">{hosp.beds.general}</div>
                          </div>
                        </div>

                        {/* Specialists on call */}
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                          <div>
                            <span className="font-bold text-slate-700">On-Duty Specialists: </span>
                            <span className="text-slate-600">{hosp.specialists.join(' • ')}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Empaneled TPAs: </span>
                            <span className="text-slate-600">{hosp.insuranceProviders.join(', ')}</span>
                            {hosp.tpaDeskPhone && (
                              <span className="font-mono text-slate-500 ml-1">(Desk: {hosp.tpaDeskPhone})</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Row: Direct Call and 2-Min Hold */}
                    <div className="flex flex-col sm:flex-row items-center justify-between pt-2 border-t border-slate-100 gap-2">
                      <a
                        href={`tel:${hosp.phone}`}
                        aria-label={`Call ${hosp.name} emergency desk`}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-600" />
                        <span>{hosp.phone}</span>
                      </a>

                      <button
                        type="button"
                        disabled={isHoldingBed}
                        onClick={() => onSelectFinalHospital(hosp, `${requiredBedType.toUpperCase()} Bay #01`)}
                        className="w-full sm:w-auto sm:min-w-[15rem] px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{isHoldingBed ? 'Reserving…' : t.reserveBed2Min}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
