/**
 * Modelo simplificado de retención y nómina para Puerto Rico (año 2024).
 * Las constantes están hardcoded aquí intencionalmente — son la única fuente
 * de verdad para los cálculos fiscales. NO modificar fuera de este archivo.
 *
 * Este es un MODELO SIMPLIFICADO con fines demostrativos. No sustituye la
 * Circular de Hacienda PR ni el cálculo oficial de retención.
 */

export type FilingStatus =
  | 'SINGLE'
  | 'MARRIED_JOINT'
  | 'MARRIED_SEPARATE'
  | 'HEAD_OF_HOUSEHOLD';

export type PayFrequency = 'WEEKLY' | 'BIWEEKLY' | 'SEMIMONTHLY' | 'MONTHLY' | 'ANNUAL';

export type EmployeeKind = 'SALARIED' | 'HOURLY' | 'CONTRACTOR';

// ---------- Constantes 2024 ----------

export const PR_BRACKETS_2024 = [
  { upTo: 9000, rate: 0, base: 0 },
  { upTo: 25000, rate: 0.07, base: 0, floor: 9000 },
  { upTo: 41500, rate: 0.14, base: 1120, floor: 25000 },
  { upTo: 61500, rate: 0.25, base: 3430, floor: 41500 },
  { upTo: Infinity, rate: 0.33, base: 8430, floor: 61500 },
] as const;

export const PERSONAL_EXEMPTION = {
  SINGLE: 3500,
  MARRIED_JOINT: 7000,
  MARRIED_SEPARATE: 3500,
  HEAD_OF_HOUSEHOLD: 3500,
} as const;

export const DEPENDENT_EXEMPTION = 2500;

export const FICA_2024 = {
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 168_600,
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThreshold: 200_000,
} as const;

export const SINOT_2024 = {
  totalRate: 0.003, // 0.30% total
  wageCap: 9_000,
  // Mitad lo paga el empleado, mitad el empleador.
  employeeRate: 0.0015,
  employerRate: 0.0015,
} as const;

export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  SEMIMONTHLY: 24,
  MONTHLY: 12,
  ANNUAL: 1,
};

// ---------- Tipos ----------

export interface ComputePayStubInput {
  kind: EmployeeKind;
  frequency: PayFrequency;
  filingStatus: FilingStatus;
  exemptions: number;
  extraWithholding: number;
  // Earnings del período
  regularPay: number;
  overtimePay: number;
  bonusPay: number;
  commissionPay: number;
  reimbursements: number;
  regularHours?: number;
  overtimeHours?: number;
  // YTD ANTES de este período (acumulados previos)
  ytdGrossPrior: number;
  ytdSocialSecurityWagesPrior: number;
  ytdMedicareWagesPrior: number;
  ytdSinotWagesPrior: number;
}

export interface PayStubBreakdown {
  regularPay: number;
  overtimePay: number;
  bonusPay: number;
  commissionPay: number;
  reimbursements: number;
  grossPay: number;
  taxableGross: number;
  prIncomeTax: number;
  socialSecurity: number;
  medicare: number;
  sinotEmployee: number;
  extraWithheld: number;
  totalDeductions: number;
  netPay: number;
  employerSS: number;
  employerMedicare: number;
  employerSinot: number;
}

// ---------- Helpers ----------

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Impuesto anual de PR según los brackets 2024. */
export function prAnnualIncomeTax(annualTaxable: number): number {
  if (annualTaxable <= 0) return 0;
  for (const b of PR_BRACKETS_2024) {
    if (annualTaxable <= b.upTo) {
      const floor = (b as { floor?: number }).floor ?? 0;
      return round2(b.base + (annualTaxable - floor) * b.rate);
    }
  }
  return 0;
}

export function totalPersonalExemption(
  filingStatus: FilingStatus,
  exemptions: number,
): number {
  return PERSONAL_EXEMPTION[filingStatus] + Math.max(0, exemptions) * DEPENDENT_EXEMPTION;
}

/** Retención de PR para un período usando método de anualización. */
export function prWithholdingForPeriod(
  taxableThisPeriod: number,
  filingStatus: FilingStatus,
  exemptions: number,
  frequency: PayFrequency,
): number {
  const periods = PERIODS_PER_YEAR[frequency];
  const annualGross = taxableThisPeriod * periods;
  const exemption = totalPersonalExemption(filingStatus, exemptions);
  const annualTaxable = Math.max(0, annualGross - exemption);
  const annualTax = prAnnualIncomeTax(annualTaxable);
  return round2(annualTax / periods);
}

/** SS con cap por wage base usando YTD. Retorna lo que aplica este período. */
export function socialSecurityForPeriod(taxableWages: number, ytdSsWages: number): number {
  const remaining = Math.max(0, FICA_2024.socialSecurityWageBase - ytdSsWages);
  const subject = Math.min(taxableWages, remaining);
  return round2(subject * FICA_2024.socialSecurityRate);
}

