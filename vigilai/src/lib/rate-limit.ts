/**
 * Rate limiter en memoria (ventana fija). Suficiente para un piloto de una sola
 * instancia. Para producción multi-instancia, respaldar con un backend compartido
 * (p.ej. Redis) manteniendo esta misma interfaz.
 */
interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

export interface RateResult {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateResult {
  const now = Date.now();
  let e = buckets.get(key);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + windowMs };
    buckets.set(key, e);
  }
  e.count += 1;

  // Limpieza perezosa para no crecer sin límite.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  return {
    allowed: e.count <= max,
    retryAfterSec: Math.max(1, Math.ceil((e.resetAt - now) / 1000)),
    remaining: Math.max(0, max - e.count),
  };
}

/** IP del cliente a partir de las cabeceras de proxy habituales. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
