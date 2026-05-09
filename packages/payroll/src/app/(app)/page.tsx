import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { fmtCurrency, fmtDate, toNumber } from '@/lib/format';

export default async function DashboardPage() {
  const session = await requireSession();
  const role = session.user.role;

  if (role === 'EMPLOYEE') {
    return <EmployeeDashboard employeeId={session.user.employeeId} />;
  }

  const [activeEmployees, openPeriod, lastRun, pendingPto, pendingTime] = await Promise.all([
    prisma.employee.count({ where: { status: 'ACTIVE' } }),
    prisma.payPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startDate: 'desc' } }),
    prisma.payrollRun.findFirst({
      orderBy: { processedAt: 'desc' },
      include: { payPeriod: true },
    }),
    prisma.ptoRequest.count({ where: { status: 'PENDING' } }),
    prisma.timeEntry.count({ where: { status: 'PENDING' } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Panel</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="Empleados activos" value={String(activeEmployees)} />
        <Stat
          label="Período abierto"
          value={
            openPeriod
              ? `${fmtDate(openPeriod.startDate)} – ${fmtDate(openPeriod.endDate)}`
              : 'Ninguno'
          }
        />
        <Stat
          label="Última nómina"
          value={
            lastRun
              ? fmtCurrency(toNumber(lastRun.totalNet))
              : 'Sin procesar'
          }
          sub={lastRun ? fmtDate(lastRun.processedAt) : undefined}
        />
        <Stat label="PTO pendientes" value={String(pendingPto)} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-semibold">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/employees/new" className="btn-primary">+ Nuevo empleado</Link>
          <Link href="/payroll" className="btn-secondary">Procesar nómina</Link>
          <Link href="/attendance" className="btn-secondary">
            Asistencia ({pendingTime} pendientes)
          </Link>
          <Link href="/pto" className="btn-secondary">
            PTO ({pendingPto} pendientes)
          </Link>
          <Link href="/reports" className="btn-secondary">Reportes</Link>
        </div>
      </div>
    </div>
  );
}

async function EmployeeDashboard({ employeeId }: { employeeId: string | null }) {
  if (!employeeId) {
    return (
      <div className="card">
        <p>Tu cuenta no está vinculada a un perfil de empleado. Contacta a RRHH.</p>
      </div>
    );
  }

  const [employee, lastStub, pendingPto] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.payStub.findFirst({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: { payPeriod: true },
    }),
    prisma.ptoRequest.count({ where: { employeeId, status: 'PENDING' } }),
  ]);

  if (!employee) return <p>Empleado no encontrado.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Hola, {employee.firstName}
      </h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label="Último neto"
          value={lastStub ? fmtCurrency(toNumber(lastStub.netPay)) : '—'}
          sub={lastStub ? fmtDate(lastStub.payPeriod.payDate) : undefined}
        />
        <Stat label="Balance PTO" value={`${toNumber(employee.ptoBalance).toFixed(2)} días`} />
        <Stat label="PTO pendientes" value={String(pendingPto)} />
      </div>
      <div className="card flex flex-wrap gap-2">
        <Link href="/attendance" className="btn-primary">Time clock</Link>
        <Link href="/pto" className="btn-secondary">Solicitar PTO</Link>
        <Link href="/me" className="btn-secondary">Mis recibos</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}
