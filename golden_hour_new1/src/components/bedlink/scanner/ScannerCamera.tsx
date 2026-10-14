import React, { useRef, useState, useEffect } from 'react';
import { Camera, SwitchCamera, AlertCircle, RefreshCw } from 'lucide-react';

interface ScannerCameraProps {
  onCapture: (imageDataUrl: string) => void;
  isScanning: boolean;
}

export const ScannerCamera: React.FC<ScannerCameraProps> = ({ onCapture, isScanning }) => {
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      // Clean up previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }

      setCameraError(null);

      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setCameraError(
          'Browser security restricts camera access to HTTPS or localhost. Please use the Upload Photo or Sample Cards tab.'
        );
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera device is not available on this browser. Please use the Upload tab.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        // Best-effort: ask for continuous autofocus so card text is sharp (ignored where unsupported)
        try {
          const track = stream.getVideoTracks()[0];
          const caps: any = track.getCapabilities?.() ?? {};
          if (caps.focusMode?.includes?.('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
          }
        } catch {
          /* not supported - fine */
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        if (isMounted) {
          let msg = 'Unable to access camera device.';
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = 'Camera permission denied. Please allow camera permissions or upload an image file.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg = 'No video camera detected on your device.';
          }
          setCameraError(msg);
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraFacing]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Camera not producing frames yet -> capturing now would send a black image and the scan would fail
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera is still starting. Wait a second and tap capture again.');
      setTimeout(() => setCameraError(null), 2500);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Full-resolution frame; the modal shrinks it before upload
    onCapture(canvas.toDataURL('image/jpeg', 0.92));
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
        {cameraError ? (
          <div className="p-6 text-center text-slate-300 space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-xs font-semibold">{cameraError}</p>
            <p className="text-[11px] text-slate-400">
              You can switch to the <strong>Upload</strong> or <strong>Sample Cards</strong> tab above.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Overlay target frame */}
            <div className="absolute inset-6 border-2 border-dashed border-rose-500/80 rounded-xl pointer-events-none flex flex-col justify-between p-3">
              <div className="flex justify-between items-center text-[10px] text-white/80 font-bold bg-slate-900/60 px-2 py-0.5 rounded backdrop-blur-xs w-fit">
                <span>Align Aadhaar Card within frame</span>
              </div>
              <div className="text-[10px] text-center text-white/70 font-medium bg-slate-900/50 py-0.5 rounded">
                Keep card flat, clear of shadows &amp; glare
              </div>
            </div>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleCameraFacing}
          disabled={Boolean(cameraError) || isScanning}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer min-h-[44px]"
        >
          <SwitchCamera className="w-3.5 h-3.5" />
          <span>Flip ({cameraFacing === 'environment' ? 'Back' : 'Front'})</span>
        </button>

        <button
          type="button"
          onClick={handleCapture}
          disabled={Boolean(cameraError) || isScanning}
          className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Scanning Card…</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Capture &amp; Read Aadhaar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
