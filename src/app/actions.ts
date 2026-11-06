"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateBills, firstMonthlyDue, type ExpenseRule } from "@/lib/bills";
import { matchRule, normalize, suggestCategory } from "@/lib/categorize";
import { getMember } from "@/lib/data";
import { addDays, cardDueDate, todayInSP, type YMD } from "@/lib/dates";
import { parseBRL, round2, splitInstallments } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireMember() {
  const sb = await createClient();
  const member = await getMember(sb);
  if (!member) redirect("/onboarding");
  return { sb, member };
}

/* ---------- Entrada e casa ---------- */

export async function signInAction(formData: FormData) {
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({
    email: `${String(formData.get("user") ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@casa.local`,
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/login?erro=1");
  redirect("/");
}

export async function signOutAction() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/login");
}

export async function createHouseholdAction(formData: FormData) {
  const sb = await createClient();
  const { error } = await sb.rpc("create_household", {
    p_name: String(formData.get("name") ?? ""),
    p_display_name: String(formData.get("displayName") ?? ""),
  });
  if (error) redirect(`/onboarding?erro=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function joinHouseholdAction(formData: FormData) {
  const sb = await createClient();
  const { error } = await sb.rpc("join_household", {
    p_code: String(formData.get("code") ?? ""),
    p_display_name: String(formData.get("displayName") ?? ""),
  });
  if (error) redirect(`/onboarding?erro=${encodeURIComponent(error.message)}`);
  redirect("/");
}

/* ---------- Nova despesa ---------- */

export interface NewExpenseInput {
  name: string;
  amount: string;
  isVariable: boolean;
  categoryId: string | null;
  mode: "once" | "monthly" | "installment";
  payment: "pix" | "boleto" | "card" | "debit" | "cash";
  cardId: string | null;
  installments: number;
  ruleKind: "day" | "business";
  n: number;
  date: string;
  paidNow?: boolean;
}

export async function suggestCategoryAction(name: string) {
  const { sb } = await requireMember();
  const [c, r] = await Promise.all([
    sb.from("categories").select("id,name"),
    sb.from("category_rules").select("keyword,category_id"),
  ]);
  return suggestCategory(name, c.data ?? [], r.data ?? []);
}

export async function createExpenseAction(
  input: NewExpenseInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { sb, member } = await requireMember();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Diga o que é a despesa." };

  const today = todayInSP();
  const date: YMD = YMD_RE.test(input.date) ? input.date : today;
  const payment = input.mode === "installment" ? "card" : input.payment;

  let card: { id: string; closing_day: number; due_day: number } | null = null;
  if (payment === "card") {
    if (!input.cardId) return { ok: false, error: "Escolha o cartão." };
    const { data } = await sb.from("cards").select("id,closing_day,due_day").eq("id", input.cardId).maybeSingle();
    if (!data) return { ok: false, error: "Cartão não encontrado." };
    card = data;
  }

  let amount: number | null = null;
  let total: number | null = null;
  let installments: number | null = null;
  const isVariable = input.mode !== "installment" && input.isVariable;

  if (input.mode === "installment") {
    total = parseBRL(input.amount);
    installments = Math.round(input.installments);
    if (!total || total <= 0) return { ok: false, error: "Informe o valor total." };
    if (installments < 2 || installments > 48) return { ok: false, error: "Parcelas de 2 a 48." };
    amount = splitInstallments(total, installments)[0];
  } else if (!isVariable) {
    amount = parseBRL(input.amount);
    if (amount === null || amount <= 0) return { ok: false, error: "Informe o valor." };
  }

  // "Já paga": só para despesas à vista (não cartão nem parcelado). Se o valor varia, usa o valor digitado.
  const paidNow = !!input.paidNow && input.mode !== "installment" && payment !== "card";
  let paidAmount: number | null = null;
  if (paidNow) {
    paidAmount = isVariable ? parseBRL(input.amount) : amount;
    if (paidAmount === null || paidAmount <= 0) return { ok: false, error: "Informe o valor pago." };
  }

  let day_of_month: number | null = null;
  let business_day: number | null = null;
  if (input.mode === "monthly") {
    const n = Math.round(input.n);
    if (input.ruleKind === "business" && payment !== "card") {
      if (n < 1 || n > 23) return { ok: false, error: "Dia útil de 1 a 23." };
      business_day = n;
    } else {
      if (n < 1 || n > 31) return { ok: false, error: "Dia do mês de 1 a 31." };
      day_of_month = n;
    }
  }

  const base = {
    recurrence: input.mode,
    payment_method: payment,
    day_of_month,
    business_day,
    installments,
    amount,
    total_amount: total,
    is_variable: isVariable,
  } as const;

  let first_due_date: YMD;
  if (input.mode === "monthly") {
    // Começa no mês atual, mesmo que o vencimento já tenha passado (aparece como atrasada até ser paga).
    first_due_date = firstMonthlyDue(base, card, `${today.slice(0, 8)}01` as YMD);
  } else if (payment === "card" && card) {
    first_due_date = cardDueDate(date, card.closing_day, card.due_day);
  } else {
    first_due_date = date;
  }
  const rule: ExpenseRule = { ...base, first_due_date };

  const { data: created, error } = await sb
    .from("expenses")
    .insert({
      household_id: member.household_id,
      name,
      amount,
      total_amount: total,
      is_variable: isVariable,
      category_id: input.categoryId,
      payment_method: payment,
      card_id: card?.id ?? null,
      recurrence: input.mode,
      day_of_month,
      business_day,
      first_due_date,
      installments,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Não consegui salvar. Tente de novo." };

  const bills = generateBills(rule, card, addDays(today, 400)).map((b) => ({
    household_id: member.household_id,
    expense_id: created.id,
    due_date: b.due_date,
    amount: b.amount,
    installment_no: b.installment_no,
  }));
  const { error: billsError } = await sb.from("bills").insert(bills);
  if (billsError) {
    await sb.from("expenses").delete().eq("id", created.id);
    return { ok: false, error: "Não consegui criar os vencimentos. Tente de novo." };
  }

  if (paidNow && paidAmount !== null) {
    await sb
      .from("bills")
      .update({ amount: paidAmount, status: "paid", paid_on: today })
      .eq("expense_id", created.id)
      .eq("due_date", first_due_date);
  }

  // Aprende a escolha: se nenhuma regra cobria esse nome, guarda para a próxima vez.
  if (input.categoryId) {
    const { data: rules } = await sb.from("category_rules").select("keyword,category_id");
    if (!matchRule(name, rules ?? [])) {
      await sb
        .from("category_rules")
        .upsert(
          { household_id: member.household_id, keyword: normalize(name), category_id: input.categoryId },
          { onConflict: "household_id,keyword" },
        );
    }
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function endExpenseAction(formData: FormData) {
  const { sb } = await requireMember();
  const id = String(formData.get("id") ?? "");
  await sb.from("expenses").update({ active: false }).eq("id", id);
  await sb.from("bills").delete().eq("expense_id", id).eq("status", "pending").gte("due_date", todayInSP());
  revalidatePath("/", "layout");
  redirect("/config");
}

/* ---------- Pagamento ---------- */

export async function markPaidAction(formData: FormData) {
  const { sb } = await requireMember();
  const id = String(formData.get("billId") ?? "");
  const amount = parseBRL(String(formData.get("amount") ?? ""));
  const withInterest = formData.get("withInterest") === "on";
  const interest = withInterest ? parseBRL(String(formData.get("interest") ?? "")) : 0;
  const paidRaw = String(formData.get("paidOn") ?? "");
  const paidOn = YMD_RE.test(paidRaw) ? paidRaw : todayInSP();

  if (amount === null) redirect(`/pagar/${id}?erro=valor`);
  if (interest === null) redirect(`/pagar/${id}?erro=juros`);

  const { error } = await sb
    .from("bills")
    .update({ amount, interest: round2(interest), status: "paid", paid_on: paidOn })
    .eq("id", id);
  if (error) redirect(`/pagar/${id}?erro=salvar`);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function reopenBillAction(formData: FormData) {
  const { sb } = await requireMember();
  const id = String(formData.get("billId") ?? "");
  await sb.from("bills").update({ status: "pending", paid_on: null, interest: 0 }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/pagar/${id}`);
}

/* ---------- Configurações ---------- */

export async function addCardAction(formData: FormData) {
  const { sb, member } = await requireMember();
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const closing = Number(formData.get("closing"));
  const due = Number(formData.get("due"));
  const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;
  if (!name || !ok(closing) || !ok(due)) redirect("/config?erro=cartao-invalido");
  const { error } = await sb
    .from("cards")
    .insert({ household_id: member.household_id, name, closing_day: closing, due_day: due });
  if (error) redirect("/config?erro=cartao-limite");
  revalidatePath("/", "layout");
  redirect("/config");
}

export async function deleteCardAction(formData: FormData) {
  const { sb } = await requireMember();
  const { error } = await sb.from("cards").delete().eq("id", String(formData.get("id") ?? ""));
  if (error) redirect("/config?erro=cartao-em-uso");
  revalidatePath("/", "layout");
  redirect("/config");
}

export async function addRuleAction(formData: FormData) {
  const { sb, member } = await requireMember();
  const keyword = normalize(String(formData.get("keyword") ?? "")).slice(0, 40);
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!keyword || !categoryId) redirect("/config?erro=regra-invalida");
  await sb
    .from("category_rules")
    .upsert({ household_id: member.household_id, keyword, category_id: categoryId }, { onConflict: "household_id,keyword" });
  revalidatePath("/config");
  redirect("/config");
}

export async function deleteRuleAction(formData: FormData) {
  const { sb } = await requireMember();
  await sb.from("category_rules").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/config");
  redirect("/config");
}

export async function createTelegramCodeAction(): Promise<{ code?: string; error?: string }> {
  const { sb } = await requireMember();
  const { data, error } = await sb.rpc("create_telegram_link_code");
  if (error || !data) return { error: "Não consegui gerar o código." };
  return { code: data as string };
}
