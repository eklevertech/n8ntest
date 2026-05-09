/**
 * Puerto Rico payroll tax engine (simplified MVP).
 *
 * Sources (informational, not legal advice):
 *  - Departamento de Hacienda PR — tablas de retención (Form 499R-1.1)
 *  - IRS — FICA (Social Security + Medicare) for PR residents
 *  - Departamento del Trabajo PR — SINOT (disability)
 *
 * Numbers below reflect commonly-used 2024 brackets and rates and are intended
 * for demonstration. Adjust constants for the current year before production use.
 */

export type FilingStatus =
  | "SINGLE"
  | "MARRIED_JOINT"
  | "MARRIED_SEPARATE"
  | "HEAD_OF_HOUSEHOLD";

export type PayFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "SEMIMONTHLY"
  | "MONTHLY"
  | "ANNUAL";

const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  SEMIMONTHLY: 24,
  MONTHLY: 12,
  ANNUAL: 1,
};

// FICA 2024
const SS_RATE = 0.062;
const SS_WAGE_BASE = 168_600;
const MEDICARE_RATE = 0.0145;
const MEDICARE_ADDL_RATE = 0.009;
const MEDICARE_ADDL_THRESHOLD = 200_000;

// SINOT 2024 — 0.30% on first $9,000, split 50/50 employer/employee
const SINOT_RATE_TOTAL = 0.003;
const SINOT_WAGE_BASE = 9_000;

// Personal exemption (PR), simplified flat per dependent
const PR_PERSONAL_EXEMPTION_SINGLE = 3_500;
const PR_PERSONAL_EXEMPTION_MARRIED = 7_000;
const PR_DEPENDENT_EXEMPTION = 2_500;

// PR income tax brackets (annual taxable income, 2024 simplified)
type Bracket = { upTo: number; base: number; rate: number; over: number };

const PR_BRACKETS: Bracket[] = [
  { upTo: 9_000, base: 0, rate: 0, over: 0 },
  { upTo: 25_000, base: 0, rate: 0.07, over: 9_000 },
  { upTo: 41_500, base: 1_120, rate: 0.14, over: 25_000 },
  { upTo: 61_500, base: 3_430, rate: 0.25, over: 41_500 },
  { upTo: Infinity, base: 8_430, rate: 0.33, over: 61_500 },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function annualizeWage(periodGross: number, frequency: PayFrequency): number {
  return periodGross * PERIODS_PER_YEAR[frequency];
}

export function periodsPerYear(frequency: PayFrequency): number {
  return PERIODS_PER_YEAR[frequency];
}

function personalExemption(filingStatus: FilingStatus, dependents: number): number {
  const base =
    filingStatus === "MARRIED_JOINT"
      ? PR_PERSONAL_EXEMPTION_MARRIED
      : PR_PERSONAL_EXEMPTION_SINGLE;
  return base + dependents * PR_DEPENDENT_EXEMPTION;
}

/** Annual PR income tax for a given annual taxable income. */
export function prAnnualIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  for (const b of PR_BRACKETS) {
    if (taxableIncome <= b.upTo) {
      return round2(b.base + (taxableIncome - b.over) * b.rate);
    }
  }
  return 0;
}

/** Per-period PR income tax withholding using the annualized-wage method. */
export function prPeriodIncomeTax(args: {
  periodGross: number;
  frequency: PayFrequency;
  filingStatus: FilingStatus;
  dependents: number;
}): number {
  const annualGross = annualizeWage(args.periodGross, args.frequency);
  const taxable = Math.max(
    0,
    annualGross - personalExemption(args.filingStatus, args.dependents),
  );
  const annualTax = prAnnualIncomeTax(taxable);
  return round2(annualTax / PERIODS_PER_YEAR[args.frequency]);
}

export type FicaResult = {
  socialSecurity: number;
  medicare: number;
  employerSocialSecurity: number;
  employerMedicare: number;
};

/** FICA per period. Wage-base capping is approximate — uses YTD prior wages. */
export function fica(args: {
  periodGross: number;
  ytdGrossBefore: number;
}): FicaResult {
  const { periodGross, ytdGrossBefore } = args;

  // Social Security cap
  const ssRoom = Math.max(0, SS_WAGE_BASE - ytdGrossBefore);
  const ssTaxable = Math.min(periodGross, ssRoom);
  const ss = round2(ssTaxable * SS_RATE);

  // Medicare (no cap) + additional over threshold (employee side only)
  let medicare = round2(periodGross * MEDICARE_RATE);
  const ytdAfter = ytdGrossBefore + periodGross;
  if (ytdAfter > MEDICARE_ADDL_THRESHOLD) {
    const overBefore = Math.max(0, ytdGrossBefore - MEDICARE_ADDL_THRESHOLD);
    const overAfter = ytdAfter - MEDICARE_ADDL_THRESHOLD;
    const addlBase = overAfter - overBefore;
    medicare = round2(medicare + addlBase * MEDICARE_ADDL_RATE);
  }

  return {
    socialSecurity: ss,
    medicare,
    employerSocialSecurity: ss,
    employerMedicare: round2(periodGross * MEDICARE_RATE),
  };
}

