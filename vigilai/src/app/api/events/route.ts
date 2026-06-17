import { NextResponse } from "next/server";
import { listEvents } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cameraId = url.searchParams.get("cameraId") ?? undefined;
  const events = await listEvents(undefined, { cameraId, limit: 100 });
  return NextResponse.json({ events });
}
