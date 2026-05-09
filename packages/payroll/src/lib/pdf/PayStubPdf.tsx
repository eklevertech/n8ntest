import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { maskSsn } from '@/lib/tax/puertoRico';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  company: { fontSize: 14, fontWeight: 'bold' },
  small: { color: '#555' },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  table: { borderTopWidth: 1, borderTopColor: '#ddd', marginTop: 4 },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 3,
  },
  th: { flex: 1, fontWeight: 'bold', color: '#444' },
  td: { flex: 1 },
  right: { textAlign: 'right' },
  netBanner: {
    marginTop: 14,
    backgroundColor: '#1d4ed8',
    color: 'white',
    padding: 12,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  netLabel: { fontSize: 12, color: 'white' },
  netValue: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  ytd: {
    marginTop: 14,
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  },
  disclaimer: {
    marginTop: 16,
    fontSize: 8,
    color: '#777',
    fontStyle: 'italic',
  },
});

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Puerto_Rico',
  }).format(d);

export interface PayStubPdfProps {
  company: { name: string; ein: string; address: string };
  employee: {
    employeeNumber: string;
    name: string;
    ssn: string;
    address: string;
  };
  period: { startDate: Date; endDate: Date; payDate: Date };
  earnings: {
    regularHours: number;
    overtimeHours: number;
    regularPay: number;
    overtimePay: number;
    bonusPay: number;
    commissionPay: number;
    reimbursements: number;
    grossPay: number;
  };
  deductions: {
    prIncomeTax: number;
    socialSecurity: number;
    medicare: number;
    sinotEmployee: number;
    extraWithheld: number;
    totalDeductions: number;
  };
  netPay: number;
  ytd: {
    gross: number;
    net: number;
    prIncomeTax: number;
    socialSecurity: number;
    medicare: number;
  };
}

export function PayStubPdf(props: PayStubPdfProps) {
  const { company, employee, period, earnings, deductions, netPay, ytd } = props;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{company.name}</Text>
            <Text style={styles.small}>EIN: {company.ein}</Text>
            <Text style={styles.small}>{company.address}</Text>
          </View>
          <View>
            <Text style={[styles.company, { textAlign: 'right' }]}>RECIBO DE PAGO</Text>
            <Text style={[styles.small, { textAlign: 'right' }]}>
              Pago: {fmtDate(period.payDate)}
            </Text>
            <Text style={[styles.small, { textAlign: 'right' }]}>
              Período: {fmtDate(period.startDate)} – {fmtDate(period.endDate)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Empleado</Text>
          <Text>{employee.name}</Text>
          <Text style={styles.small}>Núm: {employee.employeeNumber}</Text>
          <Text style={styles.small}>SSN: {maskSsn(employee.ssn)}</Text>
          <Text style={styles.small}>{employee.address}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingresos</Text>
          <View style={styles.tableRow}>
            <Text style={styles.th}>Concepto</Text>
            <Text style={[styles.th, styles.right]}>Horas</Text>
            <Text style={[styles.th, styles.right]}>Monto</Text>
          </View>
          <Row label="Regular" qty={earnings.regularHours.toFixed(2)} amount={earnings.regularPay} />
          <Row
            label="Overtime (1.5×)"
            qty={earnings.overtimeHours.toFixed(2)}
            amount={earnings.overtimePay}
          />
          <Row label="Bono" amount={earnings.bonusPay} />
          <Row label="Comisión" amount={earnings.commissionPay} />
          <Row label="Reembolso" amount={earnings.reimbursements} />
          <View style={[styles.tableRow, { borderBottomWidth: 0, marginTop: 4 }]}>
            <Text style={[styles.th]}>GROSS</Text>
            <Text style={styles.td}> </Text>
            <Text style={[styles.th, styles.right]}>{fmt(earnings.grossPay)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deducciones</Text>
          <Row label="PR Income Tax" amount={deductions.prIncomeTax} />
          <Row label="Social Security (6.2%)" amount={deductions.socialSecurity} />
          <Row label="Medicare (1.45%+)" amount={deductions.medicare} />
          <Row label="SINOT (0.15%)" amount={deductions.sinotEmployee} />
          <Row label="Retención adicional" amount={deductions.extraWithheld} />
          <View style={[styles.tableRow, { borderBottomWidth: 0, marginTop: 4 }]}>
            <Text style={[styles.th]}>Total deducciones</Text>
            <Text style={styles.td}> </Text>
            <Text style={[styles.th, styles.right]}>{fmt(deductions.totalDeductions)}</Text>
          </View>
        </View>

        <View style={styles.netBanner}>
          <Text style={styles.netLabel}>NET PAY</Text>
          <Text style={styles.netValue}>{fmt(netPay)}</Text>
        </View>

        <View style={styles.ytd}>
          <Text style={styles.sectionTitle}>Año a la fecha (YTD)</Text>
          <View style={styles.row}>
            <Text>Gross</Text>
            <Text>{fmt(ytd.gross)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Net</Text>
            <Text>{fmt(ytd.net)}</Text>
          </View>
          <View style={styles.row}>
            <Text>PR Income Tax</Text>
            <Text>{fmt(ytd.prIncomeTax)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Social Security</Text>
            <Text>{fmt(ytd.socialSecurity)}</Text>
          </View>
          <View style={styles.row}>
            <Text>Medicare</Text>
            <Text>{fmt(ytd.medicare)}</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Este recibo se generó con un modelo simplificado de retención de Puerto Rico
          (año 2024). No sustituye los cálculos oficiales de Hacienda PR ni las
          obligaciones de depósitos federales/estatales. Verifica con tu contador.
        </Text>
      </Page>
    </Document>
  );
}

function Row({ label, qty, amount }: { label: string; qty?: string; amount: number }) {
  if (!amount && !qty) return null;
  return (
    <View style={styles.tableRow}>
      <Text style={styles.td}>{label}</Text>
      <Text style={[styles.td, styles.right]}>{qty ?? ''}</Text>
      <Text style={[styles.td, styles.right]}>{fmt(amount)}</Text>
    </View>
  );
}
