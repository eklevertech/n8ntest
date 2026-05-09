import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fmtCurrency, fmtDate, toNumber } from '@/lib/format';
import {
  addBonus,
  deleteBonus,
  markPeriodAsPaid,
  processPayroll,
} from '@/server/payroll';

export default async function PayrollPeriodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['ADMIN', 'HR']);
  const { id } = await params;

  const period = await prisma.payPeriod.findUnique({
    where: { id },
    include: {
      payrollRun: true,
      bonuses: { include: { employee: { select: { firstName: true, lastName: true } } } },
      payStubs: {
        include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
        orderBy: { netPay: 'desc' },
      },
    },
  });
  if (!period) notFound();

  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { lastName: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  });

  const isOpen = period.status === 'OPEN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Período {fmtDate(period.startDate)} – {fmtDate(period.endDate)}
          </h1>
          <p className="text-sm text-gray-500">Pago {fmtDate(period.payDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-blue">{period.status}</span>
          {!isOpen ? (
            <>
              <a
                className="btn-secondary"
                href={`/api/payroll/${period.id}/csv`}
                target="_blank"
              >
                CSV
              </a>
              <a
                className="btn-secondary"
                href={`/api/payroll/${period.id}/excel`}
                target="_blank"
              >
                Excel
              </a>
              {period.status === 'PROCESSING' ? (
                <form
                  action={async () => {
                    'use server';
                    await markPeriodAsPaid(period.id);
                  }}
                >
                  <button type="submit" className="btn-primary">Marcar como pagada</button>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {isOpen ? (
        <>
          <section className="card space-y-4">
            <h2 className="text-lg font-semibold">Agregar bono / comisión / reembolso</h2>
            <form
              action={async (fd) => {
                'use server';
                fd.set('payPeriodId', period.id);
                await addBonus(undefined, fd);
              }}
              className="grid gap-3 md:grid-cols-5"
            >
              <label className="block">
                <span className="label">Empleado</span>
                <select className="input" name="employeeId" required>
                  <option value="">—</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.lastName}, {e.firstName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Tipo</span>
                <select className="input" name="type" required>
                  <option value="BONUS">Bono</option>
                  <option value="COMMISSION">Comisión</option>
                  <option value="REIMBURSEMENT">Reembolso</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Monto</span>
                <input className="input" type="number" step="0.01" name="amount" required />
              </label>
              <label className="block md:col-span-2">
                <span className="label">Descripción</span>
                <input className="input" name="description" />
              </label>
              <div className="md:col-span-5">
                <button className="btn-primary" type="submit">Agregar</button>
              </div>
            </form>
            {period.bonuses.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                    <th>Descripción</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {period.bonuses.map((b) => (
                    <tr key={b.id}>
                      <td>{b.employee.lastName}, {b.employee.firstName}</td>
                      <td>{b.type}</td>
                      <td>{fmtCurrency(toNumber(b.amount))}</td>
                      <td>{b.description ?? '—'}</td>
                      <td className="text-right">
                        <form
                          action={async () => {
                            'use server';
                            await deleteBonus(b.id, period.id);
                          }}
                        >
                          <button type="submit" className="btn-danger">Eliminar</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>

          <section className="card flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Procesar genera todos los pay stubs y cierra el período en estado PROCESSING.
            </p>
            <form
              action={async () => {
                'use server';
                await processPayroll(period.id);
              }}
            >
              <button className="btn-primary" type="submit">Procesar nómina</button>
            </form>
          </section>
        </>
      ) : null}

      {period.payrollRun ? (
        <section className="card overflow-x-auto p-0">
          <h2 className="px-4 py-3 text-lg font-semibold">
            Pay stubs (Total: {fmtCurrency(toNumber(period.payrollRun.totalNet))})
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Horas reg/OT</th>
                <th>Gross</th>
                <th>Impuestos</th>
                <th>Net</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {period.payStubs.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/employees/${s.employeeId}`}
                      className="text-brand hover:underline"
                    >
                      {s.employee.lastName}, {s.employee.firstName}
                    </Link>
                  </td>
                  <td>{toNumber(s.regularHours).toFixed(1)} / {toNumber(s.overtimeHours).toFixed(1)}</td>
                  <td>{fmtCurrency(toNumber(s.grossPay))}</td>
                  <td>{fmtCurrency(toNumber(s.totalDeductions))}</td>
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
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
