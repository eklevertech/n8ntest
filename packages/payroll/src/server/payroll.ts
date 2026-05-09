'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/session';
import {
  computePayStub,
  splitRegularOvertime,
  type FilingStatus,
} from '@/lib/tax/puertoRico';

const periodSchema = z
  .object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    payDate: z.string().min(1),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: 'Fin debe ser >= inicio',
    path: ['endDate'],
  });

export async function createPayPeriod(_prev: unknown, fd: FormData) {
  await requireRole(['ADMIN', 'HR']);
  const obj: Record<string, string> = {};
  for (const [k, v] of fd.entries()) obj[k] = String(v);
  const parsed = periodSchema.safeParse(obj);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Inválido' };
  try {
    const created = await prisma.payPeriod.create({
      data: {
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        payDate: new Date(parsed.data.payDate),
        status: 'OPEN',
      },
    });
    revalidatePath('/payroll');
    redirect(`/payroll/${created.id}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes('NEXT_REDIRECT')) throw e;
    return { error: e instanceof Error ? e.message : 'Error' };
  }
}

const bonusSchema = z.object({
  payPeriodId: z.string().min(1),
  employeeId: z.string().min(1),
  type: z.enum(['BONUS', 'COMMISSION', 'REIMBURSEMENT']),
  amount: z.coerce.number().positive(),
  description: z.string().optional().or(z.literal('')),
});

export async function addBonus(_prev: unknown, fd: FormData) {
  await requireRole(['ADMIN', 'HR']);
  const obj: Record<string, string> = {};
  for (const [k, v] of fd.entries()) obj[k] = String(v);
  const parsed = bonusSchema.safeParse(obj);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Inválido' };
  await prisma.bonus.create({
    data: {
      payPeriodId: parsed.data.payPeriodId,
      employeeId: parsed.data.employeeId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description || null,
    },
  });
  revalidatePath(`/payroll/${parsed.data.payPeriodId}`);
  return { ok: true };
}

export async function deleteBonus(id: string, payPeriodId: string) {
  await requireRole(['ADMIN', 'HR']);
  await prisma.bonus.delete({ where: { id } });
  revalidatePath(`/payroll/${payPeriodId}`);
}

const num = (d: Prisma.Decimal | number | null | undefined): number => {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : d.toNumber();
};

export async function processPayroll(payPeriodId: string) {
  const session = await requireRole(['ADMIN', 'HR']);

  const period = await prisma.payPeriod.findUnique({ where: { id: payPeriodId } });
  if (!period) return { error: 'Período no encontrado' };
  if (period.status !== 'OPEN') return { error: 'Solo se puede procesar un período OPEN' };

  const yearStart = new Date(Date.UTC(period.startDate.getUTCFullYear(), 0, 1));

  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
  });

  let totalGross = 0;
  let totalNet = 0;
  let totalTaxes = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const emp of employees) {
        // YTD prior — solo recibos previos a este período (excluye este si ya existiera).
        const priorStubs = await tx.payStub.findMany({
          where: {
            employeeId: emp.id,
            payPeriodId: { not: payPeriodId },
            payPeriod: {
              payDate: { gte: yearStart, lte: period.endDate },
            },
          },
          select: {
            grossPay: true,
            reimbursements: true,
            netPay: true,
            prIncomeTax: true,
            socialSecurity: true,
            medicare: true,
          },
        });
        const ytdGrossPrior = priorStubs.reduce((s, r) => s + num(r.grossPay), 0);
        const ytdSsWagesPrior = priorStubs.reduce(
          (s, r) => s + (num(r.grossPay) - num(r.reimbursements)),
          0,
        );
        const ytdMedicareWagesPrior = ytdSsWagesPrior;
        const ytdSinotWagesPrior = ytdSsWagesPrior;
        const ytdNetPrior = priorStubs.reduce((s, r) => s + num(r.netPay), 0);
        const ytdPrIncomeTaxPrior = priorStubs.reduce((s, r) => s + num(r.prIncomeTax), 0);
        const ytdSsPrior = priorStubs.reduce((s, r) => s + num(r.socialSecurity), 0);
        const ytdMedicarePrior = priorStubs.reduce((s, r) => s + num(r.medicare), 0);

        // Time entries APPROVED dentro del rango.
        const entries = await tx.timeEntry.findMany({
          where: {
            employeeId: emp.id,
            status: 'APPROVED',
            date: { gte: period.startDate, lte: period.endDate },
          },
        });
        const split = splitRegularOvertime(
          entries.map((e) => ({ date: e.date, hours: num(e.hours) })),
        );

        // Bonos del período.
        const bonuses = await tx.bonus.findMany({
          where: { payPeriodId: period.id, employeeId: emp.id },
        });
        const bonusPay = bonuses
          .filter((b) => b.type === 'BONUS')
          .reduce((s, b) => s + num(b.amount), 0);
        const commissionPay = bonuses
          .filter((b) => b.type === 'COMMISSION')
          .reduce((s, b) => s + num(b.amount), 0);
        const reimbursements = bonuses
          .filter((b) => b.type === 'REIMBURSEMENT')
          .reduce((s, b) => s + num(b.amount), 0);

        // Pago regular y OT.
        let regularPay = 0;
        let overtimePay = 0;
        let regularHours = split.regularHours;
        let overtimeHours = split.overtimeHours;
        if (emp.employeeType === 'SALARIED') {
          regularPay = num(emp.annualSalary) / 26; // bi-weekly
          regularHours = 0;
          overtimeHours = 0;
        } else {
          const rate = num(emp.hourlyRate);
          regularPay = split.regularHours * rate;
          overtimePay = split.overtimeHours * rate * 1.5;
        }

        const breakdown = computePayStub({
          kind: emp.employeeType,
          frequency: 'BIWEEKLY',
          filingStatus: emp.filingStatus as FilingStatus,
          exemptions: emp.exemptions,
          extraWithholding: num(emp.extraWithholding),
          regularPay,
          overtimePay,
          bonusPay,
          commissionPay,
          reimbursements,
          regularHours,
          overtimeHours,
          ytdGrossPrior,
          ytdSocialSecurityWagesPrior: ytdSsWagesPrior,
          ytdMedicareWagesPrior,
          ytdSinotWagesPrior,
        });

        if (breakdown.grossPay <= 0) continue;

        await tx.payStub.upsert({
          where: {
            employeeId_payPeriodId: {
              employeeId: emp.id,
              payPeriodId: period.id,
            },
          },
          create: {
            employeeId: emp.id,
            payPeriodId: period.id,
            regularHours,
            overtimeHours,
            regularPay: breakdown.regularPay,
            overtimePay: breakdown.overtimePay,
            bonusPay: breakdown.bonusPay,
            commissionPay: breakdown.commissionPay,
            reimbursements: breakdown.reimbursements,
            grossPay: breakdown.grossPay,
            prIncomeTax: breakdown.prIncomeTax,
            socialSecurity: breakdown.socialSecurity,
            medicare: breakdown.medicare,
            sinotEmployee: breakdown.sinotEmployee,
            extraWithheld: breakdown.extraWithheld,
            totalDeductions: breakdown.totalDeductions,
            netPay: breakdown.netPay,
            employerSS: breakdown.employerSS,
            employerMedicare: breakdown.employerMedicare,
            employerSinot: breakdown.employerSinot,
            ytdGross: ytdGrossPrior + breakdown.grossPay,
            ytdNet: ytdNetPrior + breakdown.netPay,
            ytdPrIncomeTax: ytdPrIncomeTaxPrior + breakdown.prIncomeTax,
            ytdSocialSecurity: ytdSsPrior + breakdown.socialSecurity,
            ytdMedicare: ytdMedicarePrior + breakdown.medicare,
          },
          update: {
            regularHours,
            overtimeHours,
            regularPay: breakdown.regularPay,
            overtimePay: breakdown.overtimePay,
            bonusPay: breakdown.bonusPay,
            commissionPay: breakdown.commissionPay,
            reimbursements: breakdown.reimbursements,
            grossPay: breakdown.grossPay,
            prIncomeTax: breakdown.prIncomeTax,
            socialSecurity: breakdown.socialSecurity,
            medicare: breakdown.medicare,
            sinotEmployee: breakdown.sinotEmployee,
            extraWithheld: breakdown.extraWithheld,
            totalDeductions: breakdown.totalDeductions,
            netPay: breakdown.netPay,
            employerSS: breakdown.employerSS,
            employerMedicare: breakdown.employerMedicare,
            employerSinot: breakdown.employerSinot,
            ytdGross: ytdGrossPrior + breakdown.grossPay,
            ytdNet: ytdNetPrior + breakdown.netPay,
            ytdPrIncomeTax: ytdPrIncomeTaxPrior + breakdown.prIncomeTax,
            ytdSocialSecurity: ytdSsPrior + breakdown.socialSecurity,
            ytdMedicare: ytdMedicarePrior + breakdown.medicare,
          },
        });

        totalGross += breakdown.grossPay;
        totalNet += breakdown.netPay;
        totalTaxes += breakdown.totalDeductions;
      }

      await tx.payrollRun.upsert({
        where: { payPeriodId: period.id },
        create: {
          payPeriodId: period.id,
          processedBy: session.user.email ?? session.user.id,
          totalGross,
          totalNet,
          totalTaxes,
        },
        update: {
          processedAt: new Date(),
          processedBy: session.user.email ?? session.user.id,
          totalGross,
          totalNet,
          totalTaxes,
        },
      });

      await tx.payPeriod.update({
        where: { id: period.id },
        data: { status: 'PROCESSING' },
      });
    },
    { timeout: 60_000 },
  );

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${period.id}`);
  return { ok: true };
}

export async function markPeriodAsPaid(payPeriodId: string) {
  await requireRole(['ADMIN', 'HR']);
  await prisma.payPeriod.update({
    where: { id: payPeriodId },
    data: { status: 'PAID' },
  });
  revalidatePath('/payroll');
  revalidatePath(`/payroll/${payPeriodId}`);
}
