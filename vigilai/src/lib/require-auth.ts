import { redirect } from "next/navigation";
import { getCurrentAuth, type AuthContext } from "./auth";

/** Para usar en páginas (server components): exige sesión o redirige a /login. */
export async function requirePageAuth(): Promise<AuthContext> {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/login");
  return auth;
}
