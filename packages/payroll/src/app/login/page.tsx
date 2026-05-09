import { signIn } from "@/auth";
import { redirect } from "next/navigation";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; callbackUrl?: string };
}) {
  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: "/",
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("NEXT_REDIRECT")) throw e;
      redirect("/login?error=invalid");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Iniciar sesión</h1>
        <p className="text-sm text-slate-500 mb-6">Payroll PR — Acme Corp</p>
        {searchParams.error && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            Credenciales inválidas.
          </div>
        )}
        <form action={action} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" required className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">Entrar</button>
        </form>
        <p className="text-xs text-slate-500 mt-6">
          Demo seed: admin@acme.pr / admin123 — hr@acme.pr / hr123 — empleado@acme.pr / emp123
        </p>
      </div>
    </main>
  );
}
