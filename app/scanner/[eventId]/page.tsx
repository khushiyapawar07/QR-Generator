/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, use, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type CheckinResult =
  | "VALID_CHECKED_IN"
  | "ALREADY_USED"
  | "INVALID_QR"
  | "EVENT_INACTIVE"
  | "ATTENDEE_BLOCKED";

interface CheckinResponse {
  success: boolean;
  result: CheckinResult;
  message?: string;
  attendee?: {
    name: string;
    company?: string;
    checkedInAt?: string;
  };
}

export default function ScannerEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  const [token, setToken] = useState("");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingCameraScan, setIsProcessingCameraScan] = useState(false);
  const processingRef = useRef(false);
  const scannerElementId = "gateqr-scanner";

  async function startCameraScanner() {
    if (isScanning) return;
    setScannerError(null);
    const scanner = new Html5Qrcode(scannerElementId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText) => {
          if (processingRef.current) return;
          const qrToken = decodedText.trim();
          if (!qrToken) return;
          processingRef.current = true;
          setIsProcessingCameraScan(true);
          await stopCameraScanner();
          await handleCheckin(qrToken);
          setIsProcessingCameraScan(false);
          processingRef.current = false;
        },
        () => {
          // Ignore per-frame decode failures.
        },
      );
      (window as Window & { __gateqrScanner?: Html5Qrcode }).__gateqrScanner = scanner;
      setIsScanning(true);
      setScannerReady(true);
    } catch {
      setScannerError("Camera access failed. Allow permission and try again.");
    }
  }

  async function stopCameraScanner() {
    const scanner = (window as Window & { __gateqrScanner?: Html5Qrcode }).__gateqrScanner;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch {
      // Ignore cleanup errors.
    } finally {
      (window as Window & { __gateqrScanner?: Html5Qrcode }).__gateqrScanner = undefined;
      setIsScanning(false);
      processingRef.current = false;
    }
  }

  async function handleCheckin(rawToken: string) {
    const qrToken = rawToken.trim();
    if (!qrToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, qrToken }),
      });
      const data = (await res.json()) as CheckinResponse;
      setResult(data);
      setToken("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void startCameraScanner();
    return () => {
      void stopCameraScanner();
    };
    // Intentionally run once on page load/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await handleCheckin(token);
  }

  const cardClass =
    result?.result === "VALID_CHECKED_IN"
      ? "bg-green-50 border-green-500"
      : result?.result === "ALREADY_USED"
        ? "bg-amber-50 border-amber-500"
        : "bg-rose-50 border-rose-500";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Gate Scanner</h1>
        <p className="text-sm text-slate-600">Event ID: {eventId}</p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-3 p-5">
        <label className="block text-sm font-medium text-slate-700">Scanner Camera</label>
        <div id={scannerElementId} className="overflow-hidden rounded-xl border bg-black/5" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startCameraScanner}
            disabled={isScanning || isProcessingCameraScan}
            className="btn-primary disabled:opacity-60"
          >
            {isScanning ? "Camera Running" : scannerReady ? "Scan Next QR" : "Start Camera Scanner"}
          </button>
          <button
            type="button"
            onClick={stopCameraScanner}
            disabled={!isScanning || isProcessingCameraScan}
            className="btn-secondary disabled:opacity-60"
          >
            Stop Camera
          </button>
        </div>
        {scannerError && <p className="text-sm text-rose-600">{scannerError}</p>}
      </form>

      <form onSubmit={onSubmit} className="card space-y-3 p-5">
        <label className="block text-sm font-medium text-slate-700">Manual fallback (if camera fails)</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="input"
          placeholder="gqr_live_..."
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-primary disabled:opacity-60"
        >
          {loading ? "Checking..." : "Validate Entry"}
        </button>
      </form>

      {result && (
        <div className={`rounded-xl border-2 p-5 shadow-sm ${cardClass}`}>
          <p className="text-xl font-bold text-slate-900">{result.result.replaceAll("_", " ")}</p>
          {result.message && <p className="mt-1 text-sm text-slate-700">{result.message}</p>}
          {result.attendee && (
            <div className="mt-3 space-y-1 text-sm text-slate-800">
              <p>Name: {result.attendee.name}</p>
              <p>Company: {result.attendee.company ?? "-"}</p>
              <p>First Check-in: {result.attendee.checkedInAt ?? "-"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
