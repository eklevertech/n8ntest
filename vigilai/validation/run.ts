/**
 * Harness de validación de la detección.
 *
 * Ejecuta el MOTOR REAL (`analyzeFrames` de src/lib/detection.ts) contra un
 * conjunto de casos con etiqueta conocida (ground truth) y mide falsos positivos
 * y negativos, precisión, recall y la calibración de confianza.
 *
 * Uso:
 *   ANTHROPIC_API_KEY=sk-... node --experimental-strip-types validation/run.ts \
 *       --manifest validation/dataset/manifest.json
 *
 * Modo offline (sin clave, usa el campo `mock` de cada caso para validar el
 * cableado del harness: carga de frames + gating + métricas):
 *   node --experimental-strip-types validation/run.ts \
 *       --manifest validation/dataset/synthetic/manifest.json --mock
 *
 * Banderas:
 *   --manifest <ruta>     Manifiesto de casos (obligatorio).
 *   --mock                No llama a la IA; usa el veredicto `mock` de cada caso.
 *   --out <ruta>          Escribe el informe JSON (por defecto validation/report.json).
 *   --concurrency <n>     Casos en paralelo en modo real (por defecto 4).
 *   --min-recall <0-1>    Umbral de recall para el código de salida (def. 0.8).
 *   --min-precision <0-1> Umbral de precisión (def. 0.7).
 *   --max-fpr <0-1>       Tasa máxima de falsos positivos (def. 0.15).
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, extname, isAbsolute } from "node:path";
import { analyzeFrames, shouldAlert } from "../src/lib/detection.ts";
import type { DetectionResult } from "../src/lib/detection.ts";
import type { Rule, Severity } from "../src/lib/types.ts";
import {
  evaluate,
  checkThresholds,
  pct,
  SEVERITY_RANK,
} from "./metrics.mjs";

interface Case {
  id: string;
  description?: string;
  frames: string[];
  rules: Rule[];
  /** Severidad mínima de notificación de la cámara (gating de alerta). */
  minSeverity?: Severity;
  /** Ground truth: ¿ocurre realmente una violación en la secuencia? */
  expect: { violation: boolean; minSeverity?: Severity };
  /** Veredicto simulado, usado solo en modo --mock. */
  mock?: DetectionResult;
}

