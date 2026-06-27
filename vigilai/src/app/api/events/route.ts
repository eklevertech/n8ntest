import { NextResponse } from "next/server";
import { listEvents } from "@/lib/store";
import { getCurrentAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const url = new URL(req.url);
  const cameraId = url.searchParams.get("cameraId") ?? undefined;
  const events = await listEvents(auth.account.id, { cameraId, limit: 100 });
  return NextResponse.json({ events });
}
