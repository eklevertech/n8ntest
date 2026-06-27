"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<PlanId>("free");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, orgName, email, password, plan }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo crear la cuenta.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="authbox">
      <h1>Crear cuenta</h1>
      <p className="sub">
        Crea tu organización y empieza a monitorear cámaras con IA.
      </p>
      {error && <div className="banner warn">{error}</div>}
      <form className="card" onSubmit={submit}>
        <label>Tu nombre</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />

        <label>Nombre de la organización</label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Mi empresa"
        />

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label>Contraseña (mín. 8 caracteres)</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <label>Plan</label>
        <select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
          {Object.values(PLANS).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — ${p.priceUsdMonthly}/mes · {p.maxCameras} cámara(s)
            </option>
          ))}
        </select>
        <p className="meta" style={{ marginTop: 6 }}>
          En este prototipo no hay cobro: puedes elegir cualquier plan para probar.
        </p>

        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 14 }}>
        ¿Ya tienes cuenta? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
