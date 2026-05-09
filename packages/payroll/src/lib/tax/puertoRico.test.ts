import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePayStub,
  prAnnualIncomeTax,
  prWithholdingForPeriod,
  socialSecurityForPeriod,
  medicareForPeriod,
  sinotEmployeeForPeriod,
  splitRegularOvertime,
  isoWeekKey,
} from './puertoRico';

test('PR brackets: under $9,000 paga 0', () => {
  assert.equal(prAnnualIncomeTax(8000), 0);
  assert.equal(prAnnualIncomeTax(9000), 0);
});

test('PR brackets: 7% sobre el exceso de $9,000', () => {
  // 20,000 - 9,000 = 11,000 * 0.07 = 770
  assert.equal(prAnnualIncomeTax(20000), 770);
});

test('PR brackets: $30,000 = 1,120 + (5,000 * 0.14) = 1,820', () => {
  assert.equal(prAnnualIncomeTax(30000), 1820);
});

test('PR brackets: $50,000 = 3,430 + (8,500 * 0.25) = 5,555', () => {
  assert.equal(prAnnualIncomeTax(50000), 5555);
});

test('PR brackets: $100,000 = 8,430 + (38,500 * 0.33) = 21,135', () => {
  assert.equal(prAnnualIncomeTax(100000), 21135);
});

test('Retención bi-weekly anualiza correctamente', () => {
  // gross 2000 * 26 = 52,000 - exemption single 3,500 = 48,500 taxable
  // tax = 3,430 + (7,000 * 0.25) = 5,180 / 26 ≈ 199.23
  const wh = prWithholdingForPeriod(2000, 'SINGLE', 0, 'BIWEEKLY');
  assert.ok(Math.abs(wh - 199.23) < 0.05, `expected ~199.23, got ${wh}`);
});

test('SS cap por wage base: ya por encima del cap retorna 0', () => {
  assert.equal(socialSecurityForPeriod(5000, 168_600), 0);
});

test('SS cap parcial: solo aplica al remanente', () => {
  // remaining = 100, 100 * 0.062 = 6.20
  const ss = socialSecurityForPeriod(5000, 168_500);
  assert.equal(ss, 6.2);
});

test('Medicare base sin additional bajo $200k', () => {
  // 5000 * 0.0145 = 72.50
  assert.equal(medicareForPeriod(5000, 50000), 72.5);
});

test('Medicare additional sobre $200k YTD (lado empleado)', () => {
  // ytd 199,000 + 5,000 = 204,000 -> 4,000 sujeto a 0.9%
  // base = 5000 * 0.0145 = 72.50; additional = 4000 * 0.009 = 36.00 => 108.50
  assert.equal(medicareForPeriod(5000, 199_000), 108.5);
});

test('SINOT cap a $9,000 anual', () => {
  // Bi-weekly de hourly con $1,000 gross y YTD 8,500: solo 500 sujeto.
  // 500 * 0.0015 = 0.75
  assert.equal(sinotEmployeeForPeriod(1000, 8500), 0.75);
  assert.equal(sinotEmployeeForPeriod(1000, 9000), 0);
});

test('Contratistas (1099): gross == net, sin retenciones', () => {
  const stub = computePayStub({
    kind: 'CONTRACTOR',
    frequency: 'BIWEEKLY',
    filingStatus: 'SINGLE',
    exemptions: 0,
    extraWithholding: 0,
    regularPay: 3000,
    overtimePay: 0,
    bonusPay: 0,
    commissionPay: 0,
    reimbursements: 100,
    ytdGrossPrior: 0,
    ytdSocialSecurityWagesPrior: 0,
    ytdMedicareWagesPrior: 0,
    ytdSinotWagesPrior: 0,
  });
  assert.equal(stub.prIncomeTax, 0);
  assert.equal(stub.socialSecurity, 0);
  assert.equal(stub.medicare, 0);
  assert.equal(stub.sinotEmployee, 0);
  assert.equal(stub.netPay, 3100);
  assert.equal(stub.grossPay, 3100);
});

test('Reembolsos suben gross pero no son taxables', () => {
  const stub = computePayStub({
    kind: 'SALARIED',
    frequency: 'BIWEEKLY',
    filingStatus: 'SINGLE',
    exemptions: 0,
    extraWithholding: 0,
    regularPay: 2000,
    overtimePay: 0,
    bonusPay: 0,
    commissionPay: 0,
    reimbursements: 200,
    ytdGrossPrior: 0,
    ytdSocialSecurityWagesPrior: 0,
    ytdMedicareWagesPrior: 0,
    ytdSinotWagesPrior: 0,
  });
  assert.equal(stub.grossPay, 2200);
  assert.equal(stub.taxableGross, 2000);
  // SS = 124.00, Medicare = 29.00
  assert.equal(stub.socialSecurity, 124);
  assert.equal(stub.medicare, 29);
});

test('Overtime: agrupa por semana ISO y aplica umbral 40h', () => {
  // 2024: lunes-domingo en una semana
  const entries = [
    { date: new Date('2024-01-01T12:00:00Z'), hours: 10 }, // lun w1
    { date: new Date('2024-01-02T12:00:00Z'), hours: 10 }, // mar w1
    { date: new Date('2024-01-03T12:00:00Z'), hours: 10 }, // mié w1
    { date: new Date('2024-01-04T12:00:00Z'), hours: 10 }, // jue w1
    { date: new Date('2024-01-05T12:00:00Z'), hours: 10 }, // vie w1 -> 50 total
    { date: new Date('2024-01-08T12:00:00Z'), hours: 8 }, // lun w2
    { date: new Date('2024-01-09T12:00:00Z'), hours: 8 }, // mar w2
  ];
  const split = splitRegularOvertime(entries);
  assert.equal(split.regularHours, 56); // 40 + 16
  assert.equal(split.overtimeHours, 10);
});

test('isoWeekKey: misma semana para días distintos', () => {
  const a = isoWeekKey(new Date('2024-01-01T12:00:00Z'));
  const b = isoWeekKey(new Date('2024-01-05T12:00:00Z'));
  assert.equal(a, b);
});

test('Salaried bi-weekly completo: cálculo end-to-end', () => {
  const stub = computePayStub({
    kind: 'SALARIED',
    frequency: 'BIWEEKLY',
    filingStatus: 'SINGLE',
    exemptions: 0,
    extraWithholding: 0,
    regularPay: 2000,
    overtimePay: 0,
    bonusPay: 0,
    commissionPay: 0,
    reimbursements: 0,
    ytdGrossPrior: 0,
    ytdSocialSecurityWagesPrior: 0,
    ytdMedicareWagesPrior: 0,
    ytdSinotWagesPrior: 0,
  });
  assert.equal(stub.grossPay, 2000);
  assert.ok(stub.prIncomeTax > 0);
  assert.equal(stub.socialSecurity, 124);
  assert.equal(stub.medicare, 29);
  assert.equal(stub.sinotEmployee, 3); // 2000 * 0.0015
  assert.ok(stub.netPay > 0 && stub.netPay < stub.grossPay);
});
