"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo iniciar sesión.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="authbox">
      <h1>Entrar</h1>
      <p className="sub">Accede a tu panel de videovigilancia.</p>
      {error && <div className="banner warn">{error}</div>}
      <form className="card" onSubmit={submit}>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 18 }}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 14 }}>
        ¿No tienes cuenta? <Link href="/signup">Crear una</Link>
      </p>
    </div>
  );
}
