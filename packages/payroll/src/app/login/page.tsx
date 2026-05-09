import { redirect } from 'next/navigation';
import { signIn, auth } from '@/lib/auth';

async function loginAction(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  const password = String(formData.get('password') ?? '');
  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    if (msg.includes('NEXT_REDIRECT')) throw err;
    redirect('/login?error=1');
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect('/');
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="mb-1 text-2xl font-semibold text-brand">Nómina PR</h1>
          <p className="mb-6 text-sm text-gray-500">
            Ingresa con tu correo corporativo.
          </p>
          {error ? (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              Credenciales inválidas. Intenta nuevamente.
            </div>
          ) : null}
          <form action={loginAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Correo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="usuario@empresa.pr"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Entrar
            </button>
          </form>
          <p className="mt-6 text-xs text-gray-400">
            Cuentas demo: admin@acme.pr / admin123 — hr@acme.pr / hr123 — empleado@acme.pr / emp123
          </p>
        </div>
      </div>
    </main>
  );
}
