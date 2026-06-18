import { NextResponse } from "next/server";
import { deleteCamera, getCamera, updateCamera } from "@/lib/store";
import { getCurrentAuth } from "@/lib/auth";
import type { Camera } from "@/lib/types";

/** Carga la cámara verificando que pertenece a la cuenta autenticada. */
async function loadOwned(id: string) {
  const auth = await getCurrentAuth();
  if (!auth) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  const camera = await getCamera(id);
  if (!camera || camera.accountId !== auth.account.id) {
    return { error: NextResponse.json({ error: "Cámara no encontrada" }, { status: 404 }) };
  }
  return { auth, camera };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadOwned(id);
  if ("error" in res) return res.error;
  return NextResponse.json({ camera: res.camera });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadOwned(id);
  if ("error" in res) return res.error;
  const patch = (await req.json()) as Partial<Camera>;
  // No permitir reasignar la cámara a otra cuenta.
  delete patch.accountId;
  delete patch.id;
  const camera = await updateCamera(id, patch);
  return NextResponse.json({ camera });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadOwned(id);
  if ("error" in res) return res.error;
  await deleteCamera(id);
  return NextResponse.json({ ok: true });
}
