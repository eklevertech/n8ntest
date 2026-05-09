'use client';

import { useActionState, useState } from 'react';
import type { Employee } from '@prisma/client';

type ActionResult = { error: string } | undefined | void;
type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

interface Props {
  initial?: Employee | null;
  action: Action;
  submitLabel: string;
}

const FILING = [
  ['SINGLE', 'Soltero(a)'],
  ['MARRIED_JOINT', 'Casado conjunto'],
  ['MARRIED_SEPARATE', 'Casado separado'],
  ['HEAD_OF_HOUSEHOLD', 'Cabeza de familia'],
] as const;

const STATUS = [
  ['ACTIVE', 'Activo'],
  ['ON_LEAVE', 'Licencia'],
  ['TERMINATED', 'Cesado'],
] as const;

const TYPES = [
  ['SALARIED', 'Asalariado'],
  ['HOURLY', 'Por hora'],
  ['CONTRACTOR', 'Contratista (1099)'],
] as const;

function dateValue(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function EmployeeForm({ initial, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    action,
    undefined,
  );
  const [type, setType] = useState(initial?.employeeType ?? 'SALARIED');

  return (
    <form action={formAction} className="space-y-8">
      {state?.error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
      ) : null}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Personal</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Número empleado" name="employeeNumber" defaultValue={initial?.employeeNumber} required />
          <Field label="Email" name="email" type="email" defaultValue={initial?.email} required />
          <Field label="Nombre" name="firstName" defaultValue={initial?.firstName} required />
          <Field label="Apellido" name="lastName" defaultValue={initial?.lastName} required />
          <Field label="SSN" name="ssn" defaultValue={initial?.ssn} required placeholder="XXX-XX-XXXX" />
          <Field label="Fecha nacimiento" name="dateOfBirth" type="date" defaultValue={dateValue(initial?.dateOfBirth)} required />
          <Field label="Teléfono" name="phone" defaultValue={initial?.phone ?? ''} />
          <Field label="Dirección" name="address" defaultValue={initial?.address ?? ''} />
          <Field label="Ciudad" name="city" defaultValue={initial?.city ?? ''} />
          <Field label="Estado" name="state" defaultValue={initial?.state ?? 'PR'} />
          <Field label="ZIP" name="zipCode" defaultValue={initial?.zipCode ?? ''} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Empleo</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Puesto" name="jobTitle" defaultValue={initial?.jobTitle} required />
          <Field label="Departamento" name="department" defaultValue={initial?.department ?? ''} />
          <Field label="Fecha contratación" name="hireDate" type="date" defaultValue={dateValue(initial?.hireDate)} required />
          <Field label="Fecha cese" name="terminationDate" type="date" defaultValue={dateValue(initial?.terminationDate)} />
          <Select label="Status" name="status" defaultValue={initial?.status ?? 'ACTIVE'} options={STATUS} />
          <Select
            label="Tipo"
            name="employeeType"
            defaultValue={type}
            options={TYPES}
            onChange={(v) => setType(v as typeof type)}
          />
          {type === 'SALARIED' ? (
            <Field
              label="Salario anual"
              name="annualSalary"
              type="number"
              step="0.01"
              defaultValue={initial?.annualSalary?.toString() ?? ''}
              required
            />
          ) : null}
          {type === 'HOURLY' || type === 'CONTRACTOR' ? (
            <Field
              label={type === 'CONTRACTOR' ? 'Tarifa por hora (1099)' : 'Tarifa por hora'}
              name="hourlyRate"
              type="number"
              step="0.01"
              defaultValue={initial?.hourlyRate?.toString() ?? ''}
              required
            />
          ) : null}
          <Field
            label="Balance PTO (días)"
            name="ptoBalance"
            type="number"
            step="0.01"
            defaultValue={initial?.ptoBalance?.toString() ?? '0'}
          />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Fiscal</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Estado civil (filing)"
            name="filingStatus"
            defaultValue={initial?.filingStatus ?? 'SINGLE'}
            options={FILING}
          />
          <Field
            label="Dependientes"
            name="exemptions"
            type="number"
            defaultValue={String(initial?.exemptions ?? 0)}
          />
          <Field
            label="Retención adicional ($)"
            name="extraWithholding"
            type="number"
            step="0.01"
            defaultValue={initial?.extraWithholding?.toString() ?? '0'}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" {...rest} />
    </label>
  );
}

function Select({
  label,
  options,
  onChange,
  ...rest
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  onChange?: (v: string) => void;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select
        className="input"
        {...rest}
        onChange={(e) => {
          rest.onChange?.(e);
          onChange?.(e.target.value);
        }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
