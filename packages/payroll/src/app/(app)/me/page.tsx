import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fmtCurrency, fmtDate, toNumber } from '@/lib/format';

export default async function MePage() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return <p className="card">Tu cuenta no está vinculada a un empleado.</p>;
  }

  const year = new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [employee, stubs, recentEntries] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.payStub.findMany({
      where: {
        employeeId,
        payPeriod: { payDate: { gte: yearStart, lt: yearEnd } },
      },
      include: { payPeriod: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.timeEntry.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 10,
    }),
  ]);
  if (!employee) return null;

  const ytdGross = stubs.reduce((s, x) => s + toNumber(x.grossPay), 0);
  const ytdNet = stubs.reduce((s, x) => s + toNumber(x.netPay), 0);
  const ytdTaxes = stubs.reduce((s, x) => s + toNumber(x.totalDeductions), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mi portal</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label={`YTD Gross ${year}`} value={fmtCurrency(ytdGross)} />
        <Stat label={`YTD Net ${year}`} value={fmtCurrency(ytdNet)} />
        <Stat label={`YTD Deducciones ${year}`} value={fmtCurrency(ytdTaxes)} />
        <Stat label="Balance PTO" value={`${toNumber(employee.ptoBalance).toFixed(2)} días`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto p-0">
          <h2 className="px-4 py-3 text-lg font-semibold">Mis recibos {year}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Pago</th>
                <th>Período</th>
                <th>Net</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stubs.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.payPeriod.payDate)}</td>
                  <td>
                    {fmtDate(s.payPeriod.startDate)} – {fmtDate(s.payPeriod.endDate)}
                  </td>
                  <td className="font-medium">{fmtCurrency(toNumber(s.netPay))}</td>
                  <td>
                    <a
                      className="text-brand hover:underline"
                      href={`/api/paystubs/${s.id}/pdf`}
                      target="_blank"
                    >
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
              {stubs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500">
                    Sin recibos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="card overflow-x-auto p-0">
          <h2 className="px-4 py-3 text-lg font-semibold">Horas recientes</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>{toNumber(e.hours).toFixed(2)}</td>
                  <td>{e.status}</td>
                </tr>
              ))}
              {recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500">Sin entradas.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>

      <p className="text-xs text-gray-500">
        Reporte anual:{' '}
        <a
          href={`/api/reports/annual/${employee.id}?year=${year}`}
          target="_blank"
          className="text-brand hover:underline"
        >
          Descargar {employee.employeeType === 'CONTRACTOR' ? '1099' : 'W-2PR'} {year} (mock)
        </a>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
