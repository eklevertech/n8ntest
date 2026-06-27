# Validación de la detección

Harness para medir la **calidad real** del motor de detección de VigilAI: ejecuta
`analyzeFrames` (el mismo código que usa la app en `src/lib/detection.ts`) contra
un conjunto de casos con etiqueta conocida (_ground truth_) y reporta falsos
positivos/negativos, precisión, recall y calibración de confianza.

## ¿Por qué dos capas de métricas?

El informe mide **dos cosas distintas**, porque importan por separado:

1. **MODELO (veredicto crudo)** — ¿el modelo marcó `violationDetected` correctamente?
   Mide la capacidad pura de visión.
2. **ALERTA (tras filtrado)** — ¿el producto _habría notificado_? Aplica el mismo
   gating que la ruta `/analyze` vía `shouldAlert()`: violación **+** severidad
   mínima de la cámara **+** confianza por encima del umbral de las reglas.
   Esto es lo que el usuario realmente vive (una alerta filtrada que no salta es
   un falso negativo aunque el modelo haya "visto" algo).

Glosario rápido:

- **FP (falso positivo)** = falsa alarma (alertamos sin que pasara nada).
- **FN (falso negativo)** = violación que se nos escapó.
- **precision** = de lo que alertamos, qué fracción era real (↑ = menos falsas alarmas).
- **recall** = de las violaciones reales, qué fracción detectamos (↑ = se escapan menos).

## Uso rápido

```bash
# 1) Smoke test del harness, sin clave ni footage (dataset sintético + mocks):
npm run validate:gen      # genera frames PNG sintéticos
npm run validate:mock     # ejecuta el pipeline completo en modo mock

# 2) Validación REAL contra tu footage etiquetado:
export ANTHROPIC_API_KEY=sk-ant-...
npm run validate -- --manifest validation/dataset/manifest.json
```

> El runner usa el _type stripping_ de Node (`--experimental-strip-types`,
> disponible en Node ≥ 22.6) para ejecutar TypeScript directamente, así que valida
> el motor sin paso de build.

## Preparar un dataset real

1. **Reúne clips etiquetados.** Para cada incidente y para escenas normales
   (¡incluye muchas normales: son las que generan falsas alarmas!).
2. **Extrae fotogramas** de cada clip. El motor analiza una _secuencia_ corta
   (por defecto la app captura varios frames por ciclo). Con `ffmpeg`:

   ```bash
   # 4 fotogramas a ~1 fps del segmento relevante:
   ffmpeg -i incidente.mp4 -vf fps=1 -frames:v 4 clips/hurto-pasillo-3/f%d.jpg
   ```

   Usa JPEG o PNG. Mantén la resolución razonable (p.ej. 720p) para controlar coste.
3. **Escribe el manifiesto.** Copia `dataset/manifest.example.json` a
   `dataset/manifest.json` y completa cada caso:

   | campo                 | significado                                                        |
   | --------------------- | ------------------------------------------------------------------ |
   | `id`                  | identificador único del caso                                       |
   | `frames`              | rutas a los fotogramas (relativas al manifiesto), en orden         |
   | `rules`               | reglas de la cámara (mismo formato que la app)                     |
   | `minSeverity`         | severidad mínima de notificación de la cámara (gating de alerta)   |
   | `expect.violation`    | **ground truth**: ¿hubo realmente una violación?                   |
   | `expect.minSeverity`  | (opcional) severidad mínima que debería asignar el modelo          |

## Banderas del runner

| bandera             | por defecto              | descripción                                            |
| ------------------- | ------------------------ | ------------------------------------------------------ |
| `--manifest <ruta>` | —                        | manifiesto de casos (obligatorio)                      |
| `--mock`            | off                      | no llama a la IA; usa el campo `mock` de cada caso     |
| `--out <ruta>`      | `validation/report.json` | dónde escribir el informe JSON                         |
| `--concurrency <n>` | `4`                      | casos en paralelo (modo real)                          |
| `--min-recall`      | `0.8`                    | umbral de recall para el código de salida              |
| `--min-precision`   | `0.7`                    | umbral de precisión                                    |
| `--max-fpr`         | `0.15`                   | tasa máxima de falsos positivos                        |

El runner termina con **código 1** si no se alcanzan los umbrales (apto para CI),
y escribe un informe JSON completo (por caso + agregados) en `--out`.

## Ajustar el detector tras validar

Si el recall es bajo (se escapan violaciones): baja `minConfidence` de las reglas,
reformula las reglas en lenguaje más explícito, o sube `framesPerAnalysis` para dar
más contexto temporal. Si la precisión es baja (muchas falsas alarmas): sube
`minConfidence`/`minSeverity`, afina el pre-filtro de movimiento, o prueba un modelo
más capaz vía `DETECTION_MODEL`. Re-ejecuta la validación tras cada cambio para
comparar.

## Tests del harness

La lógica de métricas es pura y está cubierta por tests (sin clave de API):

```bash
npm test     # node --test validation/metrics.test.mjs
```
