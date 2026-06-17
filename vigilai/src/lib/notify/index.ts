import type { Camera, DetectionEvent, NotificationChannel } from "../types";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { sendPush } from "./push";

export type { SendResult } from "./email";

/**
 * Despacha una alerta por todos los canales configurados en la cámara.
 * Devuelve el resultado por canal para registrarlo en el evento.
 */
export async function dispatchAlert(
  camera: Camera,
  result: {
    ruleViolated: string;
    severity: string;
    confidence: number;
    description: string;
  },
): Promise<DetectionEvent["notified"]> {
  const subject = `🚨 Alerta de seguridad — ${camera.name}`;
  const body =
    `Cámara: ${camera.name} (${camera.location})\n` +
    `Regla: ${result.ruleViolated}\n` +
    `Gravedad: ${result.severity} · Confianza: ${result.confidence}%\n` +
    `Detalle: ${result.description}\n` +
    `Hora: ${new Date().toLocaleString()}`;

  const channels = camera.notifications.channels;
  const out: DetectionEvent["notified"] = [];

  const tasks: Promise<void>[] = [];

  const run = (channel: NotificationChannel, p: Promise<{ ok: boolean; detail: string }>) =>
    tasks.push(
      p.then((r) => {
        out.push({ channel, ok: r.ok, detail: r.detail });
      }),
    );

  if (channels.includes("email") && camera.notifications.email) {
    run("email", sendEmail(camera.notifications.email, subject, body));
  }
  if (channels.includes("sms") && camera.notifications.phone) {
    run("sms", sendSms(camera.notifications.phone, `${subject}\n${body}`));
  }
  if (channels.includes("push")) {
    run("push", sendPush(subject, `${result.ruleViolated} — ${result.description}`));
  }

  await Promise.all(tasks);
  return out;
}
