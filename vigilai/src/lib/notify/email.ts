export interface SendResult {
  ok: boolean;
  detail: string;
}

/**
 * Envío de email vía Resend (https://resend.com) usando su API HTTP.
 * Si no hay RESEND_API_KEY configurada, funciona en modo simulación.
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "VigilAI <alerts@vigilai.example>";

  if (!apiKey) {
    console.log(`[email:sim] -> ${to} | ${subject}\n${body}`);
    return { ok: true, detail: "simulado (sin RESEND_API_KEY)" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, detail: `Resend ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, detail: "enviado vía Resend" };
  } catch (err) {
    return { ok: false, detail: `error de red: ${(err as Error).message}` };
  }
}
