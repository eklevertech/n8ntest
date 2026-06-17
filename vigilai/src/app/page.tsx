import Link from "next/link";
import { getAccount, listCameras, listEvents } from "@/lib/store";
import { planOf } from "@/lib/plans";
import { SeverityPill } from "@/components/SeverityPill";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [account, cameras, events] = await Promise.all([
    getAccount(),
    listCameras(),
    listEvents(undefined, { limit: 8 }),
  ]);
  const plan = planOf(account.plan);
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <h1>Panel de control</h1>
      <p className="sub">
        Cuenta <strong>{account.name}</strong> · plan{" "}
        <span className="pill ok">{plan.name}</span>
      </p>

      {!hasKey && (
        <div className="banner warn">
          ⚠️ <strong>ANTHROPIC_API_KEY no configurada.</strong> La detección por IA
          está deshabilitada. Añade tu clave en <code>.env.local</code> y reinicia
          para activar el análisis de video.
        </div>
      )}

      <div className="grid">
        <div className="card">
          <div className="meta">Cámaras</div>
          <div className="price">
            {cameras.length}
            <span> / {plan.maxCameras}</span>
          </div>
        </div>
        <div className="card">
          <div className="meta">Frames analizados (mes)</div>
          <div className="price">
            {account.framesAnalyzedThisMonth.toLocaleString()}
            <span> / {plan.maxFramesPerMonth.toLocaleString()}</span>
          </div>
        </div>
        <div className="card">
          <div className="meta">Canales de alerta</div>
          <div className="row" style={{ marginTop: 8 }}>
            {plan.channels.map((c) => (
              <span key={c} className="pill">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="row spread" style={{ marginTop: 28 }}>
        <h2 style={{ margin: 0 }}>Tus cámaras</h2>
        <Link className="btn" href="/cameras/new">
          + Añadir cámara
        </Link>
      </div>

      {cameras.length === 0 ? (
        <div className="empty" style={{ marginTop: 14 }}>
          Aún no tienes cámaras. <Link href="/cameras/new">Crea la primera</Link> para
          empezar a monitorear.
        </div>
      ) : (
        <div className="grid" style={{ marginTop: 14 }}>
          {cameras.map((cam) => (
            <Link key={cam.id} href={`/cameras/${cam.id}`} className="card">
              <h3>{cam.name}</h3>
              <div className="meta">{cam.location}</div>
              <div className="row" style={{ marginTop: 12 }}>
                <span className="pill muted">
                  {cam.rules.filter((r) => r.enabled).length} regla(s)
                </span>
                {cam.notifications.channels.map((c) => (
                  <span key={c} className="pill">
                    {c}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2>Eventos recientes</h2>
      {events.length === 0 ? (
        <div className="empty">Sin eventos todavía.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cámara</th>
              <th>Regla</th>
              <th>Gravedad</th>
              <th>Confianza</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.cameraName}</td>
                <td>{e.ruleViolated || e.description}</td>
                <td>
                  <SeverityPill severity={e.severity} />
                </td>
                <td>{e.confidence}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
