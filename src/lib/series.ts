export interface SeriesBill {
  expense_id: string;
  due_date: string; // YYYY-MM-DD
  amount: number | null;
  interest: number;
  status: "pending" | "paid";
  is_estimate: boolean;
}

export interface MonthPoint {
  key: string; // YYYY-MM
  paid: number; // já pago (com juros)
  pending: number; // a pagar com valor confirmado
  estimate: number; // a pagar com valor estimado
}

export function monthKeys(startKey: string, count: number): string[] {
  const [y, m] = startKey.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const t = y * 12 + (m - 1) + i;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  });
}

/** Soma as contas por mês de vencimento, separando pago, a pagar e estimado. */
export function monthlyTotals(bills: SeriesBill[], keys: string[]): MonthPoint[] {
  const map = new Map<string, MonthPoint>(keys.map((k) => [k, { key: k, paid: 0, pending: 0, estimate: 0 }]));
  for (const b of bills) {
    const p = map.get(b.due_date.slice(0, 7));
    if (!p) continue;
    const v = b.amount ?? 0;
    if (b.status === "paid") p.paid += v + b.interest;
    else if (b.is_estimate) p.estimate += v;
    else p.pending += v;
  }
  return keys.map((k) => map.get(k)!);
}

export interface VariablePoint {
  key: string;
  amount: number;
  estimate: boolean;
}

/** Evolução mês a mês de uma despesa (a conta com valor, uma por mês). */
export function variableSeries(bills: SeriesBill[], expenseId: string, keys: string[]): VariablePoint[] {
  const out: VariablePoint[] = [];
  for (const k of keys) {
    const b = bills.find((x) => x.expense_id === expenseId && x.due_date.startsWith(k) && x.amount !== null);
    if (b) out.push({ key: k, amount: b.amount as number, estimate: b.status === "pending" && b.is_estimate });
  }
  return out;
}
