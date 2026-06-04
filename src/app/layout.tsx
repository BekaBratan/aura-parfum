import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import CurrencyLoader from "@/components/layout/CurrencyLoader";
import CountryLoader from "@/components/layout/CountryLoader";
import ConditionalLayout from "@/components/layout/ConditionalLayout";

export const metadata: Metadata = {
  title: {
    default: "AZ-ZAHRA — Роскошные ароматы",
    template: "%s | AZ-ZAHRA",
  },
  description:
    "Откройте мир изысканных ароматов в AZ-ZAHRA. Оригинальная парфюмерия от ведущих мировых брендов с доставкой по Казахстану.",
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
        <CurrencyLoader />
        <CountryLoader />
        <ConditionalLayout>{children}</ConditionalLayout>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1f1f1f",
              color: "#f0ece4",
              border: "1px solid rgba(201,169,110,0.3)",
              fontFamily: "Manrope, Inter, system-ui, sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
