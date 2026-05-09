# Payroll PR

Aplicación web para manejo de empleados y nómina, con reglas fiscales simplificadas de **Puerto Rico** (Hacienda + FICA + SINOT).

Stack: **Next.js 15 (App Router) · TypeScript · Prisma · Postgres · NextAuth v5 · Tailwind**.

> ⚠️ El motor de impuestos es un modelo simplificado para fines demostrativos.
> Antes de usar en producción, valida las tablas y reglas con un CPA y con las
> publicaciones vigentes de Hacienda PR e IRS.

## Funcionalidades

- **Empleados**: CRUD completo (Salaried, Hourly, Contractor 1099) con datos personales y fiscales.
- **Asistencia**: Time clock (clock-in/clock-out), entrada manual por RRHH, aprobación de horas.
- **PTO**: Solicitudes (vacaciones, enfermedad, personal, sin paga) con aprobación y descuento de balance.
- **Nómina** (bi-weekly): Procesa el período aplicando overtime > 40h/sem, bonos, comisiones y reembolsos.
- **Impuestos PR**: Hacienda (brackets 0/7/14/25/33%), FICA (SS 6.2% + Medicare 1.45% + cap), SINOT (0.30% sobre $9k).
- **Reportes**:
  - Pay stubs en PDF por empleado.
  - Resumen de nómina en CSV y Excel.
  - Reporte de asistencia en CSV/Excel.
  - W-2PR / 1099 anual (mock) en PDF.
- **Roles**: `ADMIN`, `HR`, `EMPLOYEE` (portal de autoservicio).

## Requisitos

- Node.js 20+
- pnpm 9+
- Postgres 14+ (local con Docker, Neon, o Supabase)

## Setup local

```bash
cd packages/payroll
cp .env.example .env

# Levantar Postgres local
docker compose up -d

# Instalar deps (desde la raíz del monorepo o aquí)
pnpm install

# Crear schema y datos demo
pnpm db:push
pnpm db:seed

# Arrancar
pnpm dev
# http://localhost:3001
```

### Cuentas demo

| Rol      | Email               | Password |
|----------|---------------------|----------|
| Admin    | admin@acme.pr       | admin123 |
| RRHH     | hr@acme.pr          | hr123    |
| Empleado | empleado@acme.pr    | emp123   |

## Deploy a Vercel + Neon/Supabase

1. Crea una base Postgres en [Neon](https://neon.tech) o [Supabase](https://supabase.com) y copia el connection string (con `?sslmode=require`).
2. Importa este monorepo en Vercel; selecciona `packages/payroll` como root.
3. Variables de entorno requeridas:
   - `DATABASE_URL`
   - `AUTH_SECRET` (genera con `openssl rand -base64 32`)
   - `AUTH_TRUST_HOST=true`
   - `NEXTAUTH_URL=https://tu-dominio.vercel.app`
   - `COMPANY_NAME`, `COMPANY_EIN`, `COMPANY_ADDRESS`
4. Antes del primer deploy, ejecuta `pnpm db:push` apuntando a la base remota para crear el esquema, y opcionalmente `pnpm db:seed`.

## Estructura

```
src/
  app/
    (app)/                # Layout autenticado
      employees/
      attendance/
      pto/
      payroll/
      reports/
      me/                 # Portal del empleado
    api/
      auth/[...nextauth]/
      paystubs/[id]/pdf/  # Pay stub PDF
      payroll/[id]/csv/   # Export CSV
      payroll/[id]/excel/ # Export Excel
      reports/...         # Asistencia + W-2PR/1099
    login/
  lib/
    db.ts                 # Prisma client singleton
    rbac.ts               # Helpers de roles
    money.ts              # Formato USD / Decimal
    validation.ts         # Esquemas Zod
    tax/puertoRico.ts     # Motor fiscal
    pdf/                  # PDFs (React-PDF)
  auth.ts                 # NextAuth config
  middleware.ts
prisma/
  schema.prisma
  seed.ts
```

## Notas sobre los impuestos PR (modelo simplificado)

- **Hacienda PR (Income Tax)**: Brackets 2024 — 0% ≤ $9k, 7%, 14%, 25%, 33%. Annualiza el sueldo del período, aplica exención personal según filing status + dependientes, y divide el impuesto anual entre los períodos del año.
- **FICA**: SS 6.2% hasta wage base $168,600/yr; Medicare 1.45% sin tope; +0.9% adicional sobre $200k (lado empleado).
- **SINOT**: 0.30% total sobre los primeros $9,000 del año, dividido 50/50 empleador/empleado.
- **Contratistas (1099)**: No se retienen impuestos ni FICA; el bruto = neto.
- **Overtime**: 1.5× sobre 40h por semana ISO.

Para reglas avanzadas (CFSE workers comp, choferes, depósito 941PR, formularios oficiales) consulta a Hacienda y al Departamento del Trabajo de PR.
