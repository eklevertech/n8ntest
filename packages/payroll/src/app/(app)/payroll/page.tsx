import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fmtCurrency, fmtDate, toNumber } from '@/lib/format';
import { createPayPeriod } from '@/server/payroll';

export default async function PayrollPage() {
  await requireRole(['ADMIN', 'HR']);
  const periods = await prisma.payPeriod.findMany({
    orderBy: { startDate: 'desc' },
    include: { payrollRun: true },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nómina</h1>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Nuevo período (bi-weekly)</h2>
        <form
          action={async (fd) => {
            'use server';
            await createPayPeriod(undefined, fd);
          }}
          className="grid gap-3 md:grid-cols-4"
        >
          <label className="block">
            <span className="label">Inicio</span>
            <input className="input" type="date" name="startDate" required />
          </label>
          <label className="block">
            <span className="label">Fin</span>
            <input className="input" type="date" name="endDate" required />
          </label>
          <label className="block">
            <span className="label">Fecha de pago</span>
            <input className="input" type="date" name="payDate" required />
          </label>
          <div className="flex items-end">
            <button className="btn-primary" type="submit">Crear período</button>
          </div>
        </form>
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Pago</th>
              <th>Status</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Taxes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id}>
                <td>{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</td>
                <td>{fmtDate(p.payDate)}</td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td>{p.payrollRun ? fmtCurrency(toNumber(p.payrollRun.totalGross)) : '—'}</td>
                <td>{p.payrollRun ? fmtCurrency(toNumber(p.payrollRun.totalNet)) : '—'}</td>
                <td>{p.payrollRun ? fmtCurrency(toNumber(p.payrollRun.totalTaxes)) : '—'}</td>
                <td>
                  <Link className="btn-secondary" href={`/payroll/${p.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
            {periods.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-500">Sin períodos.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'OPEN') return <span className="badge-yellow">Abierto</span>;
  if (status === 'PROCESSING') return <span className="badge-blue">Procesado</span>;
  return <span className="badge-green">Pagado</span>;
}
