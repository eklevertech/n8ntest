import Link from "next/link";
import { notFound } from "next/navigation";
import { getCamera, listEvents } from "@/lib/store";
import { LiveMonitor } from "@/components/LiveMonitor";
import { SeverityPill } from "@/components/SeverityPill";

export const dynamic = "force-dynamic";

export default async function CameraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const camera = await getCamera(id);
  if (!camera) notFound();
  const events = await listEvents(undefined, { cameraId: id, limit: 20 });
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <div className="row spread">
        <div>
          <h1 style={{ marginBottom: 2 }}>{camera.name}</h1>
          <p className="sub">{camera.location}</p>
        </div>
        <Link href="/" className="btn secondary">
          ← Volver
        </Link>
      </div>

      {!hasKey && (
        <div className="banner warn">
          ⚠️ ANTHROPIC_API_KEY no configurada: el monitor capturará frames pero el
          análisis devolverá error hasta que añadas la clave.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div>
          <LiveMonitor
            cameraId={camera.id}
            intervalSec={camera.captureIntervalSec}
          />
        </div>
        <div className="card">
          <h3>Reglas</h3>
          <ul style={{ paddingLeft: 18, fontSize: 14 }}>
            {camera.rules.map((r) => (
              <li key={r.id} style={{ marginBottom: 6 }}>
                {r.description}{" "}
                <span className="muted">({r.minConfidence}% conf.)</span>
              </li>
            ))}
          </ul>
          <h3 style={{ marginTop: 16 }}>Alertas</h3>
          <div className="row">
            {camera.notifications.channels.map((c) => (
              <span key={c} className="pill">
                {c}
              </span>
            ))}
          </div>
          <p className="meta" style={{ marginTop: 10 }}>
            Gravedad mínima: {camera.notifications.minSeverity}
            {camera.notifications.email && <> · {camera.notifications.email}</>}
            {camera.notifications.phone && <> · {camera.notifications.phone}</>}
          </p>
        </div>
      </div>

      <h2>Eventos de esta cámara</h2>
      {events.length === 0 ? (
        <div className="empty">Sin eventos todavía.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Detalle</th>
              <th>Gravedad</th>
              <th>Conf.</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.createdAt).toLocaleTimeString()}</td>
                <td>
                  <strong>{e.ruleViolated || "—"}</strong>
                  <div className="muted">{e.description}</div>
                </td>
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
