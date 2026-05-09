import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe NextAuth config (sin Prisma ni bcrypt). El middleware lo importa
 * directamente y delega la lógica completa a `auth.ts` (que corre en Node).
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    authorized: ({ auth }) => !!auth,
  },
} satisfies NextAuthConfig;
