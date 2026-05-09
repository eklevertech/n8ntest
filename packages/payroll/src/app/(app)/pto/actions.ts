"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/rbac";
import { ptoRequestSchema } from "@/lib/validation";

function businessDaysBetween(start: Date, end: Date): number {
  if (end < start) return 0;
  let days = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export async function createPtoRequest(formData: FormData) {
  const session = await requireSession();
  const data = Object.fromEntries(formData.entries());

  // EMPLOYEE can only create for themselves
  if (session.user.role === "EMPLOYEE") {
    if (!session.user.employeeId) return { ok: false, error: "Sin empleado asociado" };
    data.employeeId = session.user.employeeId;
  }

  const parsed = ptoRequestSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const days = businessDaysBetween(new Date(parsed.data.startDate), new Date(parsed.data.endDate));
  if (days <= 0) return { ok: false, error: "Rango de fechas inválido" };

  await prisma.ptoRequest.create({
    data: {
      employeeId: parsed.data.employeeId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      days,
      type: parsed.data.type,
      reason: parsed.data.reason || null,
    },
  });

  revalidatePath("/pto");
  return { ok: true };
}

export async function reviewPtoRequest(id: string, decision: "APPROVED" | "REJECTED", note?: string) {
  const session = await requireRole(["ADMIN", "HR"]);
  const req = await prisma.ptoRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!req || req.status !== "PENDING") return;

  await prisma.$transaction(async (tx) => {
    await tx.ptoRequest.update({
      where: { id },
      data: {
        status: decision,
        reviewedAt: new Date(),
        reviewedBy: session.user.email ?? session.user.id,
        reviewNote: note ?? null,
      },
    });
    if (decision === "APPROVED" && req.type !== "UNPAID") {
      await tx.employee.update({
        where: { id: req.employeeId },
        data: { ptoBalance: { decrement: req.days } },
      });
    }
  });

  revalidatePath("/pto");
}

export async function cancelPtoRequest(id: string) {
  const session = await requireSession();
  const req = await prisma.ptoRequest.findUnique({ where: { id } });
  if (!req) return;
  if (
    session.user.role === "EMPLOYEE" &&
    req.employeeId !== session.user.employeeId
  ) return;
  if (req.status !== "PENDING") return;
  await prisma.ptoRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/pto");
}
