import { NextResponse } from "next/server";
import { createAccount, createUser, getUserByEmail } from "@/lib/store";
import { hashPassword, startSession, toSafeUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  // Evita creación masiva de cuentas: máx. 5 registros por IP cada hora.
  const ip = clientIp(req);
  const rl = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados registros desde esta red. Inténtalo más tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const body = (await req.json()) as {
    email?: string;
    password?: string;
    name?: string;
    orgName?: string;
    plan?: string;
  };

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Ese email ya está registrado." }, { status: 409 });
  }

  const plan: PlanId = body.plan && body.plan in PLANS ? (body.plan as PlanId) : "free";
  const orgName = (body.orgName ?? "").trim() || `Organización de ${name || email}`;

  const account = await createAccount({ name: orgName, plan });
  const user = await createUser({
    accountId: account.id,
    email,
    name: name || email.split("@")[0],
    passwordHash: hashPassword(password),
  });

  await startSession(user.id);
  return NextResponse.json({ user: toSafeUser(user) }, { status: 201 });
}
