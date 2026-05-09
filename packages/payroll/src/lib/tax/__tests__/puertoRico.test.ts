/**
 * Sanity tests for the PR tax engine.
 * Run with: npx tsx --test src/lib/tax/__tests__/puertoRico.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prAnnualIncomeTax,
  prPeriodIncomeTax,
  fica,
  sinot,
  computePayStub,
} from "../puertoRico";

test("PR income tax — exempt below 9k", () => {
  assert.equal(prAnnualIncomeTax(8_000), 0);
  assert.equal(prAnnualIncomeTax(9_000), 0);
});

test("PR income tax — 7% bracket", () => {
  // ($25,000 - $9,000) * 7% = $1,120
  assert.equal(prAnnualIncomeTax(25_000), 1_120);
});

test("PR income tax — 14% bracket", () => {
  // base 1,120 + ($35,000 - $25,000) * 14% = 1,120 + 1,400 = 2,520
  assert.equal(prAnnualIncomeTax(35_000), 2_520);
});

test("PR income tax — top 33% bracket", () => {
  // base 8,430 + ($100,000 - $61,500) * 33% = 8,430 + 12,705 = 21,135
  assert.equal(prAnnualIncomeTax(100_000), 21_135);
});

test("Period withholding — bi-weekly $2,500 single, no deps", () => {
  // annual 65,000 - 3,500 personal exemption = 61,500 taxable
  // tax at 61,500 = 3,430 + (61,500 - 41,500)*25% = 8,430 -> /26 = 324.23
  const w = prPeriodIncomeTax({
    periodGross: 2_500,
    frequency: "BIWEEKLY",
    filingStatus: "SINGLE",
    dependents: 0,
  });
  assert.equal(w, 324.23);
});

test("FICA basic", () => {
  const r = fica({ periodGross: 2_500, ytdGrossBefore: 0 });
  assert.equal(r.socialSecurity, 155); // 2500 * 6.2%
  assert.equal(r.medicare, 36.25);     // 2500 * 1.45%
});

test("FICA SS cap respected", () => {
  const r = fica({ periodGross: 5_000, ytdGrossBefore: 168_000 });
  // SS room = 600
  assert.equal(r.socialSecurity, Math.round(600 * 0.062 * 100) / 100);
});

test("SINOT capped at 9k YTD", () => {
  const r = sinot({ periodGross: 2_000, ytdGrossBefore: 8_000 });
  // taxable = 1,000 -> total 0.30% = 3 -> split 1.50 / 1.50
  assert.equal(r.employee, 1.5);
  assert.equal(r.employer, 1.5);
});

test("Contractor 1099 — gross == net, no withholdings", () => {
  const r = computePayStub({
    employeeType: "CONTRACTOR",
    hourlyRate: 50,
    regularHours: 40,
    filingStatus: "SINGLE",
    dependents: 0,
    frequency: "BIWEEKLY",
  });
  assert.equal(r.grossPay, 2_000);
  assert.equal(r.netPay, 2_000);
  assert.equal(r.prIncomeTax, 0);
  assert.equal(r.socialSecurity, 0);
});

test("Hourly with overtime", () => {
  const r = computePayStub({
    employeeType: "HOURLY",
    hourlyRate: 20,
    regularHours: 40,
    overtimeHours: 5,
    filingStatus: "SINGLE",
    dependents: 0,
    frequency: "BIWEEKLY",
  });
  // 40*20 + 5*30 = 800 + 150 = 950
  assert.equal(r.grossPay, 950);
});

test("Salaried bi-weekly", () => {
  const r = computePayStub({
    employeeType: "SALARIED",
    annualSalary: 52_000,
    filingStatus: "SINGLE",
    dependents: 0,
    frequency: "BIWEEKLY",
  });
  assert.equal(r.regularPay, 2_000); // 52000/26
  assert.equal(r.grossPay, 2_000);
});
