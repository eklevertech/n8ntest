'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/session';

/** Cuenta días laborables L-V (inclusive) entre dos fechas. */
export function businessDaysBetween(start: Date, end: Date): number {
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (e < s) return 0;
  let days = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) days++;
  }
  return days;
}

const ptoSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID']),
  reason: z.string().optional().or(z.literal('')),
});

export async function createPtoRequest(_prev: unknown, fd: FormData) {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return { error: 'Sin perfil de empleado' };

  const obj: Record<string, string> = {};
  for (const [k, v] of fd.entries()) obj[k] = String(v);
  const parsed = ptoSchema.safeParse(obj);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Inválido' };
  const d = parsed.data;
  const start = new Date(d.startDate);
  const end = new Date(d.endDate);
  if (end < start) return { error: 'Fecha fin debe ser >= inicio' };
  const days = businessDaysBetween(start, end);
  if (days <= 0) return { error: 'No hay días laborables en el rango' };

  await prisma.ptoRequest.create({
    data: {
      employeeId,
      startDate: start,
      endDate: end,
      days,
      type: d.type,
      reason: d.reason || null,
      status: 'PENDING',
    },
  });
  revalidatePath('/pto');
  return { ok: true };
}

export async function cancelPtoRequest(id: string) {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  const req = await prisma.ptoRequest.findUnique({ where: { id } });
  if (!req) return;
  // Empleados solo pueden cancelar las propias y solo si están pendientes.
  const canCancel =
    req.status === 'PENDING' &&
    (req.employeeId === employeeId ||
      session.user.role === 'ADMIN' ||
      session.user.role === 'HR');
  if (!canCancel) return;
  await prisma.ptoRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
  revalidatePath('/pto');
}

export async function approvePtoRequest(id: string, note?: string) {
  const session = await requireRole(['ADMIN', 'HR']);
  await prisma.$transaction(async (tx) => {
    const req = await tx.ptoRequest.findUnique({ where: { id } });
    if (!req || req.status !== 'PENDING') return;
    await tx.ptoRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: session.user.id,
        reviewNote: note ?? null,
      },
    });
    if (req.type !== 'UNPAID') {
      await tx.employee.update({
        where: { id: req.employeeId },
        data: { ptoBalance: { decrement: req.days } },
      });
    }
  });
  revalidatePath('/pto');
}

export async function rejectPtoRequest(id: string, note?: string) {
  const session = await requireRole(['ADMIN', 'HR']);
  await prisma.ptoRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
      reviewNote: note ?? null,
    },
  });
  revalidatePath('/pto');
}
