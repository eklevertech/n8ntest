import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/store";
import { startSession, toSafeUser, verifyPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Frena fuerza bruta: máx. 10 intentos por IP cada 5 minutos.
  const ip = clientIp(req);
  const rl = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Inténtalo más tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

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
