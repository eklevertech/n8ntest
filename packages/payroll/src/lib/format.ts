export function fmtCurrency(value: number | string | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return new Intl.NumberFormat('es-PR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('es-PR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Puerto_Rico',
  }).format(date);
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('es-PR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
  }).format(date);
}

export function toNumber(d: unknown): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'number') return d;
  if (typeof d === 'string') return Number(d);
  if (typeof d === 'object' && 'toNumber' in (d as object)) {
    return (d as { toNumber: () => number }).toNumber();
  }
  return Number(d);
}
