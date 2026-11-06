import { generateBills } from "@/lib/bills";
import { paymentLabel, toBill, toExpense } from "@/lib/data";
import { addDays, todayInSP } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { askAmountMessage, noticeMessage, sameSecret, sendMessage } from "@/lib/telegram";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!sameSecret(auth, process.env.CRON_SECRET)) return new Response("forbidden", { status: 403 });

  const admin = createAdminClient();
  const today = todayInSP();
  const tomorrow = addDays(today, 1);
  const summary = { novosLancamentos: 0, avisos: 0, cobrancas: 0 };

  const [{ data: expRows }, { data: cardRows }, { data: memberRows }] = await Promise.all([
    admin.from("expenses").select("*, household_id"),
    admin.from("cards").select("id,name,closing_day,due_day,household_id"),
    admin.from("members").select("user_id,household_id,display_name,telegram_chat_id").not("telegram_chat_id", "is", null),
  ]);
  const expenses = (expRows ?? []).map((r) => ({ ...toExpense(r), household_id: r.household_id as string }));
  const cards = new Map((cardRows ?? []).map((c) => [c.id as string, c as Card & { household_id: string }]));

  // 1) Mantém os próximos meses de despesas mensais sempre gerados.
  const horizon = addDays(today, 100);
  for (const e of expenses.filter((x) => x.active && x.recurrence === "monthly")) {
    const card = e.card_id ? cards.get(e.card_id) ?? null : null;
    const rows = generateBills(
      {
        recurrence: "monthly",
        payment_method: e.payment_method,
        day_of_month: e.day_of_month,
        business_day: e.business_day,
        first_due_date: e.first_due_date,
        installments: null,
        amount: e.amount,
        total_amount: null,
        is_variable: e.is_variable,
      },
      card,
      horizon,
    ).map((b) => ({
      household_id: e.household_id,
      expense_id: e.id,
      due_date: b.due_date,
      amount: b.amount,
    }));
    if (rows.length === 0) continue;
    const { data } = await admin
      .from("bills")
      .upsert(rows, { onConflict: "expense_id,due_date", ignoreDuplicates: true })
      .select("id");
    summary.novosLancamentos += data?.length ?? 0;
  }

  // 2) Avisos de amanhã e cobrança de vencidas (até 5 dias).
  const { data: billRows } = await admin
    .from("bills")
    .select("*")
    .eq("status", "pending")
    .gte("due_date", addDays(today, -5))
    .lte("due_date", tomorrow);

  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  for (const row of billRows ?? []) {
    const bill = toBill(row);
    const overdue = bill.due_date < today;
    const alreadyDone = overdue
      ? row.overdue_reminded_on !== null && row.overdue_reminded_on >= today
      : row.reminder_sent_at !== null;
    if (alreadyDone) continue;
    if (!overdue && bill.due_date !== tomorrow) continue;

    const expense = expenseById.get(bill.expense_id);
    if (!expense) continue;
    const cardMap = new Map(Array.from(cards.entries()).map(([k, v]) => [k, v as Card]));
    const info = {
      id: bill.id,
      name: expense.name,
      due_date: bill.due_date,
      amount: bill.amount,
      label: paymentLabel(expense, cardMap),
      installment:
        bill.installment_no && expense.installments ? `parcela ${bill.installment_no} de ${expense.installments}` : undefined,
    };
    const msg = bill.amount === null ? askAmountMessage(info, overdue) : noticeMessage(info, overdue);

    let sent = 0;
    for (const m of (memberRows ?? []).filter((x) => x.household_id === bill.household_id)) {
      const ok = await sendMessage(m.telegram_chat_id as number, msg.text, msg.buttons);
      if (!ok) continue;
      sent++;
      if (bill.amount === null) {
        await admin.from("telegram_prompts").insert({ chat_id: m.telegram_chat_id, bill_id: bill.id, kind: "ask_amount" });
      }
    }
    if (sent > 0) {
      await admin
        .from("bills")
        .update(overdue ? { overdue_reminded_on: today } : { reminder_sent_at: new Date().toISOString() })
        .eq("id", bill.id);
      if (overdue) summary.cobrancas++;
      else summary.avisos++;
    }
  }

  return Response.json({ ok: true, hoje: today, ...summary });
}
