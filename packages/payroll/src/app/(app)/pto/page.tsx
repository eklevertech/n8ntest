import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { createPtoRequest, reviewPtoRequest, cancelPtoRequest } from "./actions";

export default async function PtoPage() {
  const session = await requireSession();
  const role = session.user.role;
  const isStaff = role === "ADMIN" || role === "HR";

  const myRequests = session.user.employeeId
    ? await prisma.ptoRequest.findMany({
        where: { employeeId: session.user.employeeId },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const employees = isStaff
    ? await prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { lastName: "asc" } })
    : [];

  const pending = isStaff
    ? await prisma.ptoRequest.findMany({
        where: { status: "PENDING" },
        include: { employee: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  async function create(formData: FormData) { "use server"; await createPtoRequest(formData); }
  async function approve(id: string) { "use server"; await reviewPtoRequest(id, "APPROVED"); }
  async function reject(id: string) { "use server"; await reviewPtoRequest(id, "REJECTED"); }
  async function cancel(id: string) { "use server"; await cancelPtoRequest(id); }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tiempo libre (PTO)</h1>

      <div className="card">
        <h2 className="font-semibold mb-3">Nueva solicitud</h2>
        <form action={create} className="grid md:grid-cols-5 gap-3 items-end">
          {isStaff && (
            <div>
              <label className="label">Empleado</label>
              <select name="employeeId" className="input" required>
                <option value="">Selecciona…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Tipo</label>
            <select name="type" className="input" required>
              <option value="VACATION">Vacaciones</option>
              <option value="SICK">Enfermedad</option>
              <option value="PERSONAL">Personal</option>
              <option value="UNPAID">Sin paga</option>
            </select>
          </div>
          <div>
            <label className="label">Desde</label>
            <input name="startDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input name="endDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Razón (opcional)</label>
            <input name="reason" type="text" className="input" />
          </div>
          <button className="btn-primary">Solicitar</button>
        </form>
      </div>

      {session.user.employeeId && (
        <div className="card">
          <h2 className="font-semibold mb-3">Mis solicitudes</h2>
          <table className="table">
            <thead><tr><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {myRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.type}</td>
                  <td>{r.startDate.toISOString().slice(0,10)}</td>
                  <td>{r.endDate.toISOString().slice(0,10)}</td>
                  <td>{toNumber(r.days).toFixed(2)}</td>
                  <td><span className="badge bg-slate-100 text-slate-700">{r.status}</span></td>
                  <td>
                    {r.status === "PENDING" && (
                      <form action={cancel.bind(null, r.id)}>
                        <button className="text-red-600 hover:underline text-xs">Cancelar</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {myRequests.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-slate-500">Sin solicitudes.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {isStaff && (
        <div className="card">
          <h2 className="font-semibold mb-3">Pendientes de revisión</h2>
          <table className="table">
            <thead><tr><th>Empleado</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días</th><th></th></tr></thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee.firstName} {r.employee.lastName}</td>
                  <td>{r.type}</td>
                  <td>{r.startDate.toISOString().slice(0,10)}</td>
                  <td>{r.endDate.toISOString().slice(0,10)}</td>
                  <td>{toNumber(r.days).toFixed(2)}</td>
                  <td className="flex gap-2">
                    <form action={approve.bind(null, r.id)}>
                      <button className="btn-primary text-xs px-3 py-1">Aprobar</button>
                    </form>
                    <form action={reject.bind(null, r.id)}>
                      <button className="btn-secondary text-xs px-3 py-1">Rechazar</button>
                    </form>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-slate-500">Sin pendientes.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
