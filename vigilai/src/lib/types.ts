export type PlanId = "free" | "pro" | "business";

export type Severity = "none" | "low" | "medium" | "high" | "critical";

export type NotificationChannel = "email" | "sms" | "push";

/** Una regla de vigilancia en lenguaje natural que la IA evalúa contra cada frame. */
export interface Rule {
  id: string;
  /** Texto en lenguaje natural, p.ej. "Avisar si alguien toma mercancía y sale sin pagar". */
  description: string;
  /** Umbral mínimo de confianza (0-100) para disparar una notificación. */
  minConfidence: number;
  enabled: boolean;
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  /** Destino del email. */
  email?: string;
  /** Número en formato E.164, p.ej. +14155550123. */
  phone?: string;
  /** Severidad mínima para notificar. */
  minSeverity: Severity;
}

export interface Camera {
  id: string;
  accountId: string;
  name: string;
  location: string;
  rules: Rule[];
  notifications: NotificationConfig;
  /** Cada cuántos segundos el navegador ejecuta un ciclo de análisis. */
  captureIntervalSec: number;
  /** Nº de fotogramas que se capturan por ciclo y se analizan juntos (contexto temporal). */
  framesPerAnalysis: number;
  /** Separación en milisegundos entre fotogramas de la misma secuencia. */
  frameSpacingMs: number;
  createdAt: string;
}

export interface DetectionEvent {
  id: string;
  accountId: string;
  cameraId: string;
  cameraName: string;
  createdAt: string;
  violationDetected: boolean;
  ruleViolated: string;
  severity: Severity;
  confidence: number;
  description: string;
  /** data URL del frame (jpeg base64) que disparó el evento; solo se guarda en violaciones. */
  snapshot?: string;
  /** Resultado del envío por cada canal. */
  notified: { channel: NotificationChannel; ok: boolean; detail: string }[];
}

export interface Account {
  id: string;
  name: string;
  plan: PlanId;
  /** Contador de frames analizados en el periodo actual (para límites del plan). */
  framesAnalyzedThisMonth: number;
  periodStart: string;
}
