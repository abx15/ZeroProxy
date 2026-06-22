'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

interface FaceCameraProps {
  onCapture: (imageBase64: string) => void;
  isProcessing?: boolean;
  mode?: 'register' | 'verify';
}

export function FaceCamera({ onCapture, isProcessing = false, mode = 'register' }: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startCamera() {
      try {
        setError(null);
        setIsCameraReady(false);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        activeStream = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setError('Unable to access camera. Please check camera permissions.');
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      // Set canvas dimensions to match video stream
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;

      // Draw the current video frame on the canvas
      context.drawImage(video, 0, 0, width, height);

      // Convert to base64 jpeg
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);
      onCapture(imageBase64);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-primary/30 shadow-lg bg-slate-900 flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center text-center p-4 text-red-400 gap-2">
            <AlertTriangle className="w-10 h-10" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : !isCameraReady ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Spinner size="md" />
            <p className="text-xs font-medium">Starting camera...</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            />
            {/* Pulsing Target Overlay */}
            <div className="absolute inset-4 rounded-full border-2 border-dashed border-primary/50 pointer-events-none animate-pulse" />

            {/* Scanning Laser Line */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-scan top-0 pointer-events-none" />
          </>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
            <Spinner size="md" />
            <p className="text-xs font-semibold tracking-wide uppercase">
              {mode === 'register' ? 'Registering face...' : 'Verifying face...'}
            </p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {isCameraReady && !error && !isProcessing && (
        <button
          onClick={handleCapture}
          className="zp-btn-primary flex items-center gap-2 px-6"
        >
          <Camera className="w-4 h-4" />
          Capture & Register
        </button>
      )}
    </div>
  );
}
