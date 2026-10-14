import React, { useState } from 'react';
import { X, Camera, Upload, Sparkles, AlertCircle, RefreshCw, ScanLine, ShieldCheck } from 'lucide-react';
import { PatientInfo } from '../../types/bedlink';
import { ScannerCamera } from './scanner/ScannerCamera';
import { ScannerUpload } from './scanner/ScannerUpload';
import { ScannerResult } from './scanner/ScannerResult';
import { compressImage } from '../../utils/compressImage';
 
interface AadhaarScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: Partial<PatientInfo>) => void;
  language: string;
}
 
export interface ScannedAadhaarData {
  patientName: string | null;
  age: number | null;
  gender: 'Female' | 'Male' | 'Other' | null;
  relativeName: string | null;
  phone: string | null;
  bloodType: string | null;
  nearestStation: string | null;
  aadhaarNumberMasked: string | null;
  dob: string | null;
  address: string | null;
  isAadhaarDetected?: boolean;
}
 
// Sample test cards clearly marked as Demo
const SAMPLE_AADHAAR_DOCS = [
  {
    id: 'sample-1',
    title: 'Aadhaar Sample 1 (Demo - Bandra)',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    data: {
      patientName: 'Priya Shinde',
      age: 28,
      gender: 'Female' as const,
      relativeName: 'Vijay Shinde',
      phone: null,
      bloodType: null,
      nearestStation: 'Bandra Station',
      aadhaarNumberMasked: 'XXXX XXXX 4921',
      dob: '14/05/1998',
      address: 'Pali Hill, Bandra West, Mumbai 400050',
      isAadhaarDetected: true,
    },
  },
  {
    id: 'sample-2',
    title: 'Aadhaar Sample 2 (Demo - Borivali)',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
    data: {
      patientName: 'Rajesh Sharma',
      age: 48,
      gender: 'Male' as const,
      relativeName: 'Poonam Sharma',
      phone: null,
      bloodType: null,
      nearestStation: 'Borivali Station',
      aadhaarNumberMasked: 'XXXX XXXX 8832',
      dob: '22/09/1978',
      address: 'Shimpoli Road, Borivali West, Mumbai 400092',
      isAadhaarDetected: true,
    },
  },
];
 
export const AadhaarScannerModal: React.FC<AadhaarScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'samples'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedImagePreview, setScannedImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ScannedAadhaarData | null>(null);
 
  if (!isOpen) return null;
 
  const processImageScan = async (imageDataUrl: string, sampleData?: ScannedAadhaarData) => {
    if (isScanning) return; // ignore double taps while a scan is running
    setScanError(null);

    if (sampleData) {
      setScannedImagePreview(imageDataUrl);
      setExtractedData(sampleData);
      return;
    }

    setIsScanning(true);
    setScanStep('Optimizing image…');
    try {
      // 1) Shrink first (fast, local) so the upload is ~200 KB instead of several MB
      const compactImage = await compressImage(imageDataUrl);
      setScannedImagePreview(compactImage);
      setScanStep('Reading Aadhaar card…');

      // 2) The timeout only starts now, so image prep time is not counted against the scan
      const controller = new AbortController();
      // The server may try a second vision model after a slow provider timeout.
      // Keep the browser deadline longer than the server's 60-second budget.
      const timeoutId = setTimeout(() => controller.abort(), 70000);
      try {
        const res = await fetch('/api/scan-aadhaar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: compactImage }),
          signal: controller.signal,
        });

        // Don't assume JSON: proxies/rate-limiters can return plain text or HTML
        const raw = await res.text();
        let json: any = null;
        try {
          json = JSON.parse(raw);
        } catch {
          /* handled below */
        }
        if (!res.ok || !json?.success) {
          throw new Error(
            json?.error ||
              (res.status === 413
                ? 'Image is too large. Please retake the photo closer to the card.'
                : 'Aadhaar document scan could not be completed.')
          );
        }
        setExtractedData(json.data);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(
        err?.name === 'AbortError'
          ? 'Scan is taking too long. Check your connection and try again.'
          : err?.message || 'Unable to scan card. Please enter details manually.'
      );
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  const handleConfirm = (finalData: ScannedAadhaarData) => {
    onScanSuccess({
      patientName: finalData.patientName || '',
      age: finalData.age || undefined,
      gender: finalData.gender || 'Female',
      relativeName: finalData.relativeName || '',
      phone: finalData.phone || '',
      bloodType: finalData.bloodType || "Don't know",
      nearestStation: finalData.nearestStation || undefined,
    });
    handleReset();
    onClose();
  };
 
  const handleReset = () => {
    setExtractedData(null);
    setScannedImagePreview(null);
    setScanError(null);
    setIsScanning(false);
  };
 
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scannerModalTitle"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 id="scannerModalTitle" className="font-extrabold text-slate-900 text-base">
                Aadhaar Document Autofill
              </h3>
              <p className="text-xs text-slate-500">
                Processed in memory only • Number masked • Unverified fields stay empty
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
 
        {/* Privacy Notice Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Privacy Guarantee:</strong> Images and full numbers are never saved or logged. You will review all details before continuing.
          </span>
        </div>
 
        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {scanError && (
            <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}
 
          {isScanning && (
            <div className="p-6 bg-slate-50 rounded-2xl text-center space-y-2 border border-slate-200">
              <RefreshCw className="w-8 h-8 text-rose-600 animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-800">{scanStep}</div>
              <div className="text-[11px] text-slate-500">Extracting verified identity without guessing…</div>
            </div>
          )}
 
          {!extractedData && !isScanning && (
            <>
              {/* Tab Selector */}
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                    activeTab === 'camera'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Device Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                    activeTab === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('samples')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                    activeTab === 'samples'
                      ? 'bg-white text-amber-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Sample Cards</span>
                </button>
              </div>
 
              {activeTab === 'camera' && (
                <ScannerCamera onCapture={(img) => processImageScan(img)} isScanning={isScanning} />
              )}
 
              {activeTab === 'upload' && (
                <ScannerUpload
                  mode="upload"
                  samples={SAMPLE_AADHAAR_DOCS}
                  onSelectImage={(img) => processImageScan(img)}
                />
              )}
 
              {activeTab === 'samples' && (
                <ScannerUpload
                  mode="samples"
                  samples={SAMPLE_AADHAAR_DOCS}
                  onSelectImage={(img, sample) => processImageScan(img, sample)}
                />
              )}
            </>
          )}
 
          {extractedData && !isScanning && (
            <ScannerResult
              data={extractedData}
              previewUrl={scannedImagePreview}
              onConfirm={handleConfirm}
              onRescan={handleReset}
            />
          )}
        </div>
      </div>
    </div>
  );
};
