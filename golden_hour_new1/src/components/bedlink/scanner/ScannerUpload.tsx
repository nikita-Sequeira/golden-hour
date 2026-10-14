import React, { useRef, useState } from 'react';
import { Upload, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { ScannedAadhaarData } from '../AadhaarScannerModal';
import { compressBlob } from '../../../utils/compressImage';

interface SampleDoc {
  id: string;
  title: string;
  image: string;
  data: ScannedAadhaarData;
}

interface ScannerUploadProps {
  onSelectImage: (imageDataUrl: string, sampleData?: ScannedAadhaarData) => void;
  samples: SampleDoc[];
  mode: 'upload' | 'samples';
}

export const ScannerUpload: React.FC<ScannerUploadProps> = ({
  onSelectImage,
  samples,
  mode,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isPreparing, setIsPreparing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    // Phone photos are routinely 4-12 MB, so we allow big files here and shrink them
    // in the browser. (The old 3 MB check rejected almost every real camera photo.)
    const MAX_RAW_BYTES = 25 * 1024 * 1024;
    const looksLikeImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!looksLikeImage) {
      setUploadError('Please choose an image file (JPEG, PNG, WEBP or HEIC).');
      input.value = '';
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      setUploadError('Selected file is larger than 25 MB. Please choose a smaller photo.');
      input.value = '';
      return;
    }

    setIsPreparing(true);
    try {
      const compact = await compressBlob(file); // EXIF-rotated, ~1400px JPEG
      onSelectImage(compact);
    } catch {
      setUploadError(
        'This image could not be opened. If it is a HEIC photo, change the camera format to "Most Compatible" or take a screenshot of it and upload that.'
      );
    } finally {
      setIsPreparing(false);
      input.value = ''; // allows re-selecting the same file
    }
  };

  if (mode === 'samples') {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-900">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Click any pre-verified Aadhaar card to test instant zero-hallucination auto-fill:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {samples.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectImage(s.image, s.data)}
              className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-amber-400 hover:shadow-xs transition-all text-left space-y-1.5 cursor-pointer group min-h-[44px]"
            >
              <div className="w-full h-24 bg-slate-100 rounded-xl overflow-hidden relative">
                <img
                  src={s.image}
                  alt={s.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/80 text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              </div>
              <div className="text-xs font-bold text-slate-800 line-clamp-1">{s.title}</div>
              <div className="text-[10px] text-slate-500 font-mono">
                {s.data.aadhaarNumberMasked}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {uploadError && (
        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <div
        onClick={() => !isPreparing && fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 hover:border-rose-500 rounded-3xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-rose-50/20 transition-all space-y-3"
      >
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">Upload Aadhaar Photo / Scan</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Any photo up to 25 MB (auto-resized for speed). Cards are processed in memory only and never stored.
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-xs cursor-pointer min-h-[44px]"
        >
          {isPreparing ? 'Preparing image…' : 'Select File from Device'}
        </button>
      </div>
    </div>
  );
};
