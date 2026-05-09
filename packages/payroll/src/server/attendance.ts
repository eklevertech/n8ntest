'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/session';

export async function clockIn() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return { error: 'Sin perfil de empleado' };

  const open = await prisma.timeEntry.findFirst({
    where: { employeeId, clockIn: { not: null }, clockOut: null },
  });
  if (open) return { error: 'Ya tienes un punch abierto' };

  const now = new Date();
  await prisma.timeEntry.create({
    data: {
      employeeId,
      date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      clockIn: now,
      status: 'PENDING',
    },
  });
  revalidatePath('/attendance');
  return { ok: true };
}

export async function clockOut() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return { error: 'Sin perfil de empleado' };

  const open = await prisma.timeEntry.findFirst({
    where: { employeeId, clockIn: { not: null }, clockOut: null },
    orderBy: { clockIn: 'desc' },
  });
  if (!open || !open.clockIn) return { error: 'No hay punch abierto' };

  const now = new Date();
  const hours = Math.max(0, (now.getTime() - open.clockIn.getTime()) / 3_600_000);
  await prisma.timeEntry.update({
    where: { id: open.id },
    data: { clockOut: now, hours: hours.toFixed(2) },
  });
  revalidatePath('/attendance');
  return { ok: true };
}

const manualSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  hours: z.coerce.number().positive().max(24),
  notes: z.string().optional().or(z.literal('')),
  approved: z.string().optional(),
});

export async function addManualEntry(_prev: unknown, fd: FormData) {
  const session = await requireRole(['ADMIN', 'HR']);
  const obj: Record<string, string> = {};
  for (const [k, v] of fd.entries()) obj[k] = String(v);
  const parsed = manualSchema.safeParse(obj);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Inválido' };
  const d = parsed.data;
  await prisma.timeEntry.create({
    data: {
      employeeId: d.employeeId,
      date: new Date(d.date),
      hours: d.hours,
      notes: d.notes || null,
      status: d.approved ? 'APPROVED' : 'PENDING',
    },
  });
  void session;
  revalidatePath('/attendance');
  return { ok: true };
}

export async function approveTimeEntry(id: string) {
  await requireRole(['ADMIN', 'HR']);
  await prisma.timeEntry.update({ where: { id }, data: { status: 'APPROVED' } });
  revalidatePath('/attendance');
}

export async function rejectTimeEntry(id: string) {
  await requireRole(['ADMIN', 'HR']);
  await prisma.timeEntry.update({ where: { id }, data: { status: 'REJECTED' } });
  revalidatePath('/attendance');
}
