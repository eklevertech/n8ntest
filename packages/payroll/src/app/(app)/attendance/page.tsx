import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { clockIn, clockOut, approveTimeEntry, rejectTimeEntry, manualEntry } from "./actions";
import { toNumber } from "@/lib/money";

export default async function AttendancePage() {
  const session = await requireSession();
  const role = session.user.role;
  const isStaff = role === "ADMIN" || role === "HR";

  const myOpen = session.user.employeeId
    ? await prisma.timeEntry.findFirst({
        where: { employeeId: session.user.employeeId, clockOut: null },
      })
    : null;

  const recentMine = session.user.employeeId
    ? await prisma.timeEntry.findMany({
        where: { employeeId: session.user.employeeId },
        orderBy: { clockIn: "desc" },
        take: 10,
      })
    : [];

  const pendingAll = isStaff
    ? await prisma.timeEntry.findMany({
        where: { status: "PENDING", clockOut: { not: null } },
        include: { employee: true },
        orderBy: { clockIn: "desc" },
        take: 50,
      })
    : [];

  const employees = isStaff
    ? await prisma.employee.findMany({
        where: { status: "ACTIVE" },
        orderBy: { lastName: "asc" },
      })
    : [];

  async function doIn() { "use server"; await clockIn(); }
  async function doOut() { "use server"; await clockOut(); }
  async function doApprove(id: string) { "use server"; await approveTimeEntry(id); }
  async function doReject(id: string) { "use server"; await rejectTimeEntry(id); }
  async function doManual(formData: FormData) { "use server"; await manualEntry(formData); }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Asistencia</h1>

      {session.user.employeeId && (
        <div className="card flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Time clock</h2>
            <p className="text-sm text-slate-500">
              {myOpen
                ? `Punch abierto desde ${myOpen.clockIn.toLocaleString()}`
                : "Sin punch activo"}
            </p>
          </div>
          <div className="flex gap-2">
            <form action={doIn}>
              <button className="btn-primary" disabled={!!myOpen}>Clock in</button>
            </form>
            <form action={doOut}>
              <button className="btn-secondary" disabled={!myOpen}>Clock out</button>
            </form>
          </div>
        </div>
      )}

      {session.user.employeeId && (
        <div className="card">
          <h2 className="font-semibold mb-3">Mis entradas recientes</h2>
          <table className="table">
            <thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Estado</th></tr></thead>
            <tbody>
              {recentMine.map((t) => (
                <tr key={t.id}>
                  <td>{t.date.toISOString().slice(0,10)}</td>
                  <td>{t.clockIn.toLocaleTimeString()}</td>
                  <td>{t.clockOut?.toLocaleTimeString() ?? "—"}</td>
                  <td>{t.hours ? toNumber(t.hours).toFixed(2) : "—"}</td>
                  <td><span className="badge bg-slate-100 text-slate-700">{t.status}</span></td>
                </tr>
              ))}
              {recentMine.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-500">Sin entradas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {isStaff && (
        <div className="card">
          <h2 className="font-semibold mb-3">Entrada manual (HR)</h2>
          <form action={doManual} className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Empleado</label>
              <select name="employeeId" className="input" required>
                <option value="">Selecciona…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input name="date" type="date" className="input" required />
            </div>
            <div>
              <label className="label">Horas</label>
              <input name="hours" type="number" step="0.25" className="input" required />
            </div>
            <button className="btn-primary">Agregar</button>
          </form>
        </div>
      )}

      {isStaff && (
        <div className="card">
          <h2 className="font-semibold mb-3">Entradas pendientes de aprobación</h2>
          <table className="table">
            <thead><tr><th>Empleado</th><th>Fecha</th><th>Horas</th><th></th></tr></thead>
            <tbody>
              {pendingAll.map((t) => (
                <tr key={t.id}>
                  <td>{t.employee.firstName} {t.employee.lastName}</td>
                  <td>{t.date.toISOString().slice(0,10)}</td>
                  <td>{t.hours ? toNumber(t.hours).toFixed(2) : "—"}</td>
                  <td className="flex gap-2">
                    <form action={doApprove.bind(null, t.id)}>
                      <button className="btn-primary text-xs px-3 py-1">Aprobar</button>
                    </form>
                    <form action={doReject.bind(null, t.id)}>
                      <button className="btn-secondary text-xs px-3 py-1">Rechazar</button>
                    </form>
                  </td>
                </tr>
              ))}
              {pendingAll.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-slate-500">Sin pendientes.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
