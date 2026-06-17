import { NextResponse } from "next/server";
import { getVapidPublicKey, saveSubscription } from "@/lib/notify/push";

/** Devuelve la clave pública VAPID para que el navegador se suscriba. */
export async function GET() {
  return NextResponse.json({ publicKey: getVapidPublicKey() });
}

/** Registra una suscripción push del navegador. */
export async function POST(req: Request) {
  const sub = await req.json();
  if (!sub?.endpoint) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }
  await saveSubscription(sub);
  return NextResponse.json({ ok: true });
}