/** Medicare con additional Medicare sobre $200k YTD (lado empleado). */
export function medicareForPeriod(taxableWages: number, ytdMedicareWages: number): number {
  const base = round2(taxableWages * FICA_2024.medicareRate);
  const newYtd = ytdMedicareWages + taxableWages;
  let additional = 0;
  if (newYtd > FICA_2024.additionalMedicareThreshold) {
    const overFromPrior = Math.max(0, ytdMedicareWages - FICA_2024.additionalMedicareThreshold);
    const overFromNew = newYtd - FICA_2024.additionalMedicareThreshold;
    const subjectAdditional = overFromNew - overFromPrior;
    additional = round2(subjectAdditional * FICA_2024.additionalMedicareRate);
  }
  return round2(base + additional);
}

/** SINOT (empleado) — 0.15% sobre los primeros $9,000/año. */
export function sinotEmployeeForPeriod(taxableWages: number, ytdSinotWages: number): number {
  const remaining = Math.max(0, SINOT_2024.wageCap - ytdSinotWages);
  const subject = Math.min(taxableWages, remaining);
  return round2(subject * SINOT_2024.employeeRate);
}

/** SINOT (empleador) — 0.15% sobre los primeros $9,000/año. */
export function sinotEmployerForPeriod(taxableWages: number, ytdSinotWages: number): number {
  const remaining = Math.max(0, SINOT_2024.wageCap - ytdSinotWages);
  const subject = Math.min(taxableWages, remaining);
  return round2(subject * SINOT_2024.employerRate);
}

// ---------- Cálculo principal ----------

export function computePayStub(input: ComputePayStubInput): PayStubBreakdown {
  const reimbursements = round2(input.reimbursements || 0);
  const earnings = round2(
    (input.regularPay || 0) +
      (input.overtimePay || 0) +
      (input.bonusPay || 0) +
      (input.commissionPay || 0),
  );
  const grossPay = round2(earnings + reimbursements);

  // Contratistas (1099): sin retención, sin FICA, sin SINOT.
  if (input.kind === 'CONTRACTOR') {
    return {
      regularPay: round2(input.regularPay || 0),
      overtimePay: round2(input.overtimePay || 0),
      bonusPay: round2(input.bonusPay || 0),
      commissionPay: round2(input.commissionPay || 0),
      reimbursements,
      grossPay,
      taxableGross: 0,
      prIncomeTax: 0,
      socialSecurity: 0,
      medicare: 0,
      sinotEmployee: 0,
      extraWithheld: 0,
      totalDeductions: 0,
      netPay: grossPay,
      employerSS: 0,
      employerMedicare: 0,
      employerSinot: 0,
    };
  }

  // Reembolsos no son taxables: se restan antes del cálculo de impuestos.
  const taxableGross = earnings;

  const prIncomeTax = prWithholdingForPeriod(
    taxableGross,
    input.filingStatus,
    input.exemptions,
    input.frequency,
  );
  const socialSecurity = socialSecurityForPeriod(
    taxableGross,
    input.ytdSocialSecurityWagesPrior,
  );
  const medicare = medicareForPeriod(taxableGross, input.ytdMedicareWagesPrior);
  const sinotEmployee = sinotEmployeeForPeriod(taxableGross, input.ytdSinotWagesPrior);
  const employerSS = round2(
    Math.min(
      taxableGross,
      Math.max(0, FICA_2024.socialSecurityWageBase - input.ytdSocialSecurityWagesPrior),
    ) * FICA_2024.socialSecurityRate,
  );
  const employerMedicare = round2(taxableGross * FICA_2024.medicareRate);
  const employerSinot = sinotEmployerForPeriod(taxableGross, input.ytdSinotWagesPrior);
  const extraWithheld = round2(input.extraWithholding || 0);

  const totalDeductions = round2(
    prIncomeTax + socialSecurity + medicare + sinotEmployee + extraWithheld,
  );
  const netPay = round2(grossPay - totalDeductions);

  return {
    regularPay: round2(input.regularPay || 0),
    overtimePay: round2(input.overtimePay || 0),
    bonusPay: round2(input.bonusPay || 0),
    commissionPay: round2(input.commissionPay || 0),
    reimbursements,
    grossPay,
    taxableGross,
    prIncomeTax,
    socialSecurity,
    medicare,
    sinotEmployee,
    extraWithheld,
    totalDeductions,
    netPay,
    employerSS,
    employerMedicare,
    employerSinot,
  };
}

// ---------- Overtime helpers ----------

/** Devuelve clave ISO YYYY-Www para una fecha. Domingo se considera fin de la semana ISO. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export interface HoursSplit {
  regularHours: number;
  overtimeHours: number;
}

/** Agrupa horas por semana ISO y separa regular/overtime con el umbral 40h. */
export function splitRegularOvertime(
  entries: Array<{ date: Date; hours: number }>,
  weeklyThreshold = 40,
): HoursSplit {
  const byWeek = new Map<string, number>();
  for (const e of entries) {
    const k = isoWeekKey(e.date);
    byWeek.set(k, (byWeek.get(k) ?? 0) + e.hours);
  }
  let regular = 0;
  let overtime = 0;
  for (const total of byWeek.values()) {
    if (total <= weeklyThreshold) {
      regular += total;
    } else {
      regular += weeklyThreshold;
      overtime += total - weeklyThreshold;
    }
  }
  return {
    regularHours: round2(regular),
    overtimeHours: round2(overtime),
  };
}

export function maskSsn(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  const last4 = digits.slice(-4).padStart(4, '*');
  return `XXX-XX-${last4}`;
}
