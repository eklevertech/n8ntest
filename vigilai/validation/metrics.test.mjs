// Tests del módulo de métricas. Ejecutar con:  node --test validation/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confusionMatrix,
  metricsFrom,
  severityAccuracy,
  confidenceCalibration,
  evaluate,
  checkThresholds,
} from "./metrics.mjs";

test("confusionMatrix cuenta TP/FP/TN/FN", () => {
  const cm = confusionMatrix([
    { predicted: true, actual: true }, // tp
    { predicted: true, actual: false }, // fp
    { predicted: false, actual: true }, // fn
    { predicted: false, actual: false }, // tn
    { predicted: true, actual: true }, // tp
  ]);
  assert.deepEqual(cm, { tp: 2, fp: 1, tn: 1, fn: 1 });
});

test("metricsFrom calcula precision/recall/fpr/f1", () => {
  const m = metricsFrom({ tp: 8, fp: 2, tn: 8, fn: 2 });
  assert.equal(m.precision, 0.8); // 8/(8+2)
  assert.equal(m.recall, 0.8); // 8/(8+2)
  assert.equal(m.specificity, 0.8); // 8/(8+2)
  assert.ok(Math.abs(m.fpr - 0.2) < 1e-9); // 2/(2+8)
  assert.equal(m.accuracy, 0.8); // 16/20
  assert.ok(Math.abs(m.f1 - 0.8) < 1e-9);
});

test("metricsFrom no produce NaN con denominadores cero", () => {
  const m = metricsFrom({ tp: 0, fp: 0, tn: 0, fn: 0 });
  for (const v of Object.values(m)) assert.ok(Number.isFinite(v));
});

test("severityAccuracy solo considera violaciones reales detectadas", () => {
  const r = severityAccuracy([
    // real + detectado + alcanza el mínimo -> ok
    { actual: true, predictedViolation: true, predictedSeverity: "high", expectMinSeverity: "medium" },
    // real + detectado + por debajo del mínimo -> fallo
    { actual: true, predictedViolation: true, predictedSeverity: "low", expectMinSeverity: "high" },
    // no es violación real -> se ignora
    { actual: false, predictedViolation: true, predictedSeverity: "critical", expectMinSeverity: "low" },
    // sin mínimo esperado -> se ignora
    { actual: true, predictedViolation: true, predictedSeverity: "low" },
  ]);
  assert.equal(r.considered, 2);
  assert.equal(r.ok, 1);
  assert.equal(r.accuracy, 0.5);
});

test("confidenceCalibration agrupa por tramos e incluye el extremo 100", () => {
  const cal = confidenceCalibration([
    { confidence: 10, predicted: false, actual: false }, // 0-20 correcto
    { confidence: 90, predicted: true, actual: true }, // 80-100 correcto
    { confidence: 100, predicted: true, actual: false }, // 80-100 incorrecto
  ]);
  const high = cal.find((b) => b.range === "80-100");
  assert.equal(high.count, 2); // incluye 90 y 100
  assert.equal(high.correct, 1);
  const low = cal.find((b) => b.range === "0-20");
  assert.equal(low.count, 1);
  assert.equal(low.correct, 1);
});

test("evaluate separa la capa de modelo de la de alerta", () => {
  const rows = [
    // violación real: el modelo la ve pero la alerta se filtra (baja confianza)
    {
      id: "a",
      actual: true,
      expectMinSeverity: "low",
      result: { violationDetected: true, severity: "high", confidence: 30 },
      alerted: false,
    },
    // escena normal: el modelo no ve nada y no alerta
    {
      id: "b",
      actual: false,
      result: { violationDetected: false, severity: "none", confidence: 95 },
      alerted: false,
    },
  ];
  const rep = evaluate(rows);
  assert.equal(rep.total, 2);
  // El modelo acierta ambas (TP + TN)
  assert.deepEqual(rep.model.confusion, { tp: 1, fp: 0, tn: 1, fn: 0 });
  // Pero la alerta se filtró: la violación real queda como falso negativo
  assert.deepEqual(rep.alert.confusion, { tp: 0, fp: 0, tn: 1, fn: 1 });
});

test("checkThresholds reporta los incumplimientos", () => {
  const report = {
    alert: { recall: 0.5, precision: 0.9, fpr: 0.05 },
  };
  const fails = checkThresholds(report, {
    minRecall: 0.8,
    minPrecision: 0.7,
    maxFpr: 0.1,
  });
  assert.equal(fails.length, 1);
  assert.match(fails[0], /recall/);
});

test("checkThresholds vacío cuando se cumplen los umbrales", () => {
  const report = { alert: { recall: 0.9, precision: 0.9, fpr: 0.02 } };
  const fails = checkThresholds(report, {
    minRecall: 0.8,
    minPrecision: 0.7,
    maxFpr: 0.1,
  });
  assert.equal(fails.length, 0);
});
