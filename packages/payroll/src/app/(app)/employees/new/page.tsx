import { requireRole } from '@/lib/session';
import { EmployeeForm } from '@/components/EmployeeForm';
import { createEmployee } from '@/server/employees';

export default async function NewEmployeePage() {
  await requireRole(['ADMIN', 'HR']);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo empleado</h1>
      <EmployeeForm action={createEmployee} submitLabel="Crear empleado" />
    </div>
  );
}
