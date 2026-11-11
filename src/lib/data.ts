import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYMENT_LABEL, type Bill, type Card, type Category, type Expense, type Member } from "./types";

/** Postgres devolve numeric como texto em alguns casos; garante número. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toBill(r: Record<string, unknown>): Bill {
  return {
    id: r.id as string,
    household_id: r.household_id as string,
    expense_id: r.expense_id as string,
    due_date: r.due_date as string,
    amount: num(r.amount),
    interest: num(r.interest) ?? 0,
    status: r.status as Bill["status"],
    paid_on: (r.paid_on as string | null) ?? null,
    installment_no: num(r.installment_no),
    is_estimate: (r.is_estimate as boolean | undefined) ?? false,
  };
}

export function toExpense(r: Record<string, unknown>): Expense {
  return {
    id: r.id as string,
    name: r.name as string,
    amount: num(r.amount),
    total_amount: num(r.total_amount),
    is_variable: r.is_variable as boolean,
    category_id: (r.category_id as string | null) ?? null,
    payment_method: r.payment_method as Expense["payment_method"],
    card_id: (r.card_id as string | null) ?? null,
    recurrence: r.recurrence as Expense["recurrence"],
    day_of_month: num(r.day_of_month),
    business_day: num(r.business_day),
    first_due_date: r.first_due_date as string,
    installments: num(r.installments),
    active: r.active as boolean,
    owner_user_id: (r.owner_user_id as string | null | undefined) ?? null,
  };
}

export interface Lookups {
  expenses: Map<string, Expense>;
  cards: Map<string, Card>;
  categories: Map<string, Category>;
  members: { user_id: string; display_name: string }[];
}

/** Despesas, cartões e categorias da casa, indexados por id (são poucos registros). */
export async function loadLookups(sb: SupabaseClient): Promise<Lookups> {
  const [e, c, k, mm] = await Promise.all([
    sb.from("expenses").select("*"),
    sb.from("cards").select("id,name,closing_day,due_day,kind,owner_user_id").order("created_at"),
    sb.from("categories").select("id,name").order("name"),
    sb.from("members").select("user_id,display_name").order("display_name"),
  ]);
  return {
    expenses: new Map((e.data ?? []).map((r) => [r.id as string, toExpense(r)])),
    cards: new Map((c.data ?? []).map((r) => [r.id as string, r as Card])),
    categories: new Map((k.data ?? []).map((r) => [r.id as string, r as Category])),
    members: (mm.data ?? []) as { user_id: string; display_name: string }[],
  };
}

export async function getMember(sb: SupabaseClient): Promise<Member | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("members")
    .select("user_id,household_id,display_name,telegram_chat_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as Member | null) ?? null;
}

export function paymentLabel(e: Expense, cards: Map<string, Card>): string {
  if (e.payment_method === "card") return (e.card_id && cards.get(e.card_id)?.name) || PAYMENT_LABEL.card;
  if (e.payment_method === "debit" && e.card_id) {
    const name = cards.get(e.card_id)?.name;
    if (name) return `Débito ${name}`;
  }
  return PAYMENT_LABEL[e.payment_method];
}
