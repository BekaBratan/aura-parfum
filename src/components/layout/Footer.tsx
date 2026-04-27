import Link from "next/link";

export default function Footer() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : "#";

  return (
    <footer className="site-footer section-soft">
      <div className="site-container">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <h3>AURA Parfum</h3>
            <p>
              Мир изысканных ароматов. Оригинальная парфюмерия от ведущих
              мировых брендов с доставкой по Казахстану.
            </p>
          </div>

          <div>
            <h4>Навигация</h4>
            <ul className="site-footer-list">
              <li><Link href="/">Главная</Link></li>
              <li><Link href="/catalog">Каталог</Link></li>
              <li><Link href="/cart">Корзина</Link></li>
            </ul>
          </div>

          <div>
            <h4>Контакты</h4>
            <ul className="site-footer-list">
              <li>{whatsappNumber || "WhatsApp"}</li>
              <li>Казахстан</li>
              <li>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  Написать в WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="site-footer-copy">
          © {new Date().getFullYear()} Aura Parfum. Все права защищены.
        </p>
      </div>
    </footer>
  );
}
