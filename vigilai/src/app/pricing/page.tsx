import { PLANS } from "@/lib/plans";

export default function PricingPage() {
  const plans = Object.values(PLANS);
  return (
    <>
      <h1>Planes y suscripciones</h1>
      <p className="sub">
        Modelo SaaS por suscripción. Cada plan define cuántas cámaras puedes
        monitorear, el volumen de análisis por IA incluido y los canales de alerta.
      </p>
      <div className="grid">
        {plans.map((p) => (
          <div key={p.id} className="card">
            <h3>{p.name}</h3>
            <div className="price">
              ${p.priceUsdMonthly}
              <span> /mes</span>
            </div>
            <p className="meta" style={{ marginTop: 8 }}>
              {p.blurb}
            </p>
            <ul style={{ paddingLeft: 18, color: "var(--muted)", fontSize: 14 }}>
              <li>{p.maxCameras} cámara(s)</li>
              <li>{p.maxFramesPerMonth.toLocaleString()} frames/mes</li>
              <li>Canales: {p.channels.join(", ")}</li>
            </ul>
          </div>
        ))}
      </div>
      <div className="banner info">
        En este prototipo el cobro no está integrado. La ruta de producción es
        conectar Stripe Billing (checkout + webhooks) para activar/desactivar planes
        automáticamente.
      </div>
    </>
  );
}