/** SINOT employee + employer per period. */
export function sinot(args: {
  periodGross: number;
  ytdGrossBefore: number;
}): { employee: number; employer: number } {
  const room = Math.max(0, SINOT_WAGE_BASE - args.ytdGrossBefore);
  const taxable = Math.min(args.periodGross, room);
  const total = taxable * SINOT_RATE_TOTAL;
  return {
    employee: round2(total / 2),
    employer: round2(total / 2),
  };
}

export type CalcInput = {
  employeeType: "SALARIED" | "HOURLY" | "CONTRACTOR";
  annualSalary?: number | null;
  hourlyRate?: number | null;
  regularHours?: number;
  overtimeHours?: number;
  bonus?: number;
  commission?: number;
  reimbursements?: number;
  filingStatus: FilingStatus;
  dependents: number;
  extraWithholding?: number;
  frequency: PayFrequency;
  ytdGrossBefore?: number;
};

export type CalcResult = {
  regularPay: number;
  overtimePay: number;
  bonusPay: number;
  commissionPay: number;
  reimbursements: number;
  grossPay: number;
  prIncomeTax: number;
  socialSecurity: number;
  medicare: number;
  sinotEmployee: number;
  extraWithheld: number;
  totalDeductions: number;
  netPay: number;
  employerSocialSecurity: number;
  employerMedicare: number;
  employerSinot: number;
};

/**
 * Compute one pay-period stub. Contractors (1099) skip withholdings.
 */
export function computePayStub(input: CalcInput): CalcResult {
  const ytdGrossBefore = input.ytdGrossBefore ?? 0;
  const reg = input.regularHours ?? 0;
  const ot = input.overtimeHours ?? 0;
  const bonus = input.bonus ?? 0;
  const commission = input.commission ?? 0;
  const reimbursements = input.reimbursements ?? 0;

  let regularPay = 0;
  let overtimePay = 0;

  if (input.employeeType === "SALARIED") {
    const annual = Number(input.annualSalary ?? 0);
    regularPay = round2(annual / PERIODS_PER_YEAR[input.frequency]);
  } else {
    const rate = Number(input.hourlyRate ?? 0);
    regularPay = round2(rate * reg);
    overtimePay = round2(rate * 1.5 * ot);
  }

  const grossPay = round2(
    regularPay + overtimePay + bonus + commission + reimbursements,
  );

  // Contractors: pass-through gross; no withholdings, no employer FICA
  if (input.employeeType === "CONTRACTOR") {
    return {
      regularPay,
      overtimePay,
      bonusPay: bonus,
      commissionPay: commission,
      reimbursements,
      grossPay,
      prIncomeTax: 0,
      socialSecurity: 0,
      medicare: 0,
      sinotEmployee: 0,
      extraWithheld: 0,
      totalDeductions: 0,
      netPay: grossPay,
      employerSocialSecurity: 0,
      employerMedicare: 0,
      employerSinot: 0,
    };
  }

  // Reimbursements are non-taxable; subtract before tax base
  const taxableGross = round2(grossPay - reimbursements);

  const incomeTax = prPeriodIncomeTax({
    periodGross: taxableGross,
    frequency: input.frequency,
    filingStatus: input.filingStatus,
    dependents: input.dependents,
  });

  const ficaR = fica({ periodGross: taxableGross, ytdGrossBefore });
  const sinotR = sinot({ periodGross: taxableGross, ytdGrossBefore });
  const extra = input.extraWithholding ?? 0;

  const totalDeductions = round2(
    incomeTax + ficaR.socialSecurity + ficaR.medicare + sinotR.employee + extra,
  );

  return {
    regularPay,
    overtimePay,
    bonusPay: bonus,
    commissionPay: commission,
    reimbursements,
    grossPay,
    prIncomeTax: incomeTax,
    socialSecurity: ficaR.socialSecurity,
    medicare: ficaR.medicare,
    sinotEmployee: sinotR.employee,
    extraWithheld: extra,
    totalDeductions,
    netPay: round2(grossPay - totalDeductions),
    employerSocialSecurity: ficaR.employerSocialSecurity,
    employerMedicare: ficaR.employerMedicare,
    employerSinot: sinotR.employer,
  };
}
