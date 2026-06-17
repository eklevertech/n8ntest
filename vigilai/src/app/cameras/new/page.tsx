"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationChannel, Severity } from "@/lib/types";

const ALL_CHANNELS: NotificationChannel[] = ["push", "email", "sms"];
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

export default function NewCameraPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rulesText, setRulesText] = useState(
    "Avisar si una persona toma mercancía y se dirige a la salida sin pasar por caja\nAvisar si alguien fuerza o salta el mostrador",
  );
  const [minConfidence, setMinConfidence] = useState(65);
  const [intervalSec, setIntervalSec] = useState(8);
  const [framesPerAnalysis, setFramesPerAnalysis] = useState(4);
  const [frameSpacingMs, setFrameSpacingMs] = useState(700);
  const [motionDetectionEnabled, setMotionDetectionEnabled] = useState(true);
  const [motionThreshold, setMotionThreshold] = useState(1.5);
  const [channels, setChannels] = useState<NotificationChannel[]>(["push"]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [minSeverity, setMinSeverity] = useState<Severity>("medium");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleChannel(c: NotificationChannel) {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function submit() {
    setError(null);
    setSaving(true);
    const rules = rulesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((description, i) => ({
        id: `rule_${i}`,
        description,
        minConfidence,
        enabled: true,
      }));

    const res = await fetch("/api/cameras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        location,
        rules,
        captureIntervalSec: intervalSec,
        framesPerAnalysis,
        frameSpacingMs,
        motionDetectionEnabled,
        motionThreshold,
        notifications: { channels, email, phone, minSeverity },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo crear la cámara.");
      return;
    }
    const { camera } = await res.json();
    router.push(`/cameras/${camera.id}`);
  }

  return (
    <>
      <h1>Nueva cámara</h1>
      <p className="sub">
        Define las reglas de vigilancia en lenguaje natural. La IA evaluará cada
        fotograma contra ellas.
      </p>

      {error && <div className="banner warn">{error}</div>}

      <div className="card" style={{ maxWidth: 640 }}>
        <label>Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tienda — Entrada principal"
        />

        <label>Ubicación</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Av. Central 123"
        />

        <label>Reglas (una por línea)</label>
        <textarea
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          style={{ minHeight: 110 }}
        />

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Confianza mínima para alertar (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Intervalo entre ciclos (seg)</label>
            <input
              type="number"
              min={2}
              value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Fotogramas por análisis (contexto temporal)</label>
            <input
              type="number"
              min={1}
              max={8}
              value={framesPerAnalysis}
              onChange={(e) => setFramesPerAnalysis(Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Separación entre fotogramas (ms)</label>
            <input
              type="number"
              min={200}
              max={3000}
              step={100}
              value={frameSpacingMs}
              onChange={(e) => setFrameSpacingMs(Number(e.target.value))}
            />
          </div>
        </div>
        <p className="meta" style={{ marginTop: 6 }}>
          La IA analiza varios fotogramas seguidos como una mini-secuencia de video
          para entender el movimiento (p.ej. tomar algo y dirigirse a la salida), no
          imágenes sueltas. Más fotogramas = más contexto, pero más coste por ciclo.
        </p>

        <div className="checkrow" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            id="motion"
            checked={motionDetectionEnabled}
            onChange={(e) => setMotionDetectionEnabled(e.target.checked)}
          />
          <label htmlFor="motion" style={{ margin: 0 }}>
            Pre-filtro de movimiento (solo llama a la IA si hay cambio en la escena)
          </label>
        </div>
        {motionDetectionEnabled && (
          <>
            <label>Umbral de movimiento (% de píxeles que cambian)</label>
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={motionThreshold}
              onChange={(e) => setMotionThreshold(Number(e.target.value))}
            />
            <p className="meta" style={{ marginTop: 6 }}>
              Más bajo = más sensible (analiza ante cambios pequeños). Valores típicos
              1–3%. Ahorra tokens evitando analizar escenas estáticas.
            </p>
          </>
        )}

        <label>Gravedad mínima para notificar</label>
        <select
          value={minSeverity}
          onChange={(e) => setMinSeverity(e.target.value as Severity)}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label>Canales de alerta</label>
        {ALL_CHANNELS.map((c) => (
          <div className="checkrow" key={c}>
            <input
              type="checkbox"
              id={`ch-${c}`}
              checked={channels.includes(c)}
              onChange={() => toggleChannel(c)}
            />
            <label htmlFor={`ch-${c}`} style={{ margin: 0 }}>
              {c}
            </label>
          </div>
        ))}

        {channels.includes("email") && (
          <>
            <label>Email de destino</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seguridad@empresa.com"
            />
          </>
        )}
        {channels.includes("sms") && (
          <>
            <label>Teléfono (E.164)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+14155550123"
            />
          </>
        )}

        <div style={{ marginTop: 20 }}>
          <button className="btn" onClick={submit} disabled={saving || !name.trim()}>
            {saving ? "Guardando…" : "Crear cámara"}
          </button>
        </div>
      </div>
    </>
  );
}
