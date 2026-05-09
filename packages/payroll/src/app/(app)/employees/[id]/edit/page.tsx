import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { EmployeeForm } from '@/components/EmployeeForm';
import { updateEmployee } from '@/server/employees';

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['ADMIN', 'HR']);
  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) notFound();

  const action = updateEmployee.bind(null, employee.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Editar: {employee.firstName} {employee.lastName}
      </h1>
      <EmployeeForm action={action} initial={employee} submitLabel="Guardar cambios" />
    </div>
  );
}
