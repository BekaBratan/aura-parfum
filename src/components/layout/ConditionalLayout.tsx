"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/auth");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <Navbar />
      <main className="site-main">{children}</main>
      <Footer />
    </>
  );
}
