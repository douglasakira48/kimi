import type { YMD } from "./dates";

export interface Member {
  user_id: string;
  household_id: string;
  display_name: string;
  telegram_chat_id: number | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface CategoryRule {
  id: string;
  keyword: string;
  category_id: string;
}

export interface Card {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  kind: "credit" | "debit";
  owner_user_id: string | null;
}

export interface Expense {
  id: string;
  name: string;
  amount: number | null;
  total_amount: number | null;
  is_variable: boolean;
  category_id: string | null;
  payment_method: "pix" | "boleto" | "card" | "debit" | "cash";
  card_id: string | null;
  recurrence: "once" | "monthly" | "installment";
  day_of_month: number | null;
  business_day: number | null;
  first_due_date: YMD;
  installments: number | null;
  active: boolean;
  owner_user_id: string | null;
}

export interface Bill {
  id: string;
  household_id: string;
  expense_id: string;
  due_date: YMD;
  amount: number | null;
  interest: number;
  status: "pending" | "paid";
  paid_on: YMD | null;
  installment_no: number | null;
  is_estimate: boolean;
}

export const PAYMENT_LABEL = {
  pix: "PIX",
  boleto: "Boleto",
  card: "Cartão",
  debit: "Débito",
  cash: "Dinheiro",
} as const;
