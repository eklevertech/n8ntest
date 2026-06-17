import type { Severity } from "@/lib/types";

const LABELS: Record<Severity, string> = {
  none: "ninguna",
  low: "baja",
  medium: "media",
  high: "alta",
  critical: "crítica",
};

export function SeverityPill({ severity }: { severity: Severity }) {
  return <span className={`pill sev-${severity}`}>{LABELS[severity]}</span>;
}
