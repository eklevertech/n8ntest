# VigilAI — Videovigilancia inteligente (MVP)

SaaS que inspecciona video de cámaras de seguridad **en vivo** y envía
notificaciones por **SMS, email y/o push** cuando la IA detecta una posible
violación de una regla (robo, intrusión, merodeo, etc.).

Este repositorio es un **MVP funcional end-to-end** construido como aplicación
nueva (Next.js + TypeScript), independiente del resto del repo.

## Cómo funciona

```
Navegador (webcam o URL de video)
   │  pre-filtro de movimiento (diff de cuadros en grises a baja resolución)
   │     └─ sin cambios → omite el ciclo (ahorra tokens)
   │  con cambios → captura una SECUENCIA de N fotogramas (ráfaga, JPEG base64)
   ▼
POST /api/cameras/:id/analyze  { frames: [...] }
   │  envía la secuencia a Claude (visión) junto con las reglas en lenguaje natural
   ▼
Veredicto estructurado { violación, regla, gravedad, confianza, descripción }
   │  si supera el umbral de gravedad y confianza…
   ▼
Despacho de alertas → Email (Resend) · SMS (Twilio) · Push (Web Push/VAPID)
   │
   ▼
Registro de eventos (panel + /events)
```

- **Detección por IA (multi-frame):** `src/lib/detection.ts` usa el SDK oficial de
  Anthropic con *forced tool use* (esquema fijo) y envía **varios fotogramas
  consecutivos** en orden cronológico para que el modelo razone sobre el movimiento
  y la acción, no sobre imágenes sueltas. Configurable por cámara
  (`framesPerAnalysis`, `frameSpacingMs`). Modelo por defecto `claude-opus-4-8`;
  configurable con `DETECTION_MODEL`.
- **Pre-filtro de movimiento:** `src/components/LiveMonitor.tsx` compara cada cuadro
  con el anterior (escala de grises a 96×54) y solo dispara la llamada a la IA cuando
  el % de píxeles que cambian supera `motionThreshold`. Evita gastar tokens en escenas
  estáticas. Configurable/desactivable por cámara; el panel muestra analizados vs. omitidos.
- **Notificaciones:** `src/lib/notify/*` — cada canal funciona con credenciales
  reales o en **modo simulación** (escribe en consola) si no las hay, para que el
  MVP corra sin cuentas de pago.
- **Suscripciones/planes:** `src/lib/plans.ts` define los tiers (Free/Pro/Business)
  con límites de cámaras y de frames/mes, aplicados en las rutas de la API.
- **Persistencia:** `src/lib/store.ts` usa un archivo JSON (`data/db.json`) para que
  el prototipo arranque sin base de datos. Ver "Producción" abajo.

## Arranque rápido

```bash
cd vigilai
npm install
cp .env.example .env.local      # añade tu ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000
```

Abre el panel, crea una cámara con sus reglas y pulsa **Iniciar monitoreo**
(usa la webcam o pega la URL de un MP4/HLS).

> Web Push y la webcam requieren un contexto seguro: `localhost` funciona; en otro
> host necesitas HTTPS.

### Activar los canales (opcional)

| Canal | Variables | Sin ellas |
|-------|-----------|-----------|
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | modo simulación |
| SMS   | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | modo simulación |
| Push  | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`) | modo simulación |

## Camino a producción (fuera del alcance de este MVP)

- **Ingesta real de cámaras IP:** sustituir la captura en navegador por un pipeline
  servidor con RTSP/ONVIF → `ffmpeg` → extracción de frames (o WebRTC/HLS).
- **Base de datos:** cambiar el almacén JSON por Postgres (p.ej. Prisma);
  la interfaz de `store.ts` ya aísla esa capa.
- **Autenticación y multi-tenant:** hoy hay una única cuenta demo; añadir login
  (Auth.js/Clerk) y aislamiento por organización.
- **Cobro:** integrar Stripe Billing (checkout + webhooks) para activar planes.
- **Coste/latencia de IA:** el pre-filtro de movimiento ya reserva la llamada al VLM
  para escenas con cambios. A mayor escala, considerar además `claude-haiku-4-5` /
  `claude-sonnet-4-6` vía `DETECTION_MODEL`, y mover el pre-filtro al servidor cuando
  la ingesta deje de ser en navegador.
- **Privacidad/legal:** retención de grabaciones, consentimiento y normativa local
  de videovigilancia.

## Estructura

```
src/
  lib/
    detection.ts        Llamada a Claude (visión + structured outputs)
    notify/             Adaptadores email / sms / push + dispatcher
    plans.ts            Planes de suscripción y límites
    store.ts            Persistencia (JSON; reemplazable por Postgres)
    types.ts
  app/
    page.tsx            Panel
    pricing/            Planes
    events/             Registro de eventos
    cameras/new/        Alta de cámara
    cameras/[id]/       Detalle + monitor en vivo
    api/                Rutas: cameras, analyze, events, push
  components/
    LiveMonitor.tsx     Captura de frames y análisis en el navegador
    SeverityPill.tsx
public/sw.js            Service worker de Web Push
```
