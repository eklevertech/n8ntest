import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { createPayPeriod } from "./actions";

export default async function PayrollListPage() {
  await requireRole(["ADMIN", "HR"]);
  const periods = await prisma.payPeriod.findMany({
    orderBy: { startDate: "desc" },
    include: { payrollRun: true },
  });

  async function create(formData: FormData) { "use server"; await createPayPeriod(formData); }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nómina</h1>

      <div className="card">
        <h2 className="font-semibold mb-3">Nuevo período (bi-weekly)</h2>
        <form action={create} className="grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Inicio</label>
            <input name="startDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Fin</label>
            <input name="endDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">Fecha de pago</label>
            <input name="payDate" type="date" className="input" required />
          </div>
          <button className="btn-primary">Crear</button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Período</th><th>Pago</th><th>Estado</th><th>Gross</th><th>Net</th><th>Taxes</th><th></th></tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id}>
                <td>{p.startDate.toISOString().slice(0,10)} → {p.endDate.toISOString().slice(0,10)}</td>
                <td>{p.payDate.toISOString().slice(0,10)}</td>
                <td>
                  <span className={`badge ${
                    p.status === "OPEN" ? "bg-amber-100 text-amber-700" :
                    p.status === "PROCESSING" ? "bg-blue-100 text-blue-700" :
                    "bg-green-100 text-green-700"
                  }`}>{p.status}</span>
                </td>
                <td>{p.payrollRun ? fmtUSD(p.payrollRun.totalGross) : "—"}</td>
                <td>{p.payrollRun ? fmtUSD(p.payrollRun.totalNet) : "—"}</td>
                <td>{p.payrollRun ? fmtUSD(p.payrollRun.totalTaxes) : "—"}</td>
                <td><Link href={`/payroll/${p.id}`} className="text-brand-600 hover:underline">Abrir</Link></td>
              </tr>
            ))}
            {periods.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-slate-500">Sin períodos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
