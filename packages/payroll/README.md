# Nómina PR — Aplicación de empleados y nómina (Puerto Rico)

Aplicación web completa de **manejo de empleados y nómina** para empresas que
operan en Puerto Rico. Implementa retención de Hacienda PR, FICA (Social
Security + Medicare), SINOT, recibos en PDF, exports CSV/Excel, time clock,
PTO y reportes anuales W-2PR / 1099 (mock).

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Prisma ORM** + **Postgres**
- **NextAuth v5** (Auth.js) — Credentials + JWT sessions
- **Tailwind CSS**
- **Zod** para validación
- **@react-pdf/renderer** (PDFs), **exceljs** (Excel), CSV manual
- **bcryptjs** para hashing de contraseñas

Puerto local: **3001**.

## Instalación local

```bash
# 1) Levanta Postgres
docker compose up -d postgres

# 2) Variables de entorno
cp .env.example .env
# (edita si quieres)

# 3) Instala dependencias (desde la raíz del monorepo o desde aquí)
pnpm install

# 4) Crea el schema y datos demo
pnpm db:push
pnpm db:seed

# 5) Levanta el server
pnpm dev
```

Abre [http://localhost:3001](http://localhost:3001).

### Cuentas demo

| Rol      | Email                  | Password   |
| -------- | ---------------------- | ---------- |
| ADMIN    | `admin@acme.pr`        | `admin123` |
| HR       | `hr@acme.pr`           | `hr123`    |
| EMPLOYEE | `empleado@acme.pr`     | `emp123`   |

La cuenta de empleado está vinculada a María Rivera (E001, asalariada).

## Scripts

| Comando             | Descripción                                       |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo en puerto 3001             |
| `pnpm build`        | `prisma generate` + build de Next.js              |
| `pnpm start`        | Servidor en producción                             |
| `pnpm typecheck`    | `tsc --noEmit`                                    |
| `pnpm db:push`      | Sincroniza schema con la BD (sin migración)       |
| `pnpm db:migrate`   | Crea/aplica migraciones Prisma                    |
| `pnpm db:seed`      | Carga datos demo                                  |
| `pnpm db:studio`    | Abre Prisma Studio                                |
| `pnpm test`         | Tests del motor fiscal (`node:test`)              |

## Variables de entorno

Definidas en `.env.example`:

- `DATABASE_URL` — URL de Postgres (ej: Neon, Supabase, Postgres local).
- `AUTH_SECRET` — secreto para firmar JWTs de NextAuth.
- `AUTH_TRUST_HOST=true` — necesario en Vercel.
- `NEXTAUTH_URL` — URL pública de la app (en producción).
- `COMPANY_NAME`, `COMPANY_EIN`, `COMPANY_ADDRESS` — datos del patrono que
  aparecen en pay stubs y W-2PR.

## Despliegue

### Vercel + Neon

1. Crea una BD Postgres en [Neon](https://neon.tech). Copia la URL pooled
   (con `?sslmode=require`).
2. En Vercel, importa este package (`packages/payroll`) como proyecto.
   - **Root Directory**: `packages/payroll`
   - **Build Command**: `pnpm build` (o `prisma generate && next build`)
3. Configura las variables: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`,
   `NEXTAUTH_URL`, y los `COMPANY_*`.
4. Antes del primer deploy aplica el schema:
   ```bash
   DATABASE_URL=... pnpm db:push
   DATABASE_URL=... pnpm db:seed   # opcional
   ```

### Vercel + Supabase

Igual que arriba pero usa la URL del **connection pooler** de Supabase
(modo `transaction`) y deshabilita prepared statements si fuera necesario.

## Modelo fiscal (resumen)

> ⚠️ **Disclaimer**: este es un modelo SIMPLIFICADO con fines demostrativos.
> No sustituye la Circular de Hacienda PR, los cálculos oficiales de retención
> ni los formularios oficiales (W-2PR, 480.6, etc.). Verifica siempre con
> tu contador o CPA.

Implementación en `src/lib/tax/puertoRico.ts`. Constantes para 2024:

- **Brackets de Hacienda PR (anual)**:
  - 0 – 9,000: 0%
  - 9,001 – 25,000: 7% sobre exceso de 9,000
  - 25,001 – 41,500: $1,120 + 14% sobre exceso de 25,000
  - 41,501 – 61,500: $3,430 + 25% sobre exceso de 41,500
  - > 61,500: $8,430 + 33% sobre exceso de 61,500
- **Exenciones**: $3,500 single / $7,000 married joint, +$2,500 por dependiente.
- **Método de retención**: anualizar gross × periodos/año, aplicar exención y
  brackets, dividir entre periodos.
- **FICA**: SS 6.2% con cap $168,600/año; Medicare 1.45% sin tope; +0.9% lado
  empleado sobre $200,000 YTD (Additional Medicare).
- **SINOT**: 0.30% total sobre primeros $9,000/año, 50/50 empleado/empleador.
- **Reembolsos**: suben gross pero no son taxables.
- **Contratistas (1099)**: sin retención ni FICA, gross == net.
- **Overtime**: 1.5× sobre 40h por semana ISO.

Lo que NO está incluido (fuera de scope): CFSE workers comp, Chofer, depósitos
941PR, formularios oficiales 499R-2/W-2PR ni 480.6. Estos quedan como tarea
manual o integración futura.

## Arquitectura

```
src/
  app/
    (app)/                 # rutas autenticadas con layout común
      page.tsx             # dashboard (cambia por rol)
      employees/           # CRUD empleados (HR/Admin)
      attendance/          # time clock + aprobaciones
      pto/                 # PTO requests
      payroll/             # períodos + procesamiento
      reports/             # reportes (HR/Admin)
      me/                  # portal del empleado
    api/
      auth/[...nextauth]/  # handler NextAuth
      paystubs/[id]/pdf    # PDF del recibo
      payroll/[id]/csv     # export CSV
      payroll/[id]/excel   # export Excel
      reports/attendance   # asistencia CSV/Excel
      reports/annual/[id]  # W-2PR/1099 anual mock
    login/
  lib/
    tax/puertoRico.ts      # motor fiscal (constantes + computePayStub)
    pdf/                   # plantillas @react-pdf
    auth.ts session.ts db.ts format.ts company.ts exports.ts
  server/                  # server actions
    employees.ts attendance.ts pto.ts payroll.ts
  components/
prisma/
  schema.prisma seed.ts
middleware.ts              # protege todas las rutas
```

Mutaciones se hacen exclusivamente con **Server Actions** validadas con Zod;
los componentes son Server Components por defecto y se marca `"use client"`
solo cuando hay estado o transición (formularios con feedback, time clock).
