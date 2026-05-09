import { requireRole } from "@/lib/rbac";
import EmployeeForm from "../_form";
import { createEmployee } from "../actions";

export default async function NewEmployeePage() {
  await requireRole(["ADMIN", "HR"]);
  async function action(formData: FormData) {
    "use server";
    return createEmployee(formData);
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo empleado</h1>
      <EmployeeForm action={action} />
    </div>
  );
}
