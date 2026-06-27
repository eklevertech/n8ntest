import { NextResponse } from "next/server";
import { getVapidPublicKey, saveSubscription } from "@/lib/notify/push";
import { getCurrentAuth } from "@/lib/auth";

/** Devuelve la clave pública VAPID para que el navegador se suscriba. */
export async function GET() {
  return NextResponse.json({ publicKey: getVapidPublicKey() });
}

/** Registra una suscripción push del navegador, asociada a la cuenta autenticada. */
export async function POST(req: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const sub = await req.json();
  if (!sub?.endpoint) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }
  await saveSubscription(auth.account.id, sub);
  return NextResponse.json({ ok: true });
}
