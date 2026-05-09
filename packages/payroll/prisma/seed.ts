import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function utc(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}

async function main() {
  console.log('Limpiando datos previos…');
  await prisma.payStub.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.bonus.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.ptoRequest.deleteMany();
  await prisma.payPeriod.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creando usuarios y empleados…');

  const adminHash = await bcrypt.hash('admin123', 10);
  const hrHash = await bcrypt.hash('hr123', 10);
  const empHash = await bcrypt.hash('emp123', 10);

  await prisma.user.create({
    data: {
      email: 'admin@acme.pr',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      email: 'hr@acme.pr',
      passwordHash: hrHash,
      role: 'HR',
    },
  });

  const empUser = await prisma.user.create({
    data: {
      email: 'empleado@acme.pr',
      passwordHash: empHash,
      role: 'EMPLOYEE',
    },
  });

  // 1) Salaried con cuenta de empleado
  const e1 = await prisma.employee.create({
    data: {
      employeeNumber: 'E001',
      firstName: 'María',
      lastName: 'Rivera',
      email: 'empleado@acme.pr',
      phone: '787-555-0001',
      address: '10 Calle Sol',
      city: 'San Juan',
      state: 'PR',
      zipCode: '00901',
      ssn: '123-45-6789',
      dateOfBirth: utc(1990, 5, 12),
      hireDate: utc(2022, 1, 10),
      status: 'ACTIVE',
      jobTitle: 'Software Engineer',
      department: 'Ingeniería',
      employeeType: 'SALARIED',
      annualSalary: 72_000,
      filingStatus: 'SINGLE',
      exemptions: 0,
      extraWithholding: 0,
      ptoBalance: 12,
      userId: empUser.id,
    },
  });

  // 2) Hourly
  const e2 = await prisma.employee.create({
    data: {
      employeeNumber: 'E002',
      firstName: 'José',
      lastName: 'Pérez',
      email: 'jose.perez@acme.pr',
      phone: '787-555-0002',
      address: '22 Calle Luna',
      city: 'Bayamón',
      state: 'PR',
      zipCode: '00956',
      ssn: '987-65-4321',
      dateOfBirth: utc(1988, 7, 22),
      hireDate: utc(2023, 3, 1),
      status: 'ACTIVE',
      jobTitle: 'Operador',
      department: 'Operaciones',
      employeeType: 'HOURLY',
      hourlyRate: 18.5,
      filingStatus: 'MARRIED_JOINT',
      exemptions: 1,
      extraWithholding: 0,
      ptoBalance: 8,
    },
  });

  // 3) Contractor
  await prisma.employee.create({
    data: {
      employeeNumber: 'E003',
      firstName: 'Luis',
      lastName: 'Torres',
      email: 'luis.torres@acme.pr',
      phone: '787-555-0003',
      address: '33 Ave Ashford',
      city: 'Carolina',
      state: 'PR',
      zipCode: '00979',
      ssn: '555-66-7777',
      dateOfBirth: utc(1985, 11, 3),
      hireDate: utc(2024, 6, 15),
      status: 'ACTIVE',
      jobTitle: 'Diseñador',
      department: 'Marketing',
      employeeType: 'CONTRACTOR',
      hourlyRate: 50,
      filingStatus: 'SINGLE',
      exemptions: 0,
      extraWithholding: 0,
      ptoBalance: 0,
    },
  });

  console.log('Creando períodos del mes en curso…');
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  const period1Start = utc(year, month + 1, 1);
  const period1End = utc(year, month + 1, 14);
  const period1Pay = utc(year, month + 1, 19);

  const period2Start = utc(year, month + 1, 15);
  const period2End = utc(year, month + 1, 28);
  const period2Pay = utc(year, month + 1, Math.min(30, 28 + 5));

  await prisma.payPeriod.create({
    data: {
      startDate: period1Start,
      endDate: period1End,
      payDate: period1Pay,
      status: 'OPEN',
    },
  });
  await prisma.payPeriod.create({
    data: {
      startDate: period2Start,
      endDate: period2End,
      payDate: period2Pay,
      status: 'OPEN',
    },
  });

  console.log('Creando entradas de tiempo aprobadas para el hourly…');
  // 10 entries dentro del primer período
  for (let i = 0; i < 10; i++) {
    const day = new Date(period1Start);
    day.setUTCDate(day.getUTCDate() + i);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    await prisma.timeEntry.create({
      data: {
        employeeId: e2.id,
        date: day,
        hours: 8,
        status: 'APPROVED',
        notes: 'Turno regular',
      },
    });
  }

  // PTO de ejemplo para María
  await prisma.ptoRequest.create({
    data: {
      employeeId: e1.id,
      startDate: utc(year, month + 2, 5),
      endDate: utc(year, month + 2, 9),
      days: 5,
      type: 'VACATION',
      status: 'PENDING',
      reason: 'Viaje familiar',
    },
  });

  console.log('Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
