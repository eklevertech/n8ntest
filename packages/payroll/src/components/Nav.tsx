import Link from 'next/link';
import { signOut } from '@/lib/auth';
import type { Role } from '@prisma/client';

const linksByRole: Record<Role, Array<{ href: string; label: string }>> = {
  ADMIN: [
    { href: '/', label: 'Inicio' },
    { href: '/employees', label: 'Empleados' },
    { href: '/attendance', label: 'Asistencia' },
    { href: '/pto', label: 'PTO' },
    { href: '/payroll', label: 'Nómina' },
    { href: '/reports', label: 'Reportes' },
  ],
  HR: [
    { href: '/', label: 'Inicio' },
    { href: '/employees', label: 'Empleados' },
    { href: '/attendance', label: 'Asistencia' },
    { href: '/pto', label: 'PTO' },
    { href: '/payroll', label: 'Nómina' },
    { href: '/reports', label: 'Reportes' },
  ],
  EMPLOYEE: [
    { href: '/', label: 'Inicio' },
    { href: '/me', label: 'Mi portal' },
    { href: '/attendance', label: 'Asistencia' },
    { href: '/pto', label: 'PTO' },
  ],
};

export function Nav({ role, email }: { role: Role; email: string }) {
  const links = linksByRole[role];
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-brand">Nómina PR</span>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-gray-600 hover:text-brand"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {email} <span className="ml-1 badge-gray">{role}</span>
          </span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="btn-secondary">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
