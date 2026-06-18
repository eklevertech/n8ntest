import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/store";
import { startSession, toSafeUser, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const user = await getUserByEmail(email);
  // Mismo mensaje para usuario inexistente o contraseña incorrecta (no filtrar info).
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  }

  await startSession(user.id);
  return NextResponse.json({ user: toSafeUser(user) });
}
