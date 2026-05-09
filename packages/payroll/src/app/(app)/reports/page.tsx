import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  await requireRole(["ADMIN", "HR"]);
  const year = Number(searchParams.year ?? new Date().getFullYear());
  const employees = await prisma.employee.findMany({
    where: { status: { in: ["ACTIVE", "ON_LEAVE", "TERMINATED"] } },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reportes</h1>

      <div className="card">
        <h2 className="font-semibold mb-3">Asistencia</h2>
        <form action="/api/reports/attendance" method="get" className="grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Desde</label>
            <input name="from" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input name="to" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Formato</label>
            <select name="format" className="input">
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
            </select>
          </div>
          <button className="btn-primary">Descargar</button>
        </form>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Anual W-2PR / 1099 (mock) — Año {year}</h2>
        <form className="mb-4">
          <label className="label">Año</label>
          <input name="year" type="number" defaultValue={year} className="input max-w-[120px]" />
        </form>
        <table className="table">
          <thead>
            <tr><th>Empleado</th><th>Tipo</th><th>Forma</th><th></th></tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td>{e.firstName} {e.lastName} <span className="text-xs text-slate-500">#{e.employeeNumber}</span></td>
                <td>{e.employeeType}</td>
                <td>{e.employeeType === "CONTRACTOR" ? "1099" : "W-2PR"}</td>
                <td>
                  <a className="text-brand-600 hover:underline" href={`/api/reports/annual/${e.id}?year=${year}`}>
                    Descargar PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
