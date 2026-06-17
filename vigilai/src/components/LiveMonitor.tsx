"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DetectionResult } from "@/lib/detection";

type Source = "webcam" | "url";

interface AnalyzeResponse {
  result?: DetectionResult;
  alerted?: boolean;
  error?: string;
  code?: string;
}

const SEV_CLASS: Record<string, string> = {
  none: "sev-none",
  low: "sev-low",
  medium: "sev-medium",
  high: "sev-high",
  critical: "sev-critical",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Resolución reducida del pre-filtro de movimiento y umbral de diferencia por píxel.
const MOTION_W = 96;
const MOTION_H = 54;
const PIXEL_DIFF_THRESHOLD = 24; // sobre 0-255 en escala de grises

export function LiveMonitor({
  cameraId,
  intervalSec,
  framesPerAnalysis = 4,
  frameSpacingMs = 700,
  motionDetectionEnabled = true,
  motionThreshold = 1.5,
}: {
  cameraId: string;
  intervalSec: number;
  framesPerAnalysis?: number;
  frameSpacingMs?: number;
  motionDetectionEnabled?: boolean;
  motionThreshold?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevGrayRef = useRef<Uint8ClampedArray | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  const [source, setSource] = useState<Source>("webcam");
  const [videoUrl, setVideoUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<DetectionResult | null>(null);
  const [lastAlerted, setLastAlerted] = useState(false);
  const [status, setStatus] = useState<string>("Detenido");
  const [error, setError] = useState<string | null>(null);
  const [pushState, setPushState] = useState<string>("");
  const [lastMotion, setLastMotion] = useState<number | null>(null);
  const [stats, setStats] = useState({ analyzed: 0, skipped: 0 });

  const stopStream = useCallback(() => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  }, []);

  /** Captura un único fotograma del video como data URL JPEG, o null. */
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    // Limita el lado largo para reducir tokens de imagen.
    const scale = Math.min(1, 1280 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  /**
   * Pre-filtro de movimiento: dibuja el frame actual a baja resolución, lo pasa a
   * escala de grises y lo compara con el cuadro de referencia anterior. Devuelve el
   * % de píxeles que cambiaron por encima del umbral, o null si no se pudo medir.
   * Actualiza siempre la referencia para que el movimiento sea relativo al último chequeo.
   */
  const checkMotion = useCallback((): number | null => {
    const video = videoRef.current;
    const canvas = motionCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = MOTION_W;
    canvas.height = MOTION_H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, MOTION_W, MOTION_H);
    const { data } = ctx.getImageData(0, 0, MOTION_W, MOTION_H);
    const n = MOTION_W * MOTION_H;
    const gray = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      // Luminancia aproximada.
      gray[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
    }

    const prev = prevGrayRef.current;
    prevGrayRef.current = gray;
    if (!prev) return null; // primer cuadro: solo establece la referencia

    let changed = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(gray[i] - prev[i]) > PIXEL_DIFF_THRESHOLD) changed++;
    }
    return (changed / n) * 100;
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (busyRef.current) return; // evita solapamiento si la captura/IA tarda
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    busyRef.current = true;
    const n = Math.max(1, framesPerAnalysis);
    try {
      // Captura una ráfaga de N fotogramas separados frameSpacingMs (contexto temporal).
      const frames: string[] = [];
      for (let i = 0; i < n; i++) {
        const f = captureFrame();
        if (f) frames.push(f);
        if (i < n - 1) {
          setStatus(`Capturando secuencia… ${frames.length}/${n}`);
          await sleep(Math.max(100, frameSpacingMs));
        }
      }
      if (frames.length === 0) {
        busyRef.current = false;
        return;
      }

      setStatus(`Analizando secuencia (${frames.length} fotogramas)…`);
      setStats((s) => ({ ...s, analyzed: s.analyzed + 1 }));
      const res = await fetch(`/api/cameras/${cameraId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!res.ok) {
        setError(data.error || "Error de análisis");
        setStatus("Error");
      } else if (data.result) {
        setLast(data.result);
        setLastAlerted(Boolean(data.alerted));
        setError(null);
        setStatus(
          data.result.violationDetected
            ? data.alerted
              ? "⚠️ Violación detectada — alerta enviada"
              : "Violación detectada (por debajo del umbral)"
            : "Sin novedad",
        );
      }
    } catch (err) {
      setError((err as Error).message);
      setStatus("Error de red");
    } finally {
      busyRef.current = false;
    }
  }, [cameraId, captureFrame, framesPerAnalysis, frameSpacingMs]);

  /**
   * Un ciclo: si el pre-filtro de movimiento está activo, mide el cambio y solo
   * lanza el análisis por IA cuando supera el umbral (ahorra tokens en escenas
   * estáticas). El primer ciclo (force) siempre analiza para tener una lectura inicial.
   */
  const tick = useCallback(
    async (force = false) => {
      if (busyRef.current) return;
      const score = checkMotion();
      if (score !== null) setLastMotion(score);

      const shouldAnalyze =
        force || !motionDetectionEnabled || score === null || score >= motionThreshold;

      if (!shouldAnalyze) {
        setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
        setStatus(
          `Sin movimiento (${score!.toFixed(1)}% < ${motionThreshold}%) — análisis omitido`,
        );
        return;
      }
      await captureAndAnalyze();
    },
    [checkMotion, motionDetectionEnabled, motionThreshold, captureAndAnalyze],
  );

  const start = useCallback(async () => {
    setError(null);
    const video = videoRef.current;
    if (!video) return;

    try {
      if (source === "webcam") {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
      } else {
        stopStream();
        video.src = videoUrl;
        video.crossOrigin = "anonymous";
        video.loop = true;
      }
      await video.play();
    } catch (err) {
      setError(`No se pudo iniciar el video: ${(err as Error).message}`);
      return;
    }

    prevGrayRef.current = null;
    setStats({ analyzed: 0, skipped: 0 });
    setLastMotion(null);
    setRunning(true);
    setStatus("En vivo");
    // Primer ciclo inmediato (siempre analiza), luego por intervalos con pre-filtro.
    void tick(true);
    timerRef.current = setInterval(() => void tick(false), Math.max(2, intervalSec) * 1000);
  }, [source, videoUrl, intervalSec, tick, stopStream]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopStream();
    prevGrayRef.current = null;
    const video = videoRef.current;
    if (video) video.removeAttribute("src"), video.load();
    setRunning(false);
    setStatus("Detenido");
  }, [stopStream]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopStream();
    };
  }, [stopStream]);

  async function enablePush() {
    try {
      setPushState("Solicitando permiso…");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState("Permiso denegado");
        return;
      }
      const keyRes = await fetch("/api/push");
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        setPushState("Push en modo simulación (sin claves VAPID en el servidor)");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setPushState("✅ Notificaciones push activadas");
    } catch (err) {
      setPushState(`Error: ${(err as Error).message}`);
    }
  }

  return (
    <div className="card">
      <div className="video-wrap">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted />
        <div className="overlay">
          <span className={`status-dot ${running ? "live" : "idle"}`} />
          {status}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <canvas ref={motionCanvasRef} style={{ display: "none" }} />

      {error && (
        <div className="banner warn" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
          disabled={running}
          style={{ width: "auto" }}
        >
          <option value="webcam">Webcam</option>
          <option value="url">URL de video (MP4/HLS)</option>
        </select>
        {source === "url" && (
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://…/stream.mp4"
            disabled={running}
            style={{ flex: 1, minWidth: 220 }}
          />
        )}
        {!running ? (
          <button className="btn" onClick={start}>
            ▶ Iniciar monitoreo
          </button>
        ) : (
          <button className="btn danger" onClick={stop}>
            ■ Detener
          </button>
        )}
        <button className="btn secondary" onClick={enablePush} type="button">
          🔔 Activar push
        </button>
      </div>
      {pushState && (
        <p className="meta" style={{ marginTop: 8 }}>
          {pushState}
        </p>
      )}

      <p className="meta" style={{ marginTop: 8 }}>
        Pre-filtro de movimiento:{" "}
        {motionDetectionEnabled ? (
          <>
            activo (umbral {motionThreshold}%)
            {lastMotion !== null && <> · movimiento: {lastMotion.toFixed(1)}%</>}
          </>
        ) : (
          "desactivado"
        )}{" "}
        · analizados: {stats.analyzed} · omitidos: {stats.skipped}
      </p>

      {last && (
        <div className="card" style={{ marginTop: 14, background: "var(--panel-2)" }}>
          <div className="row spread">
            <strong>Último análisis</strong>
            <span className={SEV_CLASS[last.severity]}>
              {last.violationDetected ? "VIOLACIÓN" : "OK"} · {last.confidence}%
              {lastAlerted ? " · alertado" : ""}
            </span>
          </div>
          {last.ruleViolated && (
            <p style={{ margin: "8px 0 4px" }}>
              <strong>Regla:</strong> {last.ruleViolated}
            </p>
          )}
          <p className="muted" style={{ margin: 0 }}>
            {last.description}
          </p>
        </div>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
