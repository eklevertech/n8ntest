import { NextResponse } from "next/server";
import { createCamera, listCameras } from "@/lib/store";
import { getCurrentAuth } from "@/lib/auth";
import { planOf } from "@/lib/plans";
import { MAX_FRAMES_PER_ANALYSIS } from "@/lib/detection";
import type { Camera } from "@/lib/types";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(n)));

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const cameras = await listCameras(auth.account.id);
  return NextResponse.json({ cameras });
}

export async function POST(req: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await req.json()) as Partial<Camera>;
  const plan = planOf(auth.account.plan);

  const existing = await listCameras(auth.account.id);
  if (existing.length >= plan.maxCameras) {
    return NextResponse.json(
      {
        error: `Tu plan ${plan.name} permite hasta ${plan.maxCameras} cámara(s). Mejora tu plan para añadir más.`,
      },
      { status: 402 },
    );
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  // Solo permite canales incluidos en el plan.
  const requested = body.notifications?.channels ?? ["push"];
  const channels = requested.filter((c) => plan.channels.includes(c));

  const camera = await createCamera({
    accountId: auth.account.id,
    name: body.name.trim(),
    location: body.location?.trim() || "Sin ubicación",
    rules: (body.rules ?? []).map((r, i) => ({
      id: r.id || `rule_${i}`,
      description: r.description,
      minConfidence: r.minConfidence ?? 60,
      enabled: r.enabled ?? true,
    })),
    notifications: {
      channels,
      email: body.notifications?.email,
      phone: body.notifications?.phone,
      minSeverity: body.notifications?.minSeverity ?? "medium",
    },
    captureIntervalSec: Math.max(2, body.captureIntervalSec ?? 8),
    framesPerAnalysis: clamp(body.framesPerAnalysis ?? 4, 1, MAX_FRAMES_PER_ANALYSIS),
    frameSpacingMs: clamp(body.frameSpacingMs ?? 700, 200, 3000),
    motionDetectionEnabled: body.motionDetectionEnabled ?? true,
    motionThreshold: Math.max(0.1, Math.min(100, body.motionThreshold ?? 1.5)),
  });

  return NextResponse.json({ camera }, { status: 201 });
}
