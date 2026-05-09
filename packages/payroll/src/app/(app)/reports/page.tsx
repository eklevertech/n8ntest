import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';

export default async function ReportsPage() {
  await requireRole(['ADMIN', 'HR']);
  const employees = await prisma.employee.findMany({
    orderBy: { lastName: 'asc' },
    select: { id: true, firstName: true, lastName: true, employeeType: true },
  });
  const currentYear = new Date().getUTCFullYear();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reportes</h1>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Reporte de asistencia</h2>
        <form action="/api/reports/attendance" target="_blank" method="get" className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="label">Desde</span>
            <input className="input" type="date" name="from" required />
          </label>
          <label className="block">
            <span className="label">Hasta</span>
            <input className="input" type="date" name="to" required />
          </label>
          <label className="block">
            <span className="label">Formato</span>
            <select className="input" name="format" defaultValue="csv">
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-primary" type="submit">Descargar</button>
          </div>
        </form>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">W-2PR / 1099 anual (mock)</h2>
        <form action="/api/reports/annual-redirect" target="_blank" method="get" className="grid gap-3 md:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="label">Empleado</span>
            <select className="input" name="employeeId" required>
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.lastName}, {e.firstName} ({e.employeeType === 'CONTRACTOR' ? '1099' : 'W-2PR'})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Año</span>
            <input
              className="input"
              type="number"
              name="year"
              defaultValue={currentYear}
              min="2020"
              max="2099"
              required
            />
          </label>
          <div className="flex items-end">
            <button className="btn-primary" type="submit">Generar PDF</button>
          </div>
        </form>
      </section>
    </div>
  );
}
