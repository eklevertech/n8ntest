import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  await requireRole(["ADMIN", "HR"]);
  const q = searchParams.q?.trim();
  const status = searchParams.status as "ACTIVE" | "ON_LEAVE" | "TERMINATED" | undefined;

  const employees = await prisma.employee.findMany({
    where: {
      AND: [
        status ? { status } : {},
        q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { employeeNumber: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Empleados</h1>
        <Link href="/employees/new" className="btn-primary">+ Nuevo</Link>
      </div>

      <form className="card flex gap-3 items-end">
        <div className="flex-1">
          <label className="label">Buscar</label>
          <input name="q" defaultValue={q} placeholder="Nombre, email o número" className="input" />
        </div>
        <div>
          <label className="label">Estado</label>
          <select name="status" defaultValue={status ?? ""} className="input">
            <option value="">Todos</option>
            <option value="ACTIVE">Activo</option>
            <option value="ON_LEAVE">En licencia</option>
            <option value="TERMINATED">Terminado</option>
          </select>
        </div>
        <button className="btn-secondary" type="submit">Filtrar</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Tipo</th>
              <th>Pago</th>
              <th>Departamento</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="font-mono text-xs">{e.employeeNumber}</td>
                <td>{e.firstName} {e.lastName}</td>
                <td>{e.email}</td>
                <td>{e.employeeType}</td>
                <td>
                  {e.employeeType === "SALARIED"
                    ? `${fmtUSD(e.annualSalary ?? 0)}/yr`
                    : `${fmtUSD(e.hourlyRate ?? 0)}/hr`}
                </td>
                <td>{e.department ?? "—"}</td>
                <td>
                  <span className={`badge ${
                    e.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                    e.status === "ON_LEAVE" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-200 text-slate-600"
                  }`}>{e.status}</span>
                </td>
                <td>
                  <Link href={`/employees/${e.id}`} className="text-brand-600 hover:underline">Ver</Link>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-slate-500">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
