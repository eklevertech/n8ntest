"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { computePayStub } from "@/lib/tax/puertoRico";
import { payPeriodSchema, bonusSchema } from "@/lib/validation";
import { toNumber } from "@/lib/money";

export async function createPayPeriod(formData: FormData) {
  await requireRole(["ADMIN", "HR"]);
  const parsed = payPeriodSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  await prisma.payPeriod.create({
    data: {
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      payDate: new Date(parsed.data.payDate),
    },
  });
  revalidatePath("/payroll");
  return { ok: true };
}

export async function addBonus(formData: FormData) {
  await requireRole(["ADMIN", "HR"]);
  const parsed = bonusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  await prisma.bonus.create({
    data: {
      employeeId: parsed.data.employeeId,
      payPeriodId: parsed.data.payPeriodId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description || null,
    },
  });
  revalidatePath(`/payroll/${parsed.data.payPeriodId}`);
  return { ok: true };
}

const OVERTIME_PER_WEEK = 40;

export async function processPayPeriod(payPeriodId: string) {
  const session = await requireRole(["ADMIN", "HR"]);
  const period = await prisma.payPeriod.findUnique({
    where: { id: payPeriodId },
    include: { bonuses: true },
  });
  if (!period) return { ok: false, error: "Período no encontrado" };
  if (period.status !== "OPEN") return { ok: false, error: "El período no está abierto" };

  const employees = await prisma.employee.findMany({
    where: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
  });

  const yearStart = new Date(period.startDate.getFullYear(), 0, 1);
  let totalGross = 0;
  let totalNet = 0;
  let totalTaxes = 0;

  await prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({
      data: {
        payPeriodId,
        processedBy: session.user.email ?? session.user.id,
      },
    });

    for (const emp of employees) {
      // YTD prior to this period for FICA cap purposes
      const prior = await tx.payStub.aggregate({
        where: {
          employeeId: emp.id,
          payrollRun: { payPeriod: { startDate: { gte: yearStart, lt: period.startDate } } },
        },
        _sum: {
          grossPay: true,
          netPay: true,
          prIncomeTax: true,
          socialSecurity: true,
          medicare: true,
        },
      });
      const ytdGrossBefore = toNumber(prior._sum.grossPay ?? 0);

      // Hours from APPROVED time entries within period
      const entries = await tx.timeEntry.findMany({
        where: {
          employeeId: emp.id,
          status: "APPROVED",
          date: { gte: period.startDate, lte: period.endDate },
          hours: { not: null },
        },
        orderBy: { date: "asc" },
      });

      // Group hours by ISO week to apply overtime > 40h
      const byWeek = new Map<string, number>();
      for (const t of entries) {
        const d = new Date(t.date);
        // ISO week key: yyyy-w
        const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = (tmp.getUTCDay() + 6) % 7;
        tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
        const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
        const week =
          1 + Math.round(((tmp.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
        const key = `${tmp.getUTCFullYear()}-${week}`;
        byWeek.set(key, (byWeek.get(key) ?? 0) + toNumber(t.hours));
      }

      let regularHours = 0;
      let overtimeHours = 0;
      for (const h of byWeek.values()) {
        regularHours += Math.min(h, OVERTIME_PER_WEEK);
        overtimeHours += Math.max(0, h - OVERTIME_PER_WEEK);
      }

      // Bonuses for this period
      const empBonuses = period.bonuses.filter((b) => b.employeeId === emp.id);
      const bonus = empBonuses.filter((b) => b.type === "BONUS").reduce((s, b) => s + toNumber(b.amount), 0);
      const commission = empBonuses.filter((b) => b.type === "COMMISSION").reduce((s, b) => s + toNumber(b.amount), 0);
      const reimbursements = empBonuses.filter((b) => b.type === "REIMBURSEMENT").reduce((s, b) => s + toNumber(b.amount), 0);

      const result = computePayStub({
        employeeType: emp.employeeType,
        annualSalary: emp.annualSalary ? toNumber(emp.annualSalary) : null,
        hourlyRate: emp.hourlyRate ? toNumber(emp.hourlyRate) : null,
        regularHours,
        overtimeHours,
        bonus,
        commission,
        reimbursements,
        filingStatus: emp.filingStatus,
        dependents: emp.exemptions,
        extraWithholding: toNumber(emp.extraWithholding),
        frequency: "BIWEEKLY",
        ytdGrossBefore,
      });

      // Skip employees with zero gross (e.g. hourly with no hours, no bonuses)
      if (result.grossPay <= 0) continue;

      await tx.payStub.create({
        data: {
          payrollRunId: run.id,
          employeeId: emp.id,
          regularHours,
          overtimeHours,
          regularPay: result.regularPay,
          overtimePay: result.overtimePay,
          bonusPay: result.bonusPay,
          commissionPay: result.commissionPay,
          reimbursements: result.reimbursements,
          grossPay: result.grossPay,
          prIncomeTax: result.prIncomeTax,
          socialSecurity: result.socialSecurity,
          medicare: result.medicare,
          sinotEmployee: result.sinotEmployee,
          extraWithheld: result.extraWithheld,
          totalDeductions: result.totalDeductions,
          netPay: result.netPay,
          employerSS: result.employerSocialSecurity,
          employerMedicare: result.employerMedicare,
          employerSinot: result.employerSinot,
          ytdGross: ytdGrossBefore + result.grossPay,
          ytdNet: toNumber(prior._sum.netPay ?? 0) + result.netPay,
          ytdPrIncomeTax: toNumber(prior._sum.prIncomeTax ?? 0) + result.prIncomeTax,
          ytdSocialSecurity: toNumber(prior._sum.socialSecurity ?? 0) + result.socialSecurity,
          ytdMedicare: toNumber(prior._sum.medicare ?? 0) + result.medicare,
        },
      });

      totalGross += result.grossPay;
      totalNet += result.netPay;
      totalTaxes += result.totalDeductions;
    }

    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalTaxes: Math.round(totalTaxes * 100) / 100,
      },
    });

    await tx.payPeriod.update({
      where: { id: payPeriodId },
      data: { status: "PROCESSING" },
    });
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payPeriodId}`);
  return { ok: true };
}

export async function markPaid(payPeriodId: string) {
  await requireRole(["ADMIN", "HR"]);
  await prisma.payPeriod.update({ where: { id: payPeriodId }, data: { status: "PAID" } });
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payPeriodId}`);
}
