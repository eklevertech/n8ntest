import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fmtCurrency, fmtDate, toNumber } from '@/lib/format';
import { maskSsn } from '@/lib/tax/puertoRico';

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['ADMIN', 'HR']);
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      payStubs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { payPeriod: true },
      },
      ptoRequests: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
  if (!employee) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {employee.firstName} {employee.lastName}
        </h1>
        <Link href={`/employees/${employee.id}/edit`} className="btn-secondary">
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2 space-y-2">
          <h2 className="mb-2 text-lg font-semibold">Datos</h2>
          <Row label="Número" value={employee.employeeNumber} />
          <Row label="Email" value={employee.email} />
          <Row label="Teléfono" value={employee.phone ?? '—'} />
          <Row label="SSN" value={maskSsn(employee.ssn)} />
          <Row label="Puesto" value={employee.jobTitle} />
          <Row label="Departamento" value={employee.department ?? '—'} />
          <Row label="Tipo" value={employee.employeeType} />
          <Row
            label="Compensación"
            value={
              employee.employeeType === 'SALARIED'
                ? fmtCurrency(toNumber(employee.annualSalary)) + '/año'
                : fmtCurrency(toNumber(employee.hourlyRate)) + '/hora'
            }
          />
          <Row label="Filing" value={employee.filingStatus} />
          <Row label="Dependientes" value={String(employee.exemptions)} />
          <Row label="Retención adicional" value={fmtCurrency(toNumber(employee.extraWithholding))} />
          <Row label="Balance PTO" value={`${toNumber(employee.ptoBalance).toFixed(2)} días`} />
          <Row label="Contratación" value={fmtDate(employee.hireDate)} />
        </section>

        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Últimos recibos</h2>
          {employee.payStubs.length === 0 ? (
            <p className="text-sm text-gray-500">Sin recibos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {employee.payStubs.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span>{fmtDate(s.payPeriod.payDate)}</span>
                  <span className="font-medium">{fmtCurrency(toNumber(s.netPay))}</span>
                  <a className="text-brand hover:underline" href={`/api/paystubs/${s.id}/pdf`} target="_blank">
                    PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">PTO reciente</h2>
        {employee.ptoRequests.length === 0 ? (
          <p className="text-sm text-gray-500">Sin solicitudes.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Tipo</th>
                <th>Días</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.ptoRequests.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.startDate)}</td>
                  <td>{fmtDate(p.endDate)}</td>
                  <td>{p.type}</td>
                  <td>{toNumber(p.days).toFixed(2)}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
