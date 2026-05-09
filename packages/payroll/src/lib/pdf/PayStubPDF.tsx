import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Decimal } from "@prisma/client/runtime/library";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 700 },
  small: { color: "#64748b", fontSize: 9 },
  section: { marginBottom: 12, paddingBottom: 8, borderBottom: "1pt solid #e2e8f0" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  bold: { fontWeight: 700 },
  twoCol: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  tableRow: { flexDirection: "row", borderBottom: "1pt solid #e2e8f0", paddingVertical: 3 },
  th: { fontWeight: 700, fontSize: 9, color: "#475569" },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: "right" as const },
  net: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 14,
  },
});

type N = Decimal | number | string | null | undefined;
const num = (v: N): number => (v == null ? 0 : typeof v === "number" ? v : Number(v.toString()));
const usd = (v: N) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num(v));

export type PayStubData = {
  company: { name: string; ein: string; address: string };
  employee: {
    employeeNumber: string;
    name: string;
    address: string;
    ssnMasked: string;
  };
  period: { start: string; end: string; payDate: string };
  earnings: {
    regularHours: N;
    overtimeHours: N;
    regularPay: N;
    overtimePay: N;
    bonusPay: N;
    commissionPay: N;
    reimbursements: N;
    grossPay: N;
  };
  deductions: {
    prIncomeTax: N;
    socialSecurity: N;
    medicare: N;
    sinotEmployee: N;
    extraWithheld: N;
    totalDeductions: N;
  };
  ytd: {
    gross: N;
    net: N;
    prIncomeTax: N;
    socialSecurity: N;
    medicare: N;
  };
  netPay: N;
};

export function PayStubPDF({ data }: { data: PayStubData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Pay Stub</Text>
            <Text style={styles.small}>Recibo de pago</Text>
          </View>
          <View>
            <Text style={styles.bold}>{data.company.name}</Text>
            <Text style={styles.small}>EIN: {data.company.ein}</Text>
            <Text style={styles.small}>{data.company.address}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.bold}>Empleado</Text>
              <Text>{data.employee.name}</Text>
              <Text style={styles.small}>#{data.employee.employeeNumber} · SSN {data.employee.ssnMasked}</Text>
              <Text style={styles.small}>{data.employee.address}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.bold}>Período</Text>
              <Text>{data.period.start} – {data.period.end}</Text>
              <Text style={styles.small}>Fecha de pago: {data.period.payDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>Ingresos</Text>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.th]}>Concepto</Text>
            <Text style={[styles.cellRight, styles.th]}>Horas</Text>
            <Text style={[styles.cellRight, styles.th]}>Monto</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Regular</Text>
            <Text style={styles.cellRight}>{num(data.earnings.regularHours).toFixed(2)}</Text>
            <Text style={styles.cellRight}>{usd(data.earnings.regularPay)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Overtime (1.5x)</Text>
            <Text style={styles.cellRight}>{num(data.earnings.overtimeHours).toFixed(2)}</Text>
            <Text style={styles.cellRight}>{usd(data.earnings.overtimePay)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Bono</Text>
            <Text style={styles.cellRight}>—</Text>
            <Text style={styles.cellRight}>{usd(data.earnings.bonusPay)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Comisión</Text>
            <Text style={styles.cellRight}>—</Text>
            <Text style={styles.cellRight}>{usd(data.earnings.commissionPay)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cell}>Reembolsos</Text>
            <Text style={styles.cellRight}>—</Text>
            <Text style={styles.cellRight}>{usd(data.earnings.reimbursements)}</Text>
          </View>
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.cell, styles.bold]}>Gross pay</Text>
            <Text style={styles.cellRight} />
            <Text style={[styles.cellRight, styles.bold]}>{usd(data.earnings.grossPay)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>Deducciones</Text>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.th]}>Concepto</Text>
            <Text style={[styles.cellRight, styles.th]}>Monto</Text>
          </View>
          <Row label="PR Income Tax (Hacienda)" v={data.deductions.prIncomeTax} />
          <Row label="Social Security (6.2%)" v={data.deductions.socialSecurity} />
          <Row label="Medicare (1.45%)" v={data.deductions.medicare} />
          <Row label="SINOT" v={data.deductions.sinotEmployee} />
          <Row label="Retención adicional" v={data.deductions.extraWithheld} />
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.cell, styles.bold]}>Total deducciones</Text>
            <Text style={[styles.cellRight, styles.bold]}>{usd(data.deductions.totalDeductions)}</Text>
          </View>
        </View>

        <View style={styles.net}>
          <Text>NET PAY</Text>
          <Text>{usd(data.netPay)}</Text>
        </View>

        <View style={[styles.section, { marginTop: 12 }]}>
          <Text style={styles.bold}>YTD (year-to-date)</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.small}>Gross: {usd(data.ytd.gross)}</Text>
              <Text style={styles.small}>Net: {usd(data.ytd.net)}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.small}>PR Income Tax: {usd(data.ytd.prIncomeTax)}</Text>
              <Text style={styles.small}>Social Security: {usd(data.ytd.socialSecurity)}</Text>
              <Text style={styles.small}>Medicare: {usd(data.ytd.medicare)}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.small, { marginTop: 16 }]}>
          Generado por Payroll PR. Modelo simplificado de retención (no es asesoría fiscal).
        </Text>
      </Page>
    </Document>
  );
}

function Row({ label, v }: { label: string; v: N }) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.cell}>{label}</Text>
      <Text style={styles.cellRight}>{usd(v)}</Text>
    </View>
  );
}
