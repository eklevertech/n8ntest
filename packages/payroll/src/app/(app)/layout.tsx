import { requireSession } from '@/lib/session';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <>
      <Nav role={session.user.role} email={session.user.email ?? ''} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </>
  );
}
