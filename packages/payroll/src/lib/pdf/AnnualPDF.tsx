import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Decimal } from "@prisma/client/runtime/library";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { borderBottom: "2pt solid #1d4ed8", paddingBottom: 8, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, color: "#1d4ed8" },
  subtitle: { fontSize: 11, color: "#475569", marginTop: 2 },
  section: { marginBottom: 14, padding: 10, border: "1pt solid #e2e8f0", borderRadius: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  bold: { fontWeight: 700 },
  twoCol: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  small: { fontSize: 9, color: "#64748b" },
  box: { padding: 6, backgroundColor: "#f1f5f9", marginTop: 4 },
});

type N = Decimal | number | string | null | undefined;
const num = (v: N): number => (v == null ? 0 : typeof v === "number" ? v : Number(v.toString()));
const usd = (v: N) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num(v));

export type AnnualData = {
  year: number;
  isContractor: boolean;
  company: { name: string; ein: string; address: string };
  employee: {
    name: string;
    employeeNumber: string;
    address: string;
    ssnMasked: string;
  };
  totals: {
    gross: number;
    prIncomeTax: number;
    socialSecurity: number;
    medicare: number;
    sinotEmployee: number;
    net: number;
  };
};

export function AnnualPDF({ data }: { data: AnnualData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {data.isContractor ? `Forma 1099 (mock) — ${data.year}` : `Forma W-2PR (mock) — ${data.year}`}
          </Text>
          <Text style={styles.subtitle}>
            Resumen anual generado por Payroll PR — no reemplaza la forma oficial.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.bold}>Patrono</Text>
              <Text>{data.company.name}</Text>
              <Text style={styles.small}>EIN: {data.company.ein}</Text>
              <Text style={styles.small}>{data.company.address}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.bold}>Recipiente</Text>
              <Text>{data.employee.name}</Text>
              <Text style={styles.small}>#{data.employee.employeeNumber} · SSN {data.employee.ssnMasked}</Text>
              <Text style={styles.small}>{data.employee.address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>Totales {data.year}</Text>
          <View style={styles.box}>
            <Row label="Salarios brutos (Box 1 / Box 7 1099)" v={data.totals.gross} />
            {!data.isContractor && (
              <>
                <Row label="Retención PR (Hacienda)" v={data.totals.prIncomeTax} />
                <Row label="Social Security" v={data.totals.socialSecurity} />
                <Row label="Medicare" v={data.totals.medicare} />
                <Row label="SINOT (empleado)" v={data.totals.sinotEmployee} />
              </>
            )}
            <View style={[styles.row, { marginTop: 6, paddingTop: 6, borderTop: "1pt solid #cbd5e1" }]}>
              <Text style={styles.bold}>Pago neto anual</Text>
              <Text style={styles.bold}>{usd(data.totals.net)}</Text>
            </View>
          </View>
        </View>

        {data.isContractor && (
          <Text style={styles.small}>
            Los contratistas (1099) son responsables de calcular y pagar sus propios impuestos. Este documento es solo
            informativo del total pagado.
          </Text>
        )}
      </Page>
    </Document>
  );
}

function Row({ label, v }: { label: string; v: N }) {
  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <Text>{usd(v)}</Text>
    </View>
  );
}
