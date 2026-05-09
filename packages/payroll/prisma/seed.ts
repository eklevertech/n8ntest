import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding…");

  const adminHash = await bcrypt.hash("admin123", 10);
  const hrHash = await bcrypt.hash("hr123", 10);
  const empHash = await bcrypt.hash("emp123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@acme.pr" },
    update: {},
    create: { email: "admin@acme.pr", name: "Admin", passwordHash: adminHash, role: "ADMIN" },
  });

  const hr = await prisma.user.upsert({
    where: { email: "hr@acme.pr" },
    update: {},
    create: { email: "hr@acme.pr", name: "RRHH", passwordHash: hrHash, role: "HR" },
  });

  const empUser = await prisma.user.upsert({
    where: { email: "empleado@acme.pr" },
    update: {},
    create: { email: "empleado@acme.pr", name: "María Rivera", passwordHash: empHash, role: "EMPLOYEE" },
  });

  // Sample employees
  const employees = [
    {
      employeeNumber: "E-001",
      firstName: "María", lastName: "Rivera",
      email: "empleado@acme.pr",
      hireDate: new Date("2022-03-01"),
      jobTitle: "Software Engineer", department: "Engineering",
      employeeType: "SALARIED" as const,
      annualSalary: 65000,
      filingStatus: "SINGLE" as const,
      exemptions: 0,
      ptoBalance: 12,
      address: "Calle Loíza 1", city: "San Juan", zipCode: "00911",
      ssn: "123-45-6789",
      userId: empUser.id,
    },
    {
      employeeNumber: "E-002",
      firstName: "Juan", lastName: "Pérez",
      email: "juan.perez@acme.pr",
      hireDate: new Date("2023-01-15"),
      jobTitle: "Cajero", department: "Retail",
      employeeType: "HOURLY" as const,
      hourlyRate: 12.5,
      filingStatus: "MARRIED_JOINT" as const,
      exemptions: 2,
      ptoBalance: 8,
      address: "Avenida Ponce 22", city: "Ponce", zipCode: "00731",
      ssn: "234-56-7890",
    },
    {
      employeeNumber: "E-003",
      firstName: "Carmen", lastName: "Vázquez",
      email: "carmen@acme.pr",
      hireDate: new Date("2024-06-10"),
      jobTitle: "Diseñadora freelance", department: "Marketing",
      employeeType: "CONTRACTOR" as const,
      hourlyRate: 45,
      filingStatus: "SINGLE" as const,
      exemptions: 0,
      ptoBalance: 0,
      address: "Calle Sol 14", city: "Mayagüez", zipCode: "00680",
      ssn: "345-67-8901",
    },
  ];

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { employeeNumber: e.employeeNumber },
      update: {},
      create: e,
    });
  }

  // Bi-weekly pay periods for current quarter
  const now = new Date();
  const baseStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // adjust to nearest Monday
  baseStart.setDate(baseStart.getDate() - ((baseStart.getDay() + 6) % 7));

  for (let i = 0; i < 2; i++) {
    const start = new Date(baseStart);
    start.setDate(start.getDate() + i * 14);
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    const pay = new Date(end);
    pay.setDate(pay.getDate() + 5);
    await prisma.payPeriod.upsert({
      where: { startDate_endDate: { startDate: start, endDate: end } },
      update: {},
      create: { startDate: start, endDate: end, payDate: pay },
    });
  }

  // Seed time entries for hourly employee
  const juan = await prisma.employee.findUnique({ where: { employeeNumber: "E-002" } });
  if (juan) {
    for (let i = 0; i < 10; i++) {
      const d = new Date(baseStart);
      d.setDate(d.getDate() + i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const clockIn = new Date(d); clockIn.setHours(9, 0, 0, 0);
      const clockOut = new Date(d); clockOut.setHours(17, 30, 0, 0);
      await prisma.timeEntry.create({
        data: {
          employeeId: juan.id,
          date: d,
          clockIn,
          clockOut,
          hours: 8.5,
          status: "APPROVED",
        },
      });
    }
  }

  console.log(`Done. Users: admin=${admin.email}, hr=${hr.email}, employee=${empUser.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
