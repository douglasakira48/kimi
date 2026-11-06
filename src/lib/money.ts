/** Converte texto em reais ("2.500,00", "241,7", "96.4") para número. Retorna null se não entender. */
export function parseBRL(input: string): number | null {
  let s = String(input ?? "").trim().replace(/R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return null;
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // O último separador é o decimal; o outro é de milhar.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  } else if (lastDot >= 0) {
    // "2.500" é milhar; "96.4" e "96.40" são decimais.
    const decimals = s.length - lastDot - 1;
    if (decimals === 3 && s.indexOf(".") === lastDot) s = s.replace(".", "");
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(n: number): string {
  // O Intl usa espaço não separável depois de R$; trocamos por espaço comum.
  return brl.format(n).replace(/ /g, " ");
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Divide o total em parcelas em centavos; a última absorve a diferença. */
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] += cents - base * n;
  return parts.map((c) => c / 100);
}