interface Manifest {
  cases: Case[];
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

async function frameToDataUrl(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();
  const mime = MIME[ext];
  if (!mime) {
    throw new Error(`Formato de frame no soportado (${ext}) en ${path}. Usa JPEG o PNG.`);
  }
  const buf = await readFile(path);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/** Resuelve rutas de frame relativas a la ubicación del manifiesto. */
function resolveFrame(manifestDir: string, frame: string): string {
  return isAbsolute(frame) ? frame : resolve(manifestDir, frame);
}

/** Pool de promesas con límite de concurrencia. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

interface Row {
  id: string;
  actual: boolean;
  expectMinSeverity?: Severity;
  result: DetectionResult;
  alerted: boolean;
  error?: string;
}

async function runCase(c: Case, manifestDir: string, mock: boolean): Promise<Row> {
  const camera = {
    rules: c.rules,
    notifications: {
      channels: [],
      minSeverity: (c.minSeverity ?? "low") as Severity,
    },
  };

  let result: DetectionResult;
  try {
    if (mock) {
      if (!c.mock) throw new Error(`El caso ${c.id} no tiene campo 'mock' para --mock.`);
      result = c.mock;
    } else {
      const frames = await Promise.all(
        c.frames.map((f) => frameToDataUrl(resolveFrame(manifestDir, f))),
      );
      result = await analyzeFrames(frames, c.rules);
    }
  } catch (err) {
    // Un error de un caso no aborta toda la corrida: se marca como no-detección.
    return {
      id: c.id,
      actual: c.expect.violation,
      expectMinSeverity: c.expect.minSeverity,
      result: {
        violationDetected: false,
        ruleViolated: "",
        severity: "none",
        confidence: 0,
        description: `ERROR: ${(err as Error).message}`,
      },
      alerted: false,
      error: (err as Error).message,
    };
  }

  return {
    id: c.id,
    actual: c.expect.violation,
    expectMinSeverity: c.expect.minSeverity,
    result,
    alerted: shouldAlert(result, camera),
  };
}

function bar(value: number, width = 24): string {
  const filled = Math.round(value * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function printReport(report: ReturnType<typeof evaluate>, rows: Row[]) {
  const line = "─".repeat(64);
  console.log(`\n${line}`);
  console.log(`  VALIDACIÓN DE DETECCIÓN — ${report.total} casos`);
  console.log(line);

  // Detalle por caso
  console.log("\n  Casos:");
  for (const r of rows) {
    const truth = r.actual ? "VIOLACIÓN" : "normal   ";
    const verdict = r.result.violationDetected ? "viol" : "ok  ";
    const correct = r.result.violationDetected === r.actual ? "✓" : "✗";
    const al = r.alerted ? "🔔" : "  ";
    const conf = String(r.result.confidence).padStart(3);
    console.log(
      `   ${correct} ${al} [${truth}] modelo=${verdict} sev=${r.result.severity.padEnd(8)} conf=${conf}  ${r.id}`,
    );
    if (r.error) console.log(`       ⚠ ${r.error}`);
  }

  for (const [name, m] of [
    ["MODELO (veredicto crudo)", report.model],
    ["ALERTA (tras filtrado severidad/confianza)", report.alert],
  ] as const) {
    const cm = m.confusion;
    console.log(`\n  ${name}`);
    console.log(
      `   TP=${cm.tp}  FP=${cm.fp}  TN=${cm.tn}  FN=${cm.fn}   (FP=falsa alarma, FN=violación no detectada)`,
    );
    console.log(`   precision  ${bar(m.precision)} ${pct(m.precision)}`);
    console.log(`   recall     ${bar(m.recall)} ${pct(m.recall)}`);
    console.log(`   F1         ${bar(m.f1)} ${pct(m.f1)}`);
    console.log(`   falsos+    ${bar(m.fpr)} ${pct(m.fpr)}`);
  }

  const sev = report.severity;
  console.log(
    `\n  Severidad (en violaciones detectadas): ${sev.ok}/${sev.considered} alcanzan el mínimo esperado (${pct(sev.accuracy)})`,
  );

  console.log("\n  Calibración de confianza (acierto del modelo por tramo):");
  for (const b of report.calibration) {
    if (b.count === 0) continue;
    console.log(
      `   ${b.range.padStart(6)}  n=${String(b.count).padStart(3)}  ${bar(b.accuracy, 16)} ${pct(b.accuracy)}`,
    );
  }
  console.log(`${line}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = args.manifest as string;
  if (!manifestPath) {
    console.error("Falta --manifest <ruta>. Ver validation/README.md.");
    process.exit(2);
  }
  const mock = Boolean(args.mock);
  const outPath = (args.out as string) || "validation/report.json";
  const concurrency = Number(args.concurrency) || 4;
  const thresholds = {
    minRecall: args["min-recall"] !== undefined ? Number(args["min-recall"]) : 0.8,
    minPrecision: args["min-precision"] !== undefined ? Number(args["min-precision"]) : 0.7,
    maxFpr: args["max-fpr"] !== undefined ? Number(args["max-fpr"]) : 0.15,
  };

  if (!mock && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "Falta ANTHROPIC_API_KEY. Define la clave para una corrida real, o usa --mock para validar el cableado.",
    );
    process.exit(2);
  }

  const absManifest = resolve(manifestPath);
  const manifestDir = dirname(absManifest);
  const manifest = JSON.parse(await readFile(absManifest, "utf8")) as Manifest;
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    console.error("El manifiesto no contiene 'cases'.");
    process.exit(2);
  }

  // Aviso de cordura sobre severidades inválidas en el manifiesto.
  for (const c of manifest.cases) {
    if (c.expect.minSeverity && !(c.expect.minSeverity in SEVERITY_RANK)) {
      console.error(`Caso ${c.id}: expect.minSeverity inválida (${c.expect.minSeverity}).`);
      process.exit(2);
    }
  }

  console.log(
    `Ejecutando ${manifest.cases.length} casos${mock ? " (modo MOCK, sin IA)" : ` con ${concurrency} en paralelo`}…`,
  );
  const rows = await mapPool(manifest.cases, mock ? manifest.cases.length : concurrency, (c) =>
    runCase(c, manifestDir, mock),
  );

  const report = evaluate(rows);
  printReport(report, rows);

  await writeFile(
    resolve(outPath),
    JSON.stringify({ generatedAt: new Date().toISOString(), mock, thresholds, report, rows }, null, 2),
  );
  console.log(`Informe escrito en ${outPath}`);

  const failures = checkThresholds(report, thresholds);
  if (failures.length > 0) {
    console.error("\n❌ Umbrales no alcanzados:");
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log("✅ Todos los umbrales se cumplen.");
}

main().catch((err) => {
  console.error("Error fatal en la validación:", err);
  process.exit(2);
});
