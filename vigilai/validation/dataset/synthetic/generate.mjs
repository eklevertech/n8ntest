// Genera un dataset SINTÉTICO mínimo (PNGs de colores sólidos) y su manifiesto.
//
// OJO: estos frames NO sirven para medir la calidad de visión del modelo —son
// rectángulos de color. Su único propósito es poder ejercitar el harness de
// punta a punta (carga de frames -> gating -> métricas -> código de salida) sin
// depender de footage real ni de una clave de API (modo --mock).
//
// Para una validación REAL, sustituye estos frames por fotogramas extraídos de
// vídeos de vigilancia etiquetados (ver validation/README.md).
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));

// --- Codificador PNG mínimo (RGB de 8 bits) -------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor (RGB)
  // 10..12 = compression/filter/interlace = 0
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filtro None
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Definición de casos sintéticos ---------------------------------------
const RULE = {
  id: "r1",
  description: "Avisar si una persona entra en la zona restringida",
  minConfidence: 60,
  enabled: true,
};

// Cada caso: id, color de los frames, ground truth y veredicto simulado (mock).
const cases = [
  {
    id: "intrusion-clara",
    colors: [[200, 30, 30], [210, 40, 40]],
    expect: { violation: true, minSeverity: "medium" },
    mock: { violationDetected: true, ruleViolated: RULE.description, severity: "high", confidence: 90, description: "Persona cruza a la zona restringida." },
  },
  {
    id: "escena-normal",
    colors: [[30, 120, 30], [32, 122, 32]],
    expect: { violation: false },
    mock: { violationDetected: false, ruleViolated: "", severity: "none", confidence: 95, description: "Sin actividad relevante." },
  },
  {
    id: "violacion-baja-confianza",
    colors: [[40, 40, 160], [44, 44, 165]],
    expect: { violation: true, minSeverity: "low" },
    // El modelo la ve pero con confianza por debajo del umbral -> no debe alertar (FN de alerta).
    mock: { violationDetected: true, ruleViolated: RULE.description, severity: "low", confidence: 35, description: "Posible figura, dudoso." },
  },
  {
    id: "falsa-alarma-sombra",
    colors: [[120, 120, 120], [128, 128, 128]],
    expect: { violation: false },
    // El modelo se equivoca y marca violación con alta confianza -> falso positivo.
    mock: { violationDetected: true, ruleViolated: RULE.description, severity: "medium", confidence: 80, description: "Movimiento de sombra confundido con persona." },
  },
];

async function main() {
  const manifestCases = [];
  for (const c of cases) {
    const dir = resolve(HERE, "frames", c.id);
    await mkdir(dir, { recursive: true });
    const frames = [];
    for (let i = 0; i < c.colors.length; i++) {
      const rel = `frames/${c.id}/f${i + 1}.png`;
      await writeFile(resolve(HERE, rel), encodePng(48, 36, c.colors[i]));
      frames.push(rel);
    }
    manifestCases.push({
      id: c.id,
      frames,
      rules: [RULE],
      minSeverity: "low",
      expect: c.expect,
      mock: c.mock,
    });
  }
  const manifest = { cases: manifestCases };
  await writeFile(resolve(HERE, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Generados ${manifestCases.length} casos sintéticos y manifest.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
