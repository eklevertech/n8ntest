import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fmtDate, toNumber } from '@/lib/format';
import {
  approvePtoRequest,
  cancelPtoRequest,
  createPtoRequest,
  rejectPtoRequest,
} from '@/server/pto';

export default async function PtoPage() {
  const session = await requireSession();
  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'HR';
  const employeeId = session.user.employeeId;

  const [myRequests, pending] = await Promise.all([
    employeeId
      ? prisma.ptoRequest.findMany({
          where: { employeeId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.ptoRequest.findMany({
          where: { status: 'PENDING' },
          include: { employee: { select: { firstName: true, lastName: true, ptoBalance: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">PTO</h1>

      {employeeId ? (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">Nueva solicitud</h2>
          <NewPtoForm />
        </section>
      ) : null}

      {employeeId ? (
        <section className="card overflow-x-auto p-0">
          <h2 className="px-4 py-3 text-lg font-semibold">Mis solicitudes</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Días</th>
                <th>Tipo</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {myRequests.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.startDate)}</td>
                  <td>{fmtDate(r.endDate)}</td>
                  <td>{toNumber(r.days).toFixed(2)}</td>
                  <td>{r.type}</td>
                  <td>{r.status}</td>
                  <td className="text-right">
                    {r.status === 'PENDING' ? (
                      <form
                        action={async () => {
                          'use server';
                          await cancelPtoRequest(r.id);
                        }}
                      >
                        <button className="btn-secondary" type="submit">Cancelar</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500">Sin solicitudes.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="card overflow-x-auto p-0">
          <h2 className="px-4 py-3 text-lg font-semibold">Pendientes ({pending.length})</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Días</th>
                <th>Tipo</th>
                <th>Balance</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee.lastName}, {r.employee.firstName}</td>
                  <td>{fmtDate(r.startDate)}</td>
                  <td>{fmtDate(r.endDate)}</td>
                  <td>{toNumber(r.days).toFixed(2)}</td>
                  <td>{r.type}</td>
                  <td>{toNumber(r.employee.ptoBalance).toFixed(2)}</td>
                  <td className="text-right">
                    <form
                      className="inline-flex"
                      action={async () => {
                        'use server';
                        await approvePtoRequest(r.id);
                      }}
                    >
                      <button className="btn-primary" type="submit">Aprobar</button>
                    </form>
                    <form
                      className="ml-2 inline-flex"
                      action={async () => {
                        'use server';
                        await rejectPtoRequest(r.id);
                      }}
                    >
                      <button className="btn-danger" type="submit">Rechazar</button>
                    </form>
                  </td>
                </tr>
              ))}
              {pending.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500">Sin pendientes.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function NewPtoForm() {
  return (
    <form
      action={async (fd) => {
        'use server';
        await createPtoRequest(undefined, fd);
      }}
      className="grid gap-3 md:grid-cols-5"
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
        <span className="label">Tipo</span>
        <select className="input" name="type" required>
          <option value="VACATION">Vacaciones</option>
          <option value="SICK">Enfermedad</option>
          <option value="PERSONAL">Personal</option>
          <option value="UNPAID">Sin paga</option>
        </select>
      </label>
      <label className="block md:col-span-2">
        <span className="label">Razón</span>
        <input className="input" name="reason" />
      </label>
      <div className="md:col-span-5">
        <button className="btn-primary" type="submit">Solicitar</button>
        <span className="ml-3 text-xs text-gray-500">
          Se calculan automáticamente los días laborables L-V.
        </span>
      </div>
    </form>
  );
}
