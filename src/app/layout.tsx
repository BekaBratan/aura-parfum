import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "Aura Parfum — Роскошные ароматы",
    template: "%s | Aura Parfum",
  },
  description:
    "Откройте мир изысканных ароматов в Aura Parfum. Оригинальная парфюмерия от ведущих мировых брендов с доставкой по Казахстану.",
  keywords: ["парфюм", "духи", "ароматы", "Казахстан", "купить духи"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="site-shell">
        <Navbar />
        <main className="site-main">{children}</main>
        <Footer />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1f1f1f",
              color: "#f0ece4",
              border: "1px solid rgba(201,169,110,0.3)",
              fontFamily: "Inter, sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
