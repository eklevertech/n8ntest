import { Decimal } from "@prisma/client/runtime/library";

export function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

export function fmtUSD(value: Decimal | number | null | undefined): string {
  const n = toNumber(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function fmtNumber(
  value: Decimal | number | null | undefined,
  decimals = 2,
): string {
  return toNumber(value).toFixed(decimals);
}
