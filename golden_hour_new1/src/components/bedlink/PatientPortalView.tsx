import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { PatientInfo, Hospital, EmergencyCase, BedCounts } from '../../types/bedlink';
import { TRANSLATIONS, LanguageCode } from '../../i18n/translations';
import { BedAvailabilityRadar } from './patient/BedAvailabilityRadar';
import { EmergencyTracker } from './patient/EmergencyTracker';
import { MultiHospitalHoldModal } from './patient/MultiHospitalHoldModal';
import { EmergencyCallBar } from '../common/EmergencyCallBar';
import { useLocation } from '../../hooks/useLocation';

interface PatientPortalViewProps {
  patientInfo: PatientInfo;
  hospitals: Hospital[];
  emergencyCase: EmergencyCase | null;
  activeTab: 'radar' | 'tracker';
  setActiveTab: (tab: 'radar' | 'tracker') => void;
  onConfirmBedReservation: (
    hospital: Hospital,
    bay: string,
    insuranceMode: string,
    bedType: keyof BedCounts
  ) => Promise<void>;
  onCancelHold: (caseId: string) => void;
  language: LanguageCode;
}

export const PatientPortalView: React.FC<PatientPortalViewProps> = ({
  patientInfo,
  hospitals,
  emergencyCase,
  activeTab,
  setActiveTab,
  onConfirmBedReservation,
  onCancelHold,
  language,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  // Use the location hook initialized with patient's login station
  const location = useLocation(patientInfo.nearestStation || 'Bandra Station');

  // Emergency selection & bed type recommendation
  const [emergencyType, setEmergencyType] = useState('cardiac');
  const [requiredBedType, setRequiredBedType] = useState<keyof BedCounts>('icu');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'Cashless Insurance / PM-JAY' | 'Self-Pay / Cash'>(
    'Cashless Insurance / PM-JAY'
  );

  // Multi-hospital hold state
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [rankedListForModal, setRankedListForModal] = useState<Hospital[]>([]);
  const [slaSeconds, setSlaSeconds] = useState(120);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [isHoldingBed, setIsHoldingBed] = useState(false);

  // 2-minute SLA countdown timer
  useEffect(() => {
    let timer: any;
    if (isHoldModalOpen && slaSeconds > 0) {
      timer = setInterval(() => {
        setSlaSeconds((s) => Math.max(0, s - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isHoldModalOpen, slaSeconds]);

  // Show notice when 2-minute SLA countdown reaches 0
  useEffect(() => {
    if (isHoldModalOpen && slaSeconds === 0) {
      setHoldError('Hold window expired, please search again.');
    }
  }, [isHoldModalOpen, slaSeconds]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const handleOpenHoldModal = (ranked: Hospital[]) => {
    setHoldError(null);
    setRankedListForModal(ranked);
    setSlaSeconds(120);
    setIsHoldModalOpen(true);
  };

  const handleSelectFinalHospital = async (hospital: Hospital, bay: string) => {
    if (isHoldModalOpen && slaSeconds <= 0) {
      setHoldError('Hold window expired, please search again.');
      return;
    }
    setHoldError(null);
    setIsHoldingBed(true);
    try {
      await onConfirmBedReservation(hospital, bay, selectedPaymentMode, requiredBedType);
      setIsHoldModalOpen(false);
      setActiveTab('tracker');
    } catch (err: any) {
      setHoldError(err?.message || 'Unable to reserve emergency bed. Please try another hospital.');
    } finally {
      setIsHoldingBed(false);
    }
  };

  return (
    <div className="space-y-6">
      {holdError && !isHoldModalOpen && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-900 font-bold"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{holdError}</span>
          </div>
          <button
            type="button"
            onClick={() => setHoldError(null)}
            aria-label="Dismiss error"
            className="p-1 text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'radar' && (
        <BedAvailabilityRadar
          selectedStation={location.selectedStationName}
          setSelectedStation={location.selectStationManually}
          userCoords={
            location.coords ||
            (patientInfo.userLat && patientInfo.userLng
              ? { lat: patientInfo.userLat, lng: patientInfo.userLng }
              : null)
          }
          locationSource={location.source}
          onRequestGps={location.requestGps}
          gpsLoading={location.isLoading}
          gpsStatusText={location.statusText}
          isOutsideArea={location.isOutsideArea}
          patientInfo={patientInfo}
          hospitals={hospitals}
          selectedPaymentMode={selectedPaymentMode}
          setSelectedPaymentMode={setSelectedPaymentMode}
          requiredBedType={requiredBedType}
          setRequiredBedType={setRequiredBedType}
          emergencyType={emergencyType}
          setEmergencyType={setEmergencyType}
          onOpenHoldModal={handleOpenHoldModal}
          onSelectFinalHospital={handleSelectFinalHospital}
          isHoldingBed={isHoldingBed}
          t={t}
        />
      )}

      {activeTab === 'tracker' && (
        <EmergencyTracker
          emergencyCase={emergencyCase}
          patientInfo={patientInfo}
          selectedPaymentMode={selectedPaymentMode}
          onCancelHold={onCancelHold}
          onGoToRadar={() => setActiveTab('radar')}
          t={t}
        />
      )}

      {/* Persistent Call 108 / Call 112 bar */}
      <EmergencyCallBar t={t} showDisclaimer={true} />

      {/* Multi-Hospital Hold Modal */}
      <MultiHospitalHoldModal
        isOpen={isHoldModalOpen}
        onClose={() => setIsHoldModalOpen(false)}
        patientInfo={patientInfo}
        slaSeconds={slaSeconds}
        formatTimer={formatTimer}
        selectedPaymentMode={selectedPaymentMode}
        setSelectedPaymentMode={setSelectedPaymentMode}
        rankedHospitals={rankedListForModal}
        onSelectFinalHospital={handleSelectFinalHospital}
        holdError={holdError}
        isHolding={isHoldingBed}
        t={t}
      />
    </div>
  );
};
