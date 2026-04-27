import Link from "next/link";

export default function Footer() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : "#";

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--dark-2)]">
      <div className="page-container site-footer-inner">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_0.8fr_0.8fr] gap-8 md:gap-12 items-start">
          {/* Brand */}
          <div className="max-w-sm">
            <h3
              className="text-2xl font-bold text-gold-gradient mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              AURA Parfum
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Мир изысканных ароматов. Оригинальная парфюмерия от ведущих
              мировых брендов с доставкой по Казахстану.
            </p>
          </div>

          {/* Links */}
          <div className="md:justify-self-center">
            <h4 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-wider mb-4">
              Навигация
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
                >
                  Главная
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog"
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
                >
                  Каталог
                </Link>
              </li>
              <li>
                <Link
                  href="/cart"
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
                >
                  Корзина
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:justify-self-end md:text-right">
            <h4 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-wider mb-4">
              Контакты
            </h4>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li>📞 {whatsappNumber || "WhatsApp"}</li>
              <li>📍 Казахстан</li>
              <li>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--gold)] transition-colors"
                >
                  💬 WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
          <p className="text-xs text-[var(--text-secondary)]">
            © {new Date().getFullYear()} Aura Parfum. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
}
