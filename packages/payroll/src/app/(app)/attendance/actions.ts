"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/rbac";

export async function clockIn() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return { ok: false, error: "Tu usuario no está vinculado a un empleado." };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const open = await prisma.timeEntry.findFirst({
    where: { employeeId, clockOut: null },
  });
  if (open) return { ok: false, error: "Ya hay un punch abierto." };

  await prisma.timeEntry.create({
    data: { employeeId, clockIn: new Date(), date: today },
  });
  revalidatePath("/attendance");
  return { ok: true };
}

export async function clockOut() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return { ok: false, error: "Tu usuario no está vinculado a un empleado." };

  const open = await prisma.timeEntry.findFirst({
    where: { employeeId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (!open) return { ok: false, error: "No hay un punch abierto." };

  const out = new Date();
  const hours = (out.getTime() - open.clockIn.getTime()) / 1000 / 3600;
  await prisma.timeEntry.update({
    where: { id: open.id },
    data: { clockOut: out, hours: Number(hours.toFixed(2)) },
  });
  revalidatePath("/attendance");
  return { ok: true };
}

export async function approveTimeEntry(id: string) {
  await requireRole(["ADMIN", "HR"]);
  await prisma.timeEntry.update({ where: { id }, data: { status: "APPROVED" } });
  revalidatePath("/attendance");
}

export async function rejectTimeEntry(id: string) {
  await requireRole(["ADMIN", "HR"]);
  await prisma.timeEntry.update({ where: { id }, data: { status: "REJECTED" } });
  revalidatePath("/attendance");
}

export async function manualEntry(formData: FormData) {
  await requireRole(["ADMIN", "HR"]);
  const employeeId = String(formData.get("employeeId"));
  const date = String(formData.get("date"));
  const hoursStr = String(formData.get("hours"));
  const hours = Number(hoursStr);
  if (!employeeId || !date || !Number.isFinite(hours) || hours <= 0) {
    return { ok: false, error: "Datos inválidos" };
  }
  const day = new Date(date);
  await prisma.timeEntry.create({
    data: {
      employeeId,
      date: day,
      clockIn: day,
      clockOut: new Date(day.getTime() + hours * 3600 * 1000),
      hours,
      status: "APPROVED",
      notes: "Entrada manual",
    },
  });
  revalidatePath("/attendance");
  return { ok: true };
}
