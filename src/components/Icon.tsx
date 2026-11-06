import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  logo: <><path d="M2.5 11.5L12 3l9.5 8.5" /><path d="M5 10v10.5h14V10" /><path d="M15 13.6c0-1-1-1.6-3-1.6s-3 .7-3 1.7c0 2.2 6 1.1 6 3.4 0 1-1.1 1.7-3 1.7s-3-.7-3-1.7" /><path d="M12 11v9" /></>,
  casa: <><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></>,
  comida: <><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M9 3v6" /><path d="M17 3c-2 1.5-3 4-3 7h3v11" /></>,
  lazer: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M8 5l2 4M14 5l2 4" /></>,
  saude: <><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></>,
  equip: <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 20h20" /></>,
  transporte: <><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v2H3zM7 13h.01M17 13h.01" /></>,
  outros: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
  pix: <><path d="M12 3l4.5 4.5L12 12 7.5 7.5zM12 12l4.5 4.5L12 21l-4.5-4.5zM3 12l3-3M21 12l-3-3M3 12l3 3M21 12l-3 3" /></>,
  boleto: <><path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14" /></>,
  cartao: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  debito: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M15 15h2" /></>,
  dinheiro: <><rect x="3" y="7" width="18" height="11" rx="2" /><circle cx="12" cy="12.5" r="2.5" /></>,
  grafico: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  usuario: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  cadeado: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

const CATEGORY_ICON: Record<string, string> = {
  "despesas fixas": "casa",
  alimentacao: "comida",
  lazer: "lazer",
  "saude e bem-estar": "saude",
  equipamentos: "equip",
  transporte: "transporte",
  outros: "outros",
};

export function categoryIconName(name?: string | null): string {
  if (!name) return "outros";
  const n = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return CATEGORY_ICON[n] ?? "outros";
}

export function paymentIconName(method: string): string {
  return ({ pix: "pix", boleto: "boleto", card: "cartao", debit: "debito", cash: "dinheiro" } as Record<string, string>)[method] ?? "cartao";
}

export default function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] ?? P.outros}
    </svg>
  );
}
