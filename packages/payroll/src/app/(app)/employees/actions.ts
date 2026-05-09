"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { employeeSchema } from "@/lib/validation";

function parse(formData: FormData) {
  const obj = Object.fromEntries(formData.entries());
  return employeeSchema.safeParse(obj);
}

export async function createEmployee(formData: FormData) {
  await requireRole(["ADMIN", "HR"]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  try {
    await prisma.employee.create({
      data: {
        employeeNumber: d.employeeNumber,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone || null,
        address: d.address || null,
        city: d.city || null,
        zipCode: d.zipCode || null,
        ssn: d.ssn || null,
        dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
        hireDate: new Date(d.hireDate),
        jobTitle: d.jobTitle || null,
        department: d.department || null,
        employeeType: d.employeeType,
        annualSalary: d.annualSalary ?? null,
        hourlyRate: d.hourlyRate ?? null,
        filingStatus: d.filingStatus,
        exemptions: d.exemptions,
        extraWithholding: d.extraWithholding,
        ptoBalance: d.ptoBalance,
        status: d.status,
      },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  await requireRole(["ADMIN", "HR"]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  try {
    await prisma.employee.update({
      where: { id },
      data: {
        employeeNumber: d.employeeNumber,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone || null,
        address: d.address || null,
        city: d.city || null,
        zipCode: d.zipCode || null,
        ssn: d.ssn || null,
        dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
        hireDate: new Date(d.hireDate),
        jobTitle: d.jobTitle || null,
        department: d.department || null,
        employeeType: d.employeeType,
        annualSalary: d.annualSalary ?? null,
        hourlyRate: d.hourlyRate ?? null,
        filingStatus: d.filingStatus,
        exemptions: d.exemptions,
        extraWithholding: d.extraWithholding,
        ptoBalance: d.ptoBalance,
        status: d.status,
        terminationDate: d.status === "TERMINATED" ? new Date() : null,
      },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  redirect(`/employees/${id}`);
}
