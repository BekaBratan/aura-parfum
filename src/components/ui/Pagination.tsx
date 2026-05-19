"use client";

import { useEffect, useState } from "react";

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  className?: string;
  variant?: "light" | "dark";
}

function getDelta(): number {
  if (typeof window === "undefined") return 1;
  const w = window.innerWidth;
  if (w >= 1280) return 3;
  if (w >= 768)  return 2;
  return 1;
}

function getPages(current: number, total: number, delta: number): (number | "...")[] {
  const threshold = 2 + delta * 2 + 2; // first + ... + window + ... + last
  if (total <= threshold) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  const start = Math.max(2, current - delta);
  const end   = Math.min(total - 1, current + delta);

  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");

  pages.push(total);
  return pages;
}

export default function Pagination({
  page,
  total,
  pageSize,
  onChange,
  className = "",
  variant = "light",
}: PaginationProps) {
  const [delta, setDelta] = useState(1);

  useEffect(() => {
    const update = () => setDelta(getDelta());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages = getPages(page, totalPages, delta);

  const btnBase    = variant === "dark" ? "pagination-btn pagination-btn--dark" : "pagination-btn pagination-btn--light";
  const btnActive  = "pagination-btn--active";
  const btnInactive = "";
  const btnNav     = `${btnBase} pagination-btn--nav`;

  return (
    <div className={`pagination-root ${className}`}>
      {/* Prev */}
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className={btnNav}
        aria-label="Предыдущая страница"
      >
        ‹
      </button>

      {/* Pages */}
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="pagination-dots">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className={btnNav}
        aria-label="Следующая страница"
      >
        ›
      </button>

      {/* Counter */}
      <span className="pagination-counter">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} из {total}
      </span>
    </div>
  );
}
