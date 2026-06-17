import { NextResponse } from "next/server";
import { deleteCamera, getCamera, updateCamera } from "@/lib/store";
import type { Camera } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camera = await getCamera(id);
  if (!camera) return NextResponse.json({ error: "Cámara no encontrada" }, { status: 404 });
  return NextResponse.json({ camera });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = (await req.json()) as Partial<Camera>;
  const camera = await updateCamera(id, patch);
  if (!camera) return NextResponse.json({ error: "Cámara no encontrada" }, { status: 404 });
  return NextResponse.json({ camera });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteCamera(id);
  if (!ok) return NextResponse.json({ error: "Cámara no encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
