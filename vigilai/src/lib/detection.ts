import Anthropic from "@anthropic-ai/sdk";
import type { Camera, Rule, Severity } from "./types";

/**
 * Motor de detección: envía un frame del video a Claude (visión) junto con las
 * reglas en lenguaje natural de la cámara y devuelve un veredicto estructurado.
 *
 * Para garantizar una salida con esquema fijo usamos *forced tool use*: el modelo
 * está obligado a llamar a la herramienta `report_observation`, cuyos argumentos
 * son el veredicto. Es estable en todas las versiones recientes del SDK.
 *
 * Modelo por defecto: claude-opus-4-8 (visión). Se puede cambiar con
 * DETECTION_MODEL (p.ej. claude-haiku-4-5 para abaratar a gran escala,
 * claude-sonnet-4-6 para un punto intermedio).
 */
const MODEL = process.env.DETECTION_MODEL || "claude-opus-4-8";

export interface DetectionResult {
  violationDetected: boolean;
  ruleViolated: string;
  severity: Severity;
  confidence: number;
  description: string;
}

const REPORT_TOOL: Anthropic.Tool = {
  name: "report_observation",
  description:
    "Reporta el veredicto del análisis de un fotograma de videovigilancia.",
  input_schema: {
    type: "object",
    properties: {
      violationDetected: {
        type: "boolean",
        description: "true solo si alguna regla se viola de forma clara en la imagen.",
      },
      ruleViolated: {
        type: "string",
        description: "Texto de la regla que se viola, o cadena vacía si no hay violación.",
      },
      severity: {
        type: "string",
        enum: ["none", "low", "medium", "high", "critical"],
        description: "Gravedad de la situación detectada.",
      },
      confidence: {
        type: "integer",
        description: "Confianza de 0 a 100 en que la violación realmente ocurre.",
      },
      description: {
        type: "string",
        description: "Descripción breve y objetiva de lo que se observa en la imagen.",
      },
    },
    required: ["violationDetected", "ruleViolated", "severity", "confidence", "description"],
  },
};

const SYSTEM_PROMPT = `Eres un analista de seguridad para un sistema de videovigilancia.
Recibes una SECUENCIA de fotogramas consecutivos de una misma cámara, capturados
con pocos segundos (o fracciones de segundo) de diferencia y en orden cronológico,
junto con una lista de reglas en lenguaje natural. Los fotogramas representan un
fragmento corto de video: úsalos en conjunto para razonar sobre el MOVIMIENTO y la
ACCIÓN que ocurre, no como imágenes aisladas.

Determina, con criterio conservador, si la secuencia muestra una violación clara de
alguna regla (por ejemplo: alguien toma mercancía y se desplaza hacia la salida,
una persona entra en una zona restringida, merodeo, forcejeo o violencia).

Principios:
- Aprovecha la dimensión temporal: compara qué cambia entre fotogramas (personas que
  aparecen/desaparecen, objetos que se mueven o desaparecen, trayectorias hacia una
  salida). Una acción sospechosa suele verse en la transición, no en un solo cuadro.
- Marca violationDetected=true solo cuando la evidencia a lo largo de la secuencia
  sea clara. Ante la duda, devuelve false con la confianza correspondiente: es
  preferible no alertar que generar falsas alarmas.
- En 'description' resume la acción observada a lo largo de la secuencia, no solo el
  último fotograma. Sé honesto sobre la incertidumbre en 'confidence'.
- No inventes detalles que no aparezcan en las imágenes.
Siempre responde llamando a la herramienta report_observation.`;

function rulesBlock(rules: Rule[]): string {
  const enabled = rules.filter((r) => r.enabled);
  if (enabled.length === 0) return "(La cámara no tiene reglas activas.)";
  return enabled.map((r, i) => `${i + 1}. ${r.description}`).join("\n");
}

/** Extrae el mime y los datos base64 de una data URL. */
function parseDataUrl(dataUrl: string): {
  mediaType: "image/jpeg" | "image/png";
  data: string;
} {
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/s.exec(dataUrl.trim());
  if (!m) throw new Error("El frame debe ser una data URL JPEG o PNG en base64.");
  return { mediaType: m[1] as "image/jpeg" | "image/png", data: m[2] };
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("Falta ANTHROPIC_API_KEY. Configúrala para habilitar la detección por IA.");
    this.name = "MissingApiKeyError";
  }
}

function coerce(input: Record<string, unknown>): DetectionResult {
  const allowed: Severity[] = ["none", "low", "medium", "high", "critical"];
  const severity = allowed.includes(input.severity as Severity)
    ? (input.severity as Severity)
    : "none";
  const confidenceRaw = Number(input.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(100, Math.round(confidenceRaw)))
    : 0;
  return {
    violationDetected: Boolean(input.violationDetected),
    ruleViolated: typeof input.ruleViolated === "string" ? input.ruleViolated : "",
    severity,
    confidence,
    description: typeof input.description === "string" ? input.description : "",
  };
}

/** Máximo de fotogramas por análisis (límite defensivo de coste/tamaño). */
export const MAX_FRAMES_PER_ANALYSIS = 8;

export async function analyzeFrames(
  frameDataUrls: string[],
  rules: Rule[],
): Promise<DetectionResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  if (frameDataUrls.length === 0) {
    throw new Error("Se requiere al menos un fotograma.");
  }

  const frames = frameDataUrls.slice(0, MAX_FRAMES_PER_ANALYSIS);
  const client = new Anthropic();

  // Construye el contenido: cada imagen precedida de una etiqueta cronológica.
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text:
        frames.length === 1
          ? "Fotograma único de la cámara:"
          : `Secuencia de ${frames.length} fotogramas consecutivos (en orden cronológico):`,
    },
  ];
  frames.forEach((frame, i) => {
    const { mediaType, data } = parseDataUrl(frame);
    content.push({ type: "text", text: `Fotograma ${i + 1}/${frames.length}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
  });
  content.push({
    type: "text",
    text: `Reglas de vigilancia de esta cámara:\n${rulesBlock(
      rules,
    )}\n\nAnaliza la secuencia completa razonando sobre el movimiento y reporta el veredicto.`,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [REPORT_TOOL],
    tool_choice: { type: "tool", name: "report_observation" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    return {
      violationDetected: false,
      ruleViolated: "",
      severity: "none",
      confidence: 0,
      description: "No se pudo obtener un veredicto estructurado para este frame.",
    };
  }
  return coerce(toolUse.input as Record<string, unknown>);
}

const SEVERITY_RANK: Record<Severity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function severityAtLeast(value: Severity, min: Severity): boolean {
  return SEVERITY_RANK[value] >= SEVERITY_RANK[min];
}

/**
 * Decide si un veredicto debe disparar una notificación, aplicando los mismos
 * umbrales que usa el producto: hay violación, la severidad alcanza el mínimo
 * configurado en la cámara y la confianza supera el menor `minConfidence` de las
 * reglas activas (con 60 como valor por defecto si no hay reglas activas).
 *
 * Se extrae aquí para que la ruta /analyze y el harness de validación compartan
 * exactamente la misma lógica y no se desincronicen.
 */
export function shouldAlert(
  result: DetectionResult,
  camera: Pick<Camera, "rules" | "notifications">,
): boolean {
  const minConfidence = Math.min(
    ...camera.rules.filter((r) => r.enabled).map((r) => r.minConfidence),
    101,
  );
  return (
    result.violationDetected &&
    severityAtLeast(result.severity, camera.notifications.minSeverity) &&
    result.confidence >= (Number.isFinite(minConfidence) ? minConfidence : 60)
  );
}
