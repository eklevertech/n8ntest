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

export function LiveMonitor({
  cameraId,
  intervalSec,
}: {
  cameraId: string;
  intervalSec: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const stopStream = useCallback(() => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (busyRef.current) return; // evita solapamiento si la IA tarda
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    // Limita el lado largo para reducir tokens de imagen.
    const scale = Math.min(1, 1280 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = canvas.toDataURL("image/jpeg", 0.7);

    busyRef.current = true;
    setStatus("Analizando…");
    try {
      const res = await fetch(`/api/cameras/${cameraId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame }),
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
  }, [cameraId]);

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

    setRunning(true);
    setStatus("En vivo");
    // Primer análisis inmediato, luego en intervalos.
    void captureAndAnalyze();
    timerRef.current = setInterval(captureAndAnalyze, Math.max(2, intervalSec) * 1000);
  }, [source, videoUrl, intervalSec, captureAndAnalyze, stopStream]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stopStream();
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
