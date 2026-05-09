import Link from "next/link";
import { requireSession } from "@/lib/rbac";
import { signOut } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const role = session.user.role;
  const isStaff = role === "ADMIN" || role === "HR";

  const nav = [
    { href: "/", label: "Inicio", show: true },
    { href: "/employees", label: "Empleados", show: isStaff },
    { href: "/attendance", label: "Asistencia", show: true },
    { href: "/pto", label: "PTO", show: true },
    { href: "/payroll", label: "Nómina", show: isStaff },
    { href: "/reports", label: "Reportes", show: isStaff },
    { href: "/me", label: "Mi portal", show: !!session.user.employeeId },
  ];

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-brand-700">Payroll PR</Link>
            <nav className="flex gap-4 text-sm">
              {nav.filter((n) => n.show).map((n) => (
                <Link key={n.href} href={n.href} className="text-slate-600 hover:text-brand-700">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {session.user.name} · <span className="badge bg-slate-100 text-slate-700">{role}</span>
            </span>
            <form action={logout}>
              <button className="btn-secondary" type="submit">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-400">
        Payroll PR — Hacienda + FICA + SINOT (modelo simplificado)
      </footer>
    </div>
  );
}
