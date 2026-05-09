import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type Role = "ADMIN" | "HR" | "EMPLOYEE";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) redirect("/");
  return session;
}

export function canManagePayroll(role: Role) {
  return role === "ADMIN" || role === "HR";
}
