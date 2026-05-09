import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fmtUSD } from "@/lib/money";
import { addBonus, processPayPeriod, markPaid } from "../actions";

export default async function PayrollPeriodPage({ params }: { params: { id: string } }) {
  await requireRole(["ADMIN", "HR"]);
  const period = await prisma.payPeriod.findUnique({
    where: { id: params.id },
    include: {
      payrollRun: {
        include: {
          payStubs: { include: { employee: true }, orderBy: { employee: { lastName: "asc" } } },
        },
      },
      bonuses: { include: { employee: true } },
    },
  });
  if (!period) notFound();

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { lastName: "asc" },
  });

  async function bonusAction(formData: FormData) { "use server"; await addBonus(formData); }
  async function process() { "use server"; await processPayPeriod(period!.id); }
  async function pay() { "use server"; await markPaid(period!.id); }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">
            Período {period.startDate.toISOString().slice(0,10)} → {period.endDate.toISOString().slice(0,10)}
          </h1>
          <p className="text-sm text-slate-500">Pago: {period.payDate.toISOString().slice(0,10)} · Estado: {period.status}</p>
        </div>
        <div className="flex gap-2">
          {period.status === "OPEN" && (
            <form action={process}><button className="btn-primary">Procesar nómina</button></form>
          )}
          {period.status === "PROCESSING" && (
            <>
              <a href={`/api/payroll/${period.id}/csv`} className="btn-secondary">Descargar CSV</a>
              <a href={`/api/payroll/${period.id}/excel`} className="btn-secondary">Descargar Excel</a>
              <form action={pay}><button className="btn-primary">Marcar como pagada</button></form>
            </>
          )}
          {period.status === "PAID" && (
            <>
              <a href={`/api/payroll/${period.id}/csv`} className="btn-secondary">CSV</a>
              <a href={`/api/payroll/${period.id}/excel`} className="btn-secondary">Excel</a>
            </>
          )}
        </div>
      </div>

      {period.status === "OPEN" && (
        <div className="card">
          <h2 className="font-semibold mb-3">Bonos / comisiones / reembolsos para este período</h2>
          <form action={bonusAction} className="grid md:grid-cols-5 gap-3 items-end">
            <input type="hidden" name="payPeriodId" value={period.id} />
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
              <label className="label">Tipo</label>
              <select name="type" className="input" required>
                <option value="BONUS">Bono</option>
                <option value="COMMISSION">Comisión</option>
                <option value="REIMBURSEMENT">Reembolso (no taxable)</option>
              </select>
            </div>
            <div>
              <label className="label">Monto ($)</label>
              <input name="amount" type="number" step="0.01" min="0.01" className="input" required />
            </div>
            <div className="md:col-span-1">
              <label className="label">Descripción</label>
              <input name="description" type="text" className="input" />
            </div>
            <button className="btn-primary">Agregar</button>
          </form>
          {period.bonuses.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="table">
                <thead><tr><th>Empleado</th><th>Tipo</th><th>Monto</th><th>Descripción</th></tr></thead>
                <tbody>
                  {period.bonuses.map((b) => (
                    <tr key={b.id}>
                      <td>{b.employee.firstName} {b.employee.lastName}</td>
                      <td>{b.type}</td>
                      <td>{fmtUSD(b.amount)}</td>
                      <td>{b.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {period.payrollRun && (
        <div className="card">
          <h2 className="font-semibold mb-3">
            Pay stubs ({period.payrollRun.payStubs.length}) — Total neto: {fmtUSD(period.payrollRun.totalNet)}
          </h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Empleado</th><th>Reg h</th><th>OT h</th><th>Gross</th>
                  <th>PR Tax</th><th>SS</th><th>Med</th><th>SINOT</th>
                  <th>Net</th><th></th>
                </tr>
              </thead>
              <tbody>
                {period.payrollRun.payStubs.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/employees/${s.employeeId}`} className="hover:underline">
                        {s.employee.firstName} {s.employee.lastName}
                      </Link>
                    </td>
                    <td>{Number(s.regularHours).toFixed(2)}</td>
                    <td>{Number(s.overtimeHours).toFixed(2)}</td>
                    <td>{fmtUSD(s.grossPay)}</td>
                    <td>{fmtUSD(s.prIncomeTax)}</td>
                    <td>{fmtUSD(s.socialSecurity)}</td>
                    <td>{fmtUSD(s.medicare)}</td>
                    <td>{fmtUSD(s.sinotEmployee)}</td>
                    <td className="font-semibold">{fmtUSD(s.netPay)}</td>
                    <td><a href={`/api/paystubs/${s.id}/pdf`} className="text-brand-600 hover:underline">PDF</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
