import { listEvents } from "@/lib/store";
import { requirePageAuth } from "@/lib/require-auth";
import { SeverityPill } from "@/components/SeverityPill";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const { account } = await requirePageAuth();
  const events = await listEvents(account.id, { limit: 100 });
  return (
    <>
      <h1>Registro de eventos</h1>
      <p className="sub">Violaciones detectadas y el resultado de cada notificación.</p>
      {events.length === 0 ? (
        <div className="empty">Sin eventos todavía.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cámara</th>
              <th>Detalle</th>
              <th>Gravedad</th>
              <th>Conf.</th>
              <th>Notificaciones</th>
              <th>Captura</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.cameraName}</td>
                <td>
                  <strong>{e.ruleViolated || "—"}</strong>
                  <div className="muted">{e.description}</div>
                </td>
                <td>
                  <SeverityPill severity={e.severity} />
                </td>
                <td>{e.confidence}%</td>
                <td>
                  {e.notified.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    e.notified.map((n, i) => (
                      <div key={i} className="muted" style={{ fontSize: 12 }}>
                        {n.ok ? "✅" : "❌"} {n.channel}: {n.detail}
                      </div>
                    ))
                  )}
                </td>
                <td>
                  {e.snapshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="snapshot" src={e.snapshot} alt="captura" />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
