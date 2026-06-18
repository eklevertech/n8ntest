import webpush from "web-push";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SendResult } from "./email";

/**
 * Web Push (notificaciones del navegador) vía protocolo VAPID.
 * Las suscripciones se guardan en data/push-subscriptions.json, asociadas a la
 * cuenta (tenant) para no enviar alertas de una organización a otra.
 *
 * Genera un par de claves VAPID con:  npx web-push generate-vapid-keys
 * y colócalas en VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 * Sin claves, funciona en modo simulación.
 */

const SUBS_FILE = path.join(process.cwd(), "data", "push-subscriptions.json");

type StoredSub = webpush.PushSubscription & { accountId: string };

let configured = false;

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function ensureConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    const subject = process.env.VAPID_SUBJECT || "mailto:alerts@vigilai.example";
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  }
  return true;
}

async function readSubs(): Promise<StoredSub[]> {
  try {
    return JSON.parse(await fs.readFile(SUBS_FILE, "utf8")) as StoredSub[];
  } catch {
    return [];
  }
}

async function writeSubs(subs: StoredSub[]): Promise<void> {
  await fs.mkdir(path.dirname(SUBS_FILE), { recursive: true });
  await fs.writeFile(SUBS_FILE, JSON.stringify(subs, null, 2), "utf8");
}

export async function saveSubscription(
  accountId: string,
  sub: webpush.PushSubscription,
): Promise<void> {
  const subs = await readSubs();
  if (!subs.some((s) => s.endpoint === sub.endpoint)) {
    subs.push({ ...sub, accountId });
    await writeSubs(subs);
  }
}

export async function sendPush(
  accountId: string,
  title: string,
  body: string,
): Promise<SendResult> {
  if (!ensureConfigured()) {
    console.log(`[push:sim] (${accountId}) ${title} | ${body}`);
    return { ok: true, detail: "simulado (sin claves VAPID)" };
  }

  const all = await readSubs();
  const subs = all.filter((s) => s.accountId === accountId);
  if (subs.length === 0) {
    return { ok: true, detail: "sin suscriptores push" };
  }

  const payload = JSON.stringify({ title, body });
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.endpoint);
      }
    }),
  );

  if (stale.length) {
    await writeSubs(all.filter((s) => !stale.includes(s.endpoint)));
  }

  return { ok: sent > 0, detail: `enviado a ${sent}/${subs.length} dispositivos` };
}
