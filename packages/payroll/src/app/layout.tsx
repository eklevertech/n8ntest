import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Payroll PR",
  description: "Employee & payroll management for Puerto Rico",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
