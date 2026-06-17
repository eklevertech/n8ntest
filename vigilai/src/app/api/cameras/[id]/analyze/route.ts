import { NextResponse } from "next/server";
import { addEvent, getAccount, getCamera, newId, saveAccount } from "@/lib/store";
import { analyzeFrames, MissingApiKeyError, severityAtLeast } from "@/lib/detection";
import { dispatchAlert } from "@/lib/notify";
import { planOf } from "@/lib/plans";
import type { DetectionEvent } from "@/lib/types";

/**
 * Recibe un frame (data URL base64) del navegador, lo analiza con la IA contra
 * las reglas de la cámara y, si procede, dispara las notificaciones.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const camera = await getCamera(id);
  if (!camera) return NextResponse.json({ error: "Cámara no encontrada" }, { status: 404 });

  const body = (await req.json()) as { frame?: string; frames?: string[] };
  // Acepta una secuencia ('frames') o un único fotograma ('frame', compatibilidad).
  const frames = (body.frames ?? (body.frame ? [body.frame] : [])).filter(Boolean);
  if (frames.length === 0) {
    return NextResponse.json(
      { error: "Falta el campo 'frames' (o 'frame')." },
      { status: 400 },
    );
  }

  // Control de límites del plan (cada imagen analizada cuenta en la cuota).
  const account = await getAccount();
  const plan = planOf(account.plan);
  if (account.framesAnalyzedThisMonth >= plan.maxFramesPerMonth) {
    return NextResponse.json(
      { error: `Cuota de análisis del plan ${plan.name} agotada este mes.` },
      { status: 402 },
    );
  }

  let result;
  try {
    result = await analyzeFrames(frames, camera.rules);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message, code: "no_api_key" }, { status: 503 });
    }
    return NextResponse.json(
      { error: `Error de análisis: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  account.framesAnalyzedThisMonth += frames.length;
  await saveAccount(account);

  // ¿Debe alertar? Violación + severidad y confianza por encima del umbral.
  const minConfidence = Math.min(
    ...camera.rules.filter((r) => r.enabled).map((r) => r.minConfidence),
    101,
  );
  const shouldAlert =
    result.violationDetected &&
    severityAtLeast(result.severity, camera.notifications.minSeverity) &&
    result.confidence >= (Number.isFinite(minConfidence) ? minConfidence : 60);

  let notified: DetectionEvent["notified"] = [];
  if (shouldAlert) {
    notified = await dispatchAlert(camera, result);
  }

  // Solo persistimos eventos relevantes (violaciones) para no llenar el log.
  if (result.violationDetected) {
    const event: DetectionEvent = {
      id: newId("evt"),
      accountId: camera.accountId,
      cameraId: camera.id,
      cameraName: camera.name,
      createdAt: new Date().toISOString(),
      violationDetected: result.violationDetected,
      ruleViolated: result.ruleViolated,
      severity: result.severity,
      confidence: result.confidence,
      description: result.description,
      // Guarda el último fotograma de la secuencia como captura representativa.
      snapshot: shouldAlert ? frames[frames.length - 1] : undefined,
      notified,
    };
    await addEvent(event);
  }

  return NextResponse.json({ result, alerted: shouldAlert, notified });
}
