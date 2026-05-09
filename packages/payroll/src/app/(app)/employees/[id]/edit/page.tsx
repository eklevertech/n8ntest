import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import EmployeeForm from "../../_form";
import { updateEmployee } from "../../actions";
import { toNumber } from "@/lib/money";

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  await requireRole(["ADMIN", "HR"]);
  const e = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!e) notFound();

  async function action(formData: FormData) {
    "use server";
    return updateEmployee(params.id, formData);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Editar empleado</h1>
      <EmployeeForm
        action={action}
        initial={{
          ...e,
          dateOfBirth: e.dateOfBirth ? e.dateOfBirth.toISOString().slice(0, 10) : null,
          hireDate: e.hireDate.toISOString().slice(0, 10),
          annualSalary: e.annualSalary ? toNumber(e.annualSalary) : null,
          hourlyRate: e.hourlyRate ? toNumber(e.hourlyRate) : null,
          extraWithholding: toNumber(e.extraWithholding),
          ptoBalance: toNumber(e.ptoBalance),
        }}
      />
    </div>
  );
}
