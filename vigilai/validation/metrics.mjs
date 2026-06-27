// Métricas de validación de la detección. Funciones puras y deterministas:
// no llaman a ninguna API, así que se pueden testear de forma aislada.

/** @typedef {"none"|"low"|"medium"|"high"|"critical"} Severity */

export const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Construye una matriz de confusión a partir de pares (predicho, real) booleanos.
 * @param {{predicted: boolean, actual: boolean}[]} pairs
 */
export function confusionMatrix(pairs) {
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  for (const { predicted, actual } of pairs) {
    if (predicted && actual) tp++;
    else if (predicted && !actual) fp++;
    else if (!predicted && actual) fn++;
    else tn++;
  }
  return { tp, fp, tn, fn };
}

/** Divide evitando NaN: devuelve `fallback` (por defecto 0) si el denominador es 0. */
function ratio(num, den, fallback = 0) {
  return den === 0 ? fallback : num / den;
}

/**
 * Calcula las métricas clásicas a partir de una matriz de confusión.
 * - precision: de lo que alertamos, cuánto era real (1 - tasa de falsas alarmas).
 * - recall (sensibilidad): de lo real, cuánto detectamos.
 * - specificity: de lo normal, cuánto dejamos pasar sin alertar.
 * - fpr: tasa de falsos positivos (falsas alarmas sobre el total de escenas normales).
 * - f1: media armónica de precision y recall.
 * @param {{tp:number,fp:number,tn:number,fn:number}} cm
 */
export function metricsFrom(cm) {
  const { tp, fp, tn, fn } = cm;
  const precision = ratio(tp, tp + fp, 1); // sin alertas, no hay falsas alarmas
  const recall = ratio(tp, tp + fn, 1); // sin positivos reales, recall trivial = 1
  const specificity = ratio(tn, tn + fp, 1);
  const fpr = ratio(fp, fp + tn, 0);
  const accuracy = ratio(tp + tn, tp + fp + tn + fn, 0);
  const f1 = ratio(2 * precision * recall, precision + recall, 0);
  return { precision, recall, specificity, fpr, accuracy, f1 };
}

/**
 * Exactitud de severidad sobre los casos que son violaciones reales (actual=true)
 * y que el modelo marcó como violación. Comprueba si la severidad predicha alcanza
 * el mínimo esperado (`expectMinSeverity`). Si un caso no define mínimo, se omite.
 * @param {{predictedSeverity:Severity, predictedViolation:boolean, actual:boolean, expectMinSeverity?:Severity}[]} cases
 */
export function severityAccuracy(cases) {
  let considered = 0;
  let ok = 0;
  for (const c of cases) {
    if (!c.actual || !c.predictedViolation || !c.expectMinSeverity) continue;
    considered++;
    if (SEVERITY_RANK[c.predictedSeverity] >= SEVERITY_RANK[c.expectMinSeverity]) ok++;
  }
  return { considered, ok, accuracy: ratio(ok, considered, 1) };
}

/**
 * Calibración de confianza: agrupa los veredictos por tramos de confianza y mide
 * qué fracción acertó (predicción == realidad) en cada tramo. Un detector bien
 * calibrado acierta más en los tramos de confianza alta.
 * @param {{confidence:number, predicted:boolean, actual:boolean}[]} cases
 */
export function confidenceCalibration(cases, buckets = [0, 20, 40, 60, 80, 100]) {
  const out = [];
  for (let i = 0; i < buckets.length - 1; i++) {
    const lo = buckets[i];
    const hi = buckets[i + 1];
    const last = i === buckets.length - 2;
    const inBucket = cases.filter(
      (c) => c.confidence >= lo && (last ? c.confidence <= hi : c.confidence < hi),
    );
    const correct = inBucket.filter((c) => c.predicted === c.actual).length;
    out.push({
      range: `${lo}-${hi}`,
      count: inBucket.length,
      correct,
      accuracy: ratio(correct, inBucket.length, 0),
    });
  }
  return out;
}

/**
 * Evalúa un conjunto de resultados y produce el informe completo. No conoce nada
 * de Anthropic ni de ficheros: recibe los veredictos ya calculados.
 *
 * @param {{
 *   id:string,
 *   actual:boolean,
 *   expectMinSeverity?:Severity,
 *   result:{violationDetected:boolean, severity:Severity, confidence:number},
 *   alerted:boolean
 * }[]} rows
 */
export function evaluate(rows) {
  // Capa A: veredicto crudo del modelo (violationDetected).
  const modelPairs = rows.map((r) => ({
    predicted: r.result.violationDetected,
    actual: r.actual,
  }));
  // Capa B: decisión final de alerta tras el filtrado de severidad/confianza.
  const alertPairs = rows.map((r) => ({ predicted: r.alerted, actual: r.actual }));

  const modelCm = confusionMatrix(modelPairs);
  const alertCm = confusionMatrix(alertPairs);

  return {
    total: rows.length,
    model: { confusion: modelCm, ...metricsFrom(modelCm) },
    alert: { confusion: alertCm, ...metricsFrom(alertCm) },
    severity: severityAccuracy(
      rows.map((r) => ({
        predictedSeverity: r.result.severity,
        predictedViolation: r.result.violationDetected,
        actual: r.actual,
        expectMinSeverity: r.expectMinSeverity,
      })),
    ),
    calibration: confidenceCalibration(
      rows.map((r) => ({
        confidence: r.result.confidence,
        predicted: r.result.violationDetected,
        actual: r.actual,
      })),
    ),
  };
}

/**
 * Comprueba el informe contra umbrales mínimos y devuelve la lista de fallos.
 * Se usa para el código de salida (gating en CI).
 * @param {ReturnType<typeof evaluate>} report
 * @param {{minRecall:number, minPrecision:number, maxFpr:number}} thresholds
 */
export function checkThresholds(report, thresholds) {
  const failures = [];
  const { alert } = report;
  if (alert.recall < thresholds.minRecall) {
    failures.push(
      `recall ${pct(alert.recall)} < mínimo ${pct(thresholds.minRecall)} (se escapan violaciones)`,
    );
  }
  if (alert.precision < thresholds.minPrecision) {
    failures.push(
      `precision ${pct(alert.precision)} < mínimo ${pct(thresholds.minPrecision)} (demasiadas falsas alarmas)`,
    );
  }
  if (alert.fpr > thresholds.maxFpr) {
    failures.push(
      `tasa de falsos positivos ${pct(alert.fpr)} > máximo ${pct(thresholds.maxFpr)}`,
    );
  }
  return failures;
}

export function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}
