'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/session';

const employeeSchema = z
  .object({
    employeeNumber: z.string().min(1).max(20),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    email: z.string().email(),
    phone: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    zipCode: z.string().optional().or(z.literal('')),
    ssn: z.string().min(9).max(11),
    dateOfBirth: z.string().min(1),
    hireDate: z.string().min(1),
    terminationDate: z.string().optional().or(z.literal('')),
    status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED']),
    jobTitle: z.string().min(1),
    department: z.string().optional().or(z.literal('')),
    employeeType: z.enum(['SALARIED', 'HOURLY', 'CONTRACTOR']),
    annualSalary: z.coerce.number().nonnegative().optional(),
    hourlyRate: z.coerce.number().nonnegative().optional(),
    filingStatus: z.enum(['SINGLE', 'MARRIED_JOINT', 'MARRIED_SEPARATE', 'HEAD_OF_HOUSEHOLD']),
    exemptions: z.coerce.number().int().nonnegative().default(0),
    extraWithholding: z.coerce.number().nonnegative().default(0),
    ptoBalance: z.coerce.number().nonnegative().default(0),
  })
  .refine(
    (d) =>
      d.employeeType !== 'SALARIED' || (d.annualSalary !== undefined && d.annualSalary > 0),
    { message: 'Salaried requiere salario anual', path: ['annualSalary'] },
  )
  .refine(
    (d) =>
      d.employeeType !== 'HOURLY' || (d.hourlyRate !== undefined && d.hourlyRate > 0),
    { message: 'Hourly requiere tarifa por hora', path: ['hourlyRate'] },
  );

function fdToObject(fd: FormData) {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) out[k] = String(v);
  return out;
}

export async function createEmployee(_prev: unknown, fd: FormData) {
  await requireRole(['ADMIN', 'HR']);
  const parsed = employeeSchema.safeParse(fdToObject(fd));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  const d = parsed.data;
  try {
    await prisma.employee.create({
      data: {
        employeeNumber: d.employeeNumber,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email.toLowerCase(),
        phone: d.phone || null,
        address: d.address || null,
        city: d.city || null,
        state: d.state || 'PR',
        zipCode: d.zipCode || null,
        ssn: d.ssn,
        dateOfBirth: new Date(d.dateOfBirth),
        hireDate: new Date(d.hireDate),
        terminationDate: d.terminationDate ? new Date(d.terminationDate) : null,
        status: d.status,
        jobTitle: d.jobTitle,
        department: d.department || null,
        employeeType: d.employeeType,
        annualSalary: d.employeeType === 'SALARIED' ? d.annualSalary : null,
        hourlyRate:
          d.employeeType === 'HOURLY' || d.employeeType === 'CONTRACTOR' ? d.hourlyRate ?? null : null,
        filingStatus: d.filingStatus,
        exemptions: d.exemptions,
        extraWithholding: d.extraWithholding,
        ptoBalance: d.ptoBalance,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `No se pudo crear: ${msg}` };
  }
  revalidatePath('/employees');
  redirect('/employees');
}

export async function updateEmployee(id: string, _prev: unknown, fd: FormData) {
  await requireRole(['ADMIN', 'HR']);
  const parsed = employeeSchema.safeParse(fdToObject(fd));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  const d = parsed.data;
  try {
    await prisma.employee.update({
      where: { id },
      data: {
        employeeNumber: d.employeeNumber,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email.toLowerCase(),
        phone: d.phone || null,
        address: d.address || null,
        city: d.city || null,
        state: d.state || 'PR',
        zipCode: d.zipCode || null,
        ssn: d.ssn,
        dateOfBirth: new Date(d.dateOfBirth),
        hireDate: new Date(d.hireDate),
        terminationDate: d.terminationDate ? new Date(d.terminationDate) : null,
        status: d.status,
        jobTitle: d.jobTitle,
        department: d.department || null,
        employeeType: d.employeeType,
        annualSalary: d.employeeType === 'SALARIED' ? d.annualSalary : null,
        hourlyRate:
          d.employeeType === 'HOURLY' || d.employeeType === 'CONTRACTOR' ? d.hourlyRate ?? null : null,
        filingStatus: d.filingStatus,
        exemptions: d.exemptions,
        extraWithholding: d.extraWithholding,
        ptoBalance: d.ptoBalance,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `No se pudo actualizar: ${msg}` };
  }
  revalidatePath('/employees');
  revalidatePath(`/employees/${id}`);
  redirect(`/employees/${id}`);
}
