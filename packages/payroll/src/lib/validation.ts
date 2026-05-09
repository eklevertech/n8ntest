import { z } from "zod";

export const employeeSchema = z.object({
  employeeNumber: z.string().min(1).max(20),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  ssn: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  hireDate: z.string().min(1),
  jobTitle: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  employeeType: z.enum(["SALARIED", "HOURLY", "CONTRACTOR"]),
  annualSalary: z.coerce.number().nonnegative().optional().nullable(),
  hourlyRate: z.coerce.number().nonnegative().optional().nullable(),
  filingStatus: z.enum(["SINGLE", "MARRIED_JOINT", "MARRIED_SEPARATE", "HEAD_OF_HOUSEHOLD"]),
  exemptions: z.coerce.number().int().nonnegative().default(0),
  extraWithholding: z.coerce.number().nonnegative().default(0),
  ptoBalance: z.coerce.number().nonnegative().default(0),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).default("ACTIVE"),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const ptoRequestSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(["VACATION", "SICK", "PERSONAL", "UNPAID"]),
  reason: z.string().optional().nullable(),
});

export const bonusSchema = z.object({
  employeeId: z.string().min(1),
  payPeriodId: z.string().min(1),
  type: z.enum(["BONUS", "COMMISSION", "REIMBURSEMENT"]),
  amount: z.coerce.number().positive(),
  description: z.string().optional().nullable(),
});

export const payPeriodSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  payDate: z.string().min(1),
});
