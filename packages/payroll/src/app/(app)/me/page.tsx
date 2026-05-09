import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fmtUSD, toNumber } from "@/lib/money";

export default async function MyPortalPage() {
  const session = await requireSession();
  if (!session.user.employeeId) {
    return <p>Tu usuario no tiene un empleado asociado. Contacta a RRHH.</p>;
  }
  const me = await prisma.employee.findUnique({
    where: { id: session.user.employeeId },
    include: {
      payStubs: {
        orderBy: { createdAt: "desc" },
        include: { payrollRun: { include: { payPeriod: true } } },
      },
      timeEntries: { orderBy: { date: "desc" }, take: 10 },
      ptoRequests: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!me) return <p>Empleado no encontrado.</p>;

  const ytd = me.payStubs.reduce(
    (acc, s) => ({
      gross: acc.gross + toNumber(s.grossPay),
      net: acc.net + toNumber(s.netPay),
      tax: acc.tax + toNumber(s.totalDeductions),
    }),
    { gross: 0, net: 0, tax: 0 },
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mi portal</h1>

      <div className="grid md:grid-cols-4 gap-4">
        <Card label="YTD Gross" value={fmtUSD(ytd.gross)} />
        <Card label="YTD Net" value={fmtUSD(ytd.net)} />
        <Card label="YTD Deducciones" value={fmtUSD(ytd.tax)} />
        <Card label="PTO disponible" value={`${toNumber(me.ptoBalance).toFixed(2)} días`} />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Mis pay stubs</h2>
        <table className="table">
          <thead>
            <tr><th>Período</th><th>Pago</th><th>Gross</th><th>Net</th><th></th></tr>
          </thead>
          <tbody>
            {me.payStubs.map((s) => (
              <tr key={s.id}>
                <td>{s.payrollRun.payPeriod.startDate.toISOString().slice(0,10)} → {s.payrollRun.payPeriod.endDate.toISOString().slice(0,10)}</td>
                <td>{s.payrollRun.payPeriod.payDate.toISOString().slice(0,10)}</td>
                <td>{fmtUSD(s.grossPay)}</td>
                <td className="font-semibold">{fmtUSD(s.netPay)}</td>
                <td><a href={`/api/paystubs/${s.id}/pdf`} className="text-brand-600 hover:underline">PDF</a></td>
              </tr>
            ))}
            {me.payStubs.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-500">Sin pay stubs.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Mis horas recientes</h2>
        <table className="table">
          <thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Estado</th></tr></thead>
          <tbody>
            {me.timeEntries.map((t) => (
              <tr key={t.id}>
                <td>{t.date.toISOString().slice(0,10)}</td>
                <td>{t.clockIn.toLocaleTimeString()}</td>
                <td>{t.clockOut?.toLocaleTimeString() ?? "—"}</td>
                <td>{t.hours ? toNumber(t.hours).toFixed(2) : "—"}</td>
                <td><span className="badge bg-slate-100 text-slate-700">{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
