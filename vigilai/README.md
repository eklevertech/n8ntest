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
- **Autenticación y multi-tenant:** registro/login con email + contraseña
  (hash `scrypt`, sin dependencias nativas) y sesiones por cookie httpOnly
  respaldadas en el store (`src/lib/auth.ts`). Cada usuario pertenece a una
  **cuenta/organización**; todas las cámaras, eventos, plan y cuota se scopean por
  la cuenta de la sesión, y cada acceso a una cámara verifica la propiedad. El
  login y el registro tienen **rate-limiting** por IP (`src/lib/rate-limit.ts`).
- **Suscripciones/planes:** `src/lib/plans.ts` define los tiers (Free/Pro/Business)
  con límites de cámaras y de frames/mes, aplicados en las rutas de la API.
- **Persistencia:** `src/lib/store/` tiene dos backends tras una misma interfaz
  (`Repo`): **Postgres** (`pg.ts`) si defines `DATABASE_URL`, o un **almacén JSON**
  local (`json.ts`) en caso contrario. El esquema Postgres se gestiona con
  **migraciones** (`db/migrations/*.sql`), aplicadas automáticamente en el primer
  uso y también con `npm run migrate` (registradas en `schema_migrations`, con
  advisory lock para evitar carreras entre instancias).

## Arranque rápido

```bash
cd vigilai
npm install
cp .env.example .env.local      # añade tu ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3000
```

Crea una cuenta en **/signup** (elige cualquier plan, no hay cobro), entra al
panel, crea una cámara con sus reglas y pulsa **Iniciar monitoreo** (usa la webcam
o pega la URL de un MP4/HLS).

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
- **Base de datos:** soporte Postgres con migraciones versionadas ya incluido
  (`DATABASE_URL`, `npm run migrate`). Si el esquema crece mucho, valorar un gestor
  dedicado (Prisma, node-pg-migrate) y migraciones con *down*/rollback.
- **Autenticación y multi-tenant:** ya incluido (email+contraseña con `scrypt`,
  sesiones por cookie, aislamiento por organización, rate-limiting de login/registro).
  Backlog de endurecimiento: verificación de email, recuperación de contraseña,
  varios usuarios por organización con roles/permisos, y SSO/IdP (Auth.js) para
  empresa. El rate-limiting es en memoria: para multi-instancia, respaldarlo en Redis.
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
    auth.ts             Hash de contraseñas (scrypt) + sesiones por cookie
    require-auth.ts     Guard de páginas (redirige a /login)
    rate-limit.ts       Rate limiter en memoria (login/registro)
    detection.ts        Llamada a Claude (visión + forced tool use)
    notify/             Adaptadores email / sms / push + dispatcher
    plans.ts            Planes de suscripción y límites
    store/              Persistencia: interfaz Repo + backends JSON/Postgres + migrate
    types.ts
  app/
    login/ signup/      Autenticación
    api/auth/           Rutas signup / login / logout
db/migrations/          Migraciones SQL (fuente de verdad del esquema)
scripts/migrate.mjs     Runner de migraciones (npm run migrate)
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
