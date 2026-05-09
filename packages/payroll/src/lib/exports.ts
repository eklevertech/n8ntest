import { toNumber } from './format';

export const PAYROLL_HEADERS = [
  'Empleado',
  'Núm',
  'Tipo',
  'Horas regulares',
  'Horas OT',
  'Pago regular',
  'Pago OT',
  'Bono',
  'Comisión',
  'Reembolso',
  'Gross',
  'PR Income Tax',
  'Social Security',
  'Medicare',
  'SINOT',
  'Retención adicional',
  'Total deducciones',
  'Net',
];

export function payrollRows(
  stubs: Array<{
    employee: { firstName: string; lastName: string; employeeNumber: string; employeeType: string };
    regularHours: unknown;
    overtimeHours: unknown;
    regularPay: unknown;
    overtimePay: unknown;
    bonusPay: unknown;
    commissionPay: unknown;
    reimbursements: unknown;
    grossPay: unknown;
    prIncomeTax: unknown;
    socialSecurity: unknown;
    medicare: unknown;
    sinotEmployee: unknown;
    extraWithheld: unknown;
    totalDeductions: unknown;
    netPay: unknown;
  }>,
): (string | number)[][] {
  return stubs.map((s) => [
    `${s.employee.lastName}, ${s.employee.firstName}`,
    s.employee.employeeNumber,
    s.employee.employeeType,
    toNumber(s.regularHours),
    toNumber(s.overtimeHours),
    toNumber(s.regularPay),
    toNumber(s.overtimePay),
    toNumber(s.bonusPay),
    toNumber(s.commissionPay),
    toNumber(s.reimbursements),
    toNumber(s.grossPay),
    toNumber(s.prIncomeTax),
    toNumber(s.socialSecurity),
    toNumber(s.medicare),
    toNumber(s.sinotEmployee),
    toNumber(s.extraWithheld),
    toNumber(s.totalDeductions),
    toNumber(s.netPay),
  ]);
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (cell: string | number) => {
    const s = String(cell);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) lines.push(row.map(escape).join(','));
  return lines.join('\n');
}
