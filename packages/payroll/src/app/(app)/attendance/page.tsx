import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fmtDate, fmtDateTime, toNumber } from '@/lib/format';
import { TimeClock } from '@/components/TimeClock';
import { addManualEntry, approveTimeEntry, rejectTimeEntry } from '@/server/attendance';

export default async function AttendancePage() {
  const session = await requireSession();
  const role = session.user.role;
  const isAdmin = role === 'ADMIN' || role === 'HR';

  if (!isAdmin) {
    return <EmployeeAttendance employeeId={session.user.employeeId} />;
  }

  const [pendingEntries, employees] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { status: 'PENDING' },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Asistencia</h1>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Entrada manual</h2>
        <ManualEntryForm employees={employees} />
      </section>

      <section className="card overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-lg font-semibold">Pendientes ({pendingEntries.length})</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Fecha</th>
              <th>Horas</th>
              <th>Notas</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pendingEntries.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.employee.lastName}, {e.employee.firstName} ({e.employee.employeeNumber})
                </td>
                <td>{fmtDate(e.date)}</td>
                <td>{toNumber(e.hours).toFixed(2)}</td>
                <td>{e.notes ?? '—'}</td>
                <td className="text-right">
                  <form
                    className="inline-flex gap-2"
                    action={async () => {
                      'use server';
                      await approveTimeEntry(e.id);
                    }}
                  >
                    <button className="btn-primary" type="submit">Aprobar</button>
                  </form>
                  <form
                    className="ml-2 inline-flex"
                    action={async () => {
                      'use server';
                      await rejectTimeEntry(e.id);
                    }}
                  >
                    <button className="btn-danger" type="submit">Rechazar</button>
                  </form>
                </td>
              </tr>
            ))}
            {pendingEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-500">
                  Sin entradas pendientes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

async function EmployeeAttendance({ employeeId }: { employeeId: string | null }) {
  if (!employeeId) {
    return <p className="card">Tu cuenta no está vinculada a un empleado.</p>;
  }
  const [open, recent] = await Promise.all([
    prisma.timeEntry.findFirst({
      where: { employeeId, clockIn: { not: null }, clockOut: null },
    }),
    prisma.timeEntry.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Asistencia</h1>
      <TimeClock hasOpen={!!open} />
      <section className="card overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-lg font-semibold">Mis entradas recientes</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Horas</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.date)}</td>
                <td>{e.clockIn ? fmtDateTime(e.clockIn) : '—'}</td>
                <td>{e.clockOut ? fmtDateTime(e.clockOut) : '—'}</td>
                <td>{toNumber(e.hours).toFixed(2)}</td>
                <td>{e.status}</td>
              </tr>
            ))}
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-500">
                  Sin entradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ManualEntryForm({
  employees,
}: {
  employees: { id: string; firstName: string; lastName: string; employeeNumber: string }[];
}) {
  return (
    <form
      action={async (fd) => {
        'use server';
        await addManualEntry(undefined, fd);
      }}
      className="grid gap-3 md:grid-cols-5"
    >
      <label className="block">
        <span className="label">Empleado</span>
        <select name="employeeId" className="input" required>
          <option value="">—</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.lastName}, {e.firstName} ({e.employeeNumber})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Fecha</span>
        <input className="input" type="date" name="date" required />
      </label>
      <label className="block">
        <span className="label">Horas</span>
        <input className="input" type="number" step="0.25" name="hours" required />
      </label>
      <label className="block md:col-span-2">
        <span className="label">Notas</span>
        <input className="input" type="text" name="notes" />
      </label>
      <label className="md:col-span-5 flex items-center gap-2 text-sm">
        <input type="checkbox" name="approved" /> Aprobar inmediatamente
      </label>
      <div className="md:col-span-5">
        <button className="btn-primary" type="submit">Crear entrada</button>
      </div>
    </form>
  );
}
