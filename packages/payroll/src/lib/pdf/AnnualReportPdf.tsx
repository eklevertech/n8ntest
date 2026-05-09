import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { maskSsn } from '@/lib/tax/puertoRico';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 16 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6 },
  small: { color: '#555' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  box: {
    borderWidth: 1,
    borderColor: '#999',
    padding: 8,
    marginBottom: 8,
  },
  disclaimer: { marginTop: 22, fontSize: 8, color: '#777', fontStyle: 'italic' },
});

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export interface AnnualPdfProps {
  kind: 'W2PR' | 'FORM_1099';
  year: number;
  company: { name: string; ein: string; address: string };
  employee: {
    name: string;
    ssn: string;
    employeeNumber: string;
    address: string;
  };
  totals: {
    grossWages: number;
    prIncomeTax: number;
    socialSecurityWages: number;
    socialSecurityTax: number;
    medicareWages: number;
    medicareTax: number;
  };
}

export function AnnualReportPdf(props: AnnualPdfProps) {
  const { kind, year, company, employee, totals } = props;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>
          {kind === 'W2PR' ? 'Modelo W-2PR (Mock)' : 'Modelo 1099 (Mock)'}
        </Text>
        <Text style={styles.subtitle}>Año contributivo {year}</Text>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Patrono</Text>
          <Text>{company.name}</Text>
          <Text style={styles.small}>EIN: {company.ein}</Text>
          <Text style={styles.small}>{company.address}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>{kind === 'FORM_1099' ? 'Beneficiario' : 'Empleado'}</Text>
          <Text>{employee.name}</Text>
          <Text style={styles.small}>Núm: {employee.employeeNumber}</Text>
          <Text style={styles.small}>SSN: {maskSsn(employee.ssn)}</Text>
          <Text style={styles.small}>{employee.address}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen anual</Text>
          {kind === 'W2PR' ? (
            <>
              <Row label="1. Total ingresos brutos" amount={totals.grossWages} />
              <Row label="2. Contribución sobre salarios retenida" amount={totals.prIncomeTax} />
              <Row label="3. Salarios Social Security" amount={totals.socialSecurityWages} />
              <Row label="4. Impuesto Social Security" amount={totals.socialSecurityTax} />
              <Row label="5. Salarios Medicare" amount={totals.medicareWages} />
              <Row label="6. Impuesto Medicare" amount={totals.medicareTax} />
            </>
          ) : (
            <>
              <Row label="Total pagado al contratista" amount={totals.grossWages} />
              <Row label="Retención (no aplica para 1099)" amount={0} />
            </>
          )}
        </View>

        <Text style={styles.disclaimer}>
          Este documento es un MODELO SIMPLIFICADO con fines demostrativos. No es un W-2PR
          ni un 1099 oficial del Departamento de Hacienda de Puerto Rico. Para presentación
          oficial usa los formularios y portales de Hacienda PR.
        </Text>
      </Page>
    </Document>
  );
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={styles.row}>
      <Text>{label}</Text>
      <Text>{fmt(amount)}</Text>
    </View>
  );
}
