"use client";

import { useState, useTransition } from "react";

type Initial = Partial<{
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  ssn: string | null;
  dateOfBirth: string | null;
  hireDate: string;
  jobTitle: string | null;
  department: string | null;
  employeeType: "SALARIED" | "HOURLY" | "CONTRACTOR";
  annualSalary: number | null;
  hourlyRate: number | null;
  filingStatus: "SINGLE" | "MARRIED_JOINT" | "MARRIED_SEPARATE" | "HEAD_OF_HOUSEHOLD";
  exemptions: number;
  extraWithholding: number;
  ptoBalance: number;
  status: "ACTIVE" | "ON_LEAVE" | "TERMINATED";
}>;

export default function EmployeeForm({
  initial,
  action,
}: {
  initial?: Initial;
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<Initial["employeeType"]>(initial?.employeeType ?? "SALARIED");

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const r = await action(fd);
          if (!r.ok) setError(r.error ?? "Error al guardar");
        });
      }}
    >
      {error && <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="card space-y-4">
        <h2 className="font-semibold">Datos personales</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="# Empleado" name="employeeNumber" defaultValue={initial?.employeeNumber} required />
          <Field label="Nombre" name="firstName" defaultValue={initial?.firstName} required />
          <Field label="Apellido" name="lastName" defaultValue={initial?.lastName} required />
          <Field label="Email" name="email" type="email" defaultValue={initial?.email} required />
          <Field label="Teléfono" name="phone" defaultValue={initial?.phone ?? ""} />
          <Field label="SSN" name="ssn" defaultValue={initial?.ssn ?? ""} placeholder="XXX-XX-XXXX" />
          <Field label="Fecha nacimiento" name="dateOfBirth" type="date" defaultValue={initial?.dateOfBirth ?? ""} />
          <Field label="Dirección" name="address" defaultValue={initial?.address ?? ""} />
          <Field label="Ciudad" name="city" defaultValue={initial?.city ?? ""} />
          <Field label="Código postal" name="zipCode" defaultValue={initial?.zipCode ?? ""} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Empleo</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Fecha de ingreso" name="hireDate" type="date" defaultValue={initial?.hireDate ?? ""} required />
          <Field label="Puesto" name="jobTitle" defaultValue={initial?.jobTitle ?? ""} />
          <Field label="Departamento" name="department" defaultValue={initial?.department ?? ""} />
          <div>
            <label className="label">Tipo</label>
            <select name="employeeType" className="input" value={type} onChange={(e) => setType(e.target.value as never)}>
              <option value="SALARIED">Salaried (sueldo fijo)</option>
              <option value="HOURLY">Hourly (por hora)</option>
              <option value="CONTRACTOR">Contractor (1099)</option>
            </select>
          </div>
          {type === "SALARIED" ? (
            <Field label="Sueldo anual ($)" name="annualSalary" type="number" step="0.01" defaultValue={initial?.annualSalary ?? ""} />
          ) : (
            <Field label="Tarifa por hora ($)" name="hourlyRate" type="number" step="0.0001" defaultValue={initial?.hourlyRate ?? ""} />
          )}
          <div>
            <label className="label">Estado</label>
            <select name="status" defaultValue={initial?.status ?? "ACTIVE"} className="input">
              <option value="ACTIVE">Activo</option>
              <option value="ON_LEAVE">En licencia</option>
              <option value="TERMINATED">Terminado</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Información fiscal (PR)</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">Filing status</label>
            <select name="filingStatus" defaultValue={initial?.filingStatus ?? "SINGLE"} className="input">
              <option value="SINGLE">Single</option>
              <option value="MARRIED_JOINT">Married joint</option>
              <option value="MARRIED_SEPARATE">Married separate</option>
              <option value="HEAD_OF_HOUSEHOLD">Head of household</option>
            </select>
          </div>
          <Field label="Dependientes" name="exemptions" type="number" defaultValue={initial?.exemptions ?? 0} />
          <Field label="Retención adicional ($/período)" name="extraWithholding" type="number" step="0.01" defaultValue={initial?.extraWithholding ?? 0} />
          <Field label="Balance PTO (días)" name="ptoBalance" type="number" step="0.01" defaultValue={initial?.ptoBalance ?? 0} />
        </div>
      </section>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <a href="/employees" className="btn-secondary">Cancelar</a>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="input"
      />
    </div>
  );
}
