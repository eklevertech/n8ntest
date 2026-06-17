import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "VigilAI — Videovigilancia inteligente",
  description:
    "Detecta robos y violaciones de reglas en cámaras de seguridad en vivo con IA y recibe alertas por SMS, email y push.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-dot" /> VigilAI
          </Link>
          <nav>
            <Link href="/">Panel</Link>
            <Link href="/cameras/new">+ Cámara</Link>
            <Link href="/events">Eventos</Link>
            <Link href="/pricing">Planes</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          VigilAI · prototipo MVP · análisis por IA con Claude vision
        </footer>
      </body>
    </html>
  );
}
