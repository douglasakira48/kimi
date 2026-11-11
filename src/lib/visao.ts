import { cookies } from "next/headers";
import type { Lookups } from "@/lib/data";
import type { Bill } from "@/lib/types";

/** "casal" = tudo; "casa" = sem dono; ou o user_id de um membro. */
export type Visao = string;

export async function getVisao(lk: Lookups): Promise<Visao> {
  const v = (await cookies()).get("visao")?.value;
  if (v === "casa") return "casa";
  if (v && lk.members.some((m) => m.user_id === v)) return v;
  return "casal";
}

/** Dono de uma conta: o dono da despesa; se não tiver, o dono do cartão; senão, a casa (null). */
export function billOwner(expenseId: string, lk: Lookups): string | null {
  const e = lk.expenses.get(expenseId);
  if (!e) return null;
  if (e.owner_user_id) return e.owner_user_id;
  if (e.card_id) return lk.cards.get(e.card_id)?.owner_user_id ?? null;
  return null;
}

export function inVisao(expenseId: string, lk: Lookups, visao: Visao): boolean {
  if (visao === "casal") return true;
  const o = billOwner(expenseId, lk);
  return visao === "casa" ? o === null : o === visao;
}

export function filterBills<T extends Pick<Bill, "expense_id">>(bills: T[], lk: Lookups, visao: Visao): T[] {
  return visao === "casal" ? bills : bills.filter((b) => inVisao(b.expense_id, lk, visao));
}
