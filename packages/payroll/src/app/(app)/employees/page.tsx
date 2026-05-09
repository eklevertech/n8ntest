import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fmtCurrency, fmtDate, toNumber } from '@/lib/format';

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole(['ADMIN', 'HR']);
  const { q, status } = await searchParams;

  const where: Prisma.EmployeeWhereInput = {};
  if (status === 'ACTIVE' || status === 'ON_LEAVE' || status === 'TERMINATED') {
    where.status = status;
  }
  if (q && q.trim().length > 0) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { employeeNumber: { contains: q, mode: 'insensitive' } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ status: 'asc' }, { lastName: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empleados</h1>
        <Link href="/employees/new" className="btn-primary">+ Nuevo</Link>
      </div>

      <form className="card flex flex-wrap items-end gap-3" action="/employees">
        <label className="block">
          <span className="label">Buscar</span>
          <input
            className="input"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Nombre, email, número"
          />
        </label>
        <label className="block">
          <span className="label">Status</span>
          <select className="input" name="status" defaultValue={status ?? ''}>
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="ON_LEAVE">Licencia</option>
            <option value="TERMINATED">Cesados</option>
          </select>
        </label>
        <button className="btn-secondary" type="submit">Filtrar</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Núm.</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Puesto</th>
              <th>Tipo</th>
              <th>Compensación</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>{e.employeeNumber}</td>
                <td>
                  <Link className="text-brand hover:underline" href={`/employees/${e.id}`}>
                    {e.lastName}, {e.firstName}
                  </Link>
                </td>
                <td>{e.email}</td>
                <td>{e.jobTitle}</td>
                <td>{e.employeeType}</td>
                <td>
                  {e.employeeType === 'SALARIED'
                    ? fmtCurrency(toNumber(e.annualSalary))
                    : `${fmtCurrency(toNumber(e.hourlyRate))}/h`}
                </td>
                <td>
                  <StatusBadge status={e.status} />
                </td>
              </tr>
            ))}
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-500">
                  No hay empleados
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Última contratación:{' '}
        {employees[0]?.hireDate ? fmtDate(employees[0].hireDate) : '—'}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return <span className="badge-green">Activo</span>;
  if (status === 'ON_LEAVE') return <span className="badge-yellow">Licencia</span>;
  return <span className="badge-red">Cesado</span>;
}
