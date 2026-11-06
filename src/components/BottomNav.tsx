"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const path = usePathname();
  const onHome = path === "/";
  const onPanel = path.startsWith("/painel");

  // Telas com botão fixo embaixo (cadastro e pagamento) ficam sem a barra, para o botão não ser coberto.
  if (path.startsWith("/nova") || path.startsWith("/pagar")) return null;

  return (
    <nav className="nav" aria-label="Navegação principal">
      <div className="nav-inner">
        <Link href="/" className={`tab ${onHome ? "on" : ""}`} aria-current={onHome ? "page" : undefined}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
          </svg>
          <span>Início</span>
        </Link>
        <Link href="/nova" className="fab" aria-label="Nova despesa">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
        <Link href="/painel" className={`tab ${onPanel ? "on" : ""}`} aria-current={onPanel ? "page" : undefined}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 20V10M12 20V4M19 20v-7" />
          </svg>
          <span>Painel</span>
        </Link>
      </div>
    </nav>
  );
}
