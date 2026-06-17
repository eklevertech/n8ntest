import type { SendResult } from "./email";

/**
 * Envío de SMS vía Twilio usando su API HTTP.
 * Requiere TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER.
 * Sin credenciales funciona en modo simulación.
 */
export async function sendSms(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.log(`[sms:sim] -> ${to} | ${body}`);
    return { ok: true, detail: "simulado (sin credenciales Twilio)" };
  }

  try {
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, detail: `Twilio ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, detail: "enviado vía Twilio" };
  } catch (err) {
    return { ok: false, detail: `error de red: ${(err as Error).message}` };
  }
}
