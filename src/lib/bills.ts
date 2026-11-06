import { cardDueDate, dayInMonth, nthBusinessDay, parseYMD, shiftMonth, type YMD } from "./dates";
import { splitInstallments } from "./money";

export interface ExpenseRule {
  recurrence: "once" | "monthly" | "installment";
  payment_method: "pix" | "boleto" | "card" | "debit" | "cash";
  day_of_month: number | null;
  business_day: number | null;
  first_due_date: YMD;
  installments: number | null;
  amount: number | null;
  total_amount: number | null;
  is_variable: boolean;
}

export interface CardRule {
  closing_day: number;
  due_day: number;
}

export interface NewBill {
  due_date: YMD;
  amount: number | null;
  installment_no: number | null;
}

/** Vencimento de uma ocorrência mensal (dia fixo, n-ésimo dia útil ou fatura do cartão). */
function monthlyOccurrence(rule: ExpenseRule, card: CardRule | null, y: number, m: number): YMD {
  if (rule.business_day) return nthBusinessDay(y, m, rule.business_day);
  const charge = dayInMonth(y, m, rule.day_of_month ?? 1);
  return rule.payment_method === "card" && card ? cardDueDate(charge, card.closing_day, card.due_day) : charge;
}

/**
 * Lista os lançamentos de uma despesa até a data limite.
 * Para despesas mensais, chamar de novo com um limite maior só acrescenta o que falta
 * (a tabela ignora vencimentos repetidos).
 */
export function generateBills(rule: ExpenseRule, card: CardRule | null, horizon: YMD): NewBill[] {
  const fixedAmount = rule.is_variable ? null : rule.amount;

  if (rule.recurrence === "once") {
    return [{ due_date: rule.first_due_date, amount: fixedAmount, installment_no: null }];
  }

  if (rule.recurrence === "installment") {
    const n = rule.installments ?? 1;
    const total = rule.total_amount ?? 0;
    const parts = splitInstallments(total, n);
    const first = parseYMD(rule.first_due_date);
    const dueDay = card?.due_day ?? first.d;
    return parts.map((amount, i) => {
      const ym = shiftMonth(first.y, first.m, i);
      return { due_date: dayInMonth(ym.y, ym.m, dueDay), amount, installment_no: i + 1 };
    });
  }

  const out: NewBill[] = [];
  const base = parseYMD(rule.first_due_date);
  for (let k = -1; k < 240; k++) {
    const ym = shiftMonth(base.y, base.m, k);
    const due = monthlyOccurrence(rule, card, ym.y, ym.m);
    if (due < rule.first_due_date) continue;
    if (due > horizon) break;
    out.push({ due_date: due, amount: fixedAmount, installment_no: null });
  }
  return out;
}

/** Primeiro vencimento de uma despesa mensal a partir de hoje (ou de uma data escolhida). */
export function firstMonthlyDue(
  rule: Omit<ExpenseRule, "first_due_date">,
  card: CardRule | null,
  from: YMD,
): YMD {
  const base = parseYMD(from);
  const probe = { ...rule, first_due_date: "0000-01-01" } as ExpenseRule;
  for (let k = -1; k < 14; k++) {
    const ym = shiftMonth(base.y, base.m, k);
    const due = monthlyOccurrence(probe, card, ym.y, ym.m);
    if (due >= from) return due;
  }
  return from;
}
