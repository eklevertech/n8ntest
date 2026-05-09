import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fmtUSD, toNumber } from "@/lib/money";

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  await requireRole(["ADMIN", "HR"]);
  const e = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      payStubs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { payrollRun: { include: { payPeriod: true } } },
      },
      ptoRequests: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!e) notFound();
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{e.firstName} {e.lastName}</h1>
        <Link href={`/employees/${e.id}/edit`} className="btn-primary">Editar</Link>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-2">Personal</h2>
          <dl className="text-sm space-y-1">
            <Row label="# Empleado" v={e.employeeNumber} />
            <Row label="Email" v={e.email} />
            <Row label="Teléfono" v={e.phone ?? "—"} />
            <Row label="SSN" v={e.ssn ?? "—"} />
            <Row label="Dirección" v={[e.address, e.city, e.zipCode].filter(Boolean).join(", ") || "—"} />
          </dl>
        </div>
        <div className="card">
          <h2 className="font-semibold mb-2">Empleo</h2>
          <dl className="text-sm space-y-1">
            <Row label="Tipo" v={e.employeeType} />
            <Row label="Sueldo / Tarifa"
                 v={e.employeeType === "SALARIED"
                   ? `${fmtUSD(e.annualSalary ?? 0)}/yr`
                   : `${fmtUSD(e.hourlyRate ?? 0)}/hr`} />
            <Row label="Departamento" v={e.department ?? "—"} />
            <Row label="Puesto" v={e.jobTitle ?? "—"} />
            <Row label="Ingreso" v={e.hireDate.toISOString().slice(0, 10)} />
            <Row label="Estado" v={e.status} />
          </dl>
        </div>
        <div className="card">
          <h2 className="font-semibold mb-2">Fiscal</h2>
          <dl className="text-sm space-y-1">
            <Row label="Filing status" v={e.filingStatus} />
            <Row label="Dependientes" v={String(e.exemptions)} />
            <Row label="Retención adicional" v={fmtUSD(e.extraWithholding)} />
            <Row label="Balance PTO" v={`${toNumber(e.ptoBalance).toFixed(2)} días`} />
          </dl>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Últimos pay stubs</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Período</th><th>Pago</th><th>Gross</th><th>Deducciones</th><th>Neto</th><th></th>
            </tr>
          </thead>
          <tbody>
            {e.payStubs.map((s) => (
              <tr key={s.id}>
                <td>{s.payrollRun.payPeriod.startDate.toISOString().slice(0,10)} → {s.payrollRun.payPeriod.endDate.toISOString().slice(0,10)}</td>
                <td>{s.payrollRun.payPeriod.payDate.toISOString().slice(0,10)}</td>
                <td>{fmtUSD(s.grossPay)}</td>
                <td>{fmtUSD(s.totalDeductions)}</td>
                <td className="font-semibold">{fmtUSD(s.netPay)}</td>
                <td><a href={`/api/paystubs/${s.id}/pdf`} className="text-brand-600 hover:underline">PDF</a></td>
              </tr>
            ))}
            {e.payStubs.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-slate-500">Sin pay stubs.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Solicitudes PTO recientes</h2>
        <table className="table">
          <thead><tr><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días</th><th>Estado</th></tr></thead>
          <tbody>
            {e.ptoRequests.map((r) => (
              <tr key={r.id}>
                <td>{r.type}</td>
                <td>{r.startDate.toISOString().slice(0,10)}</td>
                <td>{r.endDate.toISOString().slice(0,10)}</td>
                <td>{toNumber(r.days).toFixed(2)}</td>
                <td><span className="badge bg-slate-100 text-slate-700">{r.status}</span></td>
              </tr>
            ))}
            {e.ptoRequests.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-500">Sin solicitudes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-right">{v}</dd>
    </div>
  );
}
