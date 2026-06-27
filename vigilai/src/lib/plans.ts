import type { PlanId } from "./types";

export interface Plan {
  id: PlanId;
  name: string;
  priceUsdMonthly: number;
  maxCameras: number;
  /** Frames analizados incluidos por mes. */
  maxFramesPerMonth: number;
  channels: ("email" | "sms" | "push")[];
  blurb: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceUsdMonthly: 0,
    maxCameras: 1,
    maxFramesPerMonth: 1_000,
    channels: ["email", "push"],
    blurb: "1 cámara, alertas por email y push. Ideal para probar.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsdMonthly: 49,
    maxCameras: 5,
    maxFramesPerMonth: 50_000,
    channels: ["email", "push", "sms"],
    blurb: "Hasta 5 cámaras, alertas por SMS, email y push.",
  },
  business: {
    id: "business",
    name: "Business",
    priceUsdMonthly: 199,
    maxCameras: 50,
    maxFramesPerMonth: 1_000_000,
    channels: ["email", "push", "sms"],
    blurb: "Hasta 50 cámaras y mayor volumen de análisis.",
  },
};

export function planOf(id: PlanId): Plan {
  return PLANS[id] ?? PLANS.free;
}
