import { toBill, toExpense, paymentLabel } from "@/lib/data";
import { todayInSP } from "@/lib/dates";
import { parseBRL } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  amountSavedMessage,
  answerCallback,
  clearButtons,
  sameSecret,
  sendMessage,
} from "@/lib/telegram";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminClient>;

interface Update {
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
}

export async function POST(req: Request) {
  if (!sameSecret(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("forbidden", { status: 403 });
  }
  const update = (await req.json()) as Update;
  try {
    const admin = createAdminClient();
    if (update.message?.text) await onText(admin, update.message.chat.id, update.message.text.trim());
    else if (update.callback_query) await onButton(admin, update.callback_query);
  } catch (e) {
    console.error("telegram webhook", e);
  }
  // Sempre 200, senão o Telegram repete a mesma mensagem.
  return Response.json({ ok: true });
}

async function memberByChat(admin: Admin, chatId: number) {
  const { data } = await admin
    .from("members")
    .select("user_id,household_id,display_name,telegram_chat_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data;
}

async function billContext(admin: Admin, billId: string, householdId: string) {
  const { data: row } = await admin.from("bills").select("*").eq("id", billId).eq("household_id", householdId).maybeSingle();
  if (!row) return null;
  const bill = toBill(row);
  const { data: e } = await admin.from("expenses").select("*").eq("id", bill.expense_id).single();
  const expense = toExpense(e!);
  const { data: cards } = await admin.from("cards").select("id,name,closing_day,due_day").eq("household_id", householdId);
  const cardMap = new Map((cards ?? []).map((c) => [c.id as string, c as Card]));
  const info = {
    id: bill.id,
    name: expense.name,
    due_date: bill.due_date,
    amount: bill.amount,
    label: paymentLabel(expense, cardMap),
  };
  return { bill, expense, info };
}

async function onText(admin: Admin, chatId: number, text: string) {
  const start = text.match(/^\/start(?:\s+(\S+))?$/i);
  if (start) {
    const code = start[1]?.toUpperCase();
    if (!code) {
      await sendMessage(
        chatId,
        "Oi! Para receber os avisos aqui, abra o app em Configurações, toque em Ligar Telegram e envie o código que aparecer.",
      );
      return;
    }
    const { data: row } = await admin
      .from("telegram_link_codes")
      .select("code,user_id,expires_at")
      .eq("code", code)
      .maybeSingle();
    if (!row || new Date(row.expires_at) < new Date()) {
      await sendMessage(chatId, "Esse código expirou ou não existe. Gere outro no app, em Configurações.");
      return;
    }
    const { error } = await admin.from("members").update({ telegram_chat_id: chatId }).eq("user_id", row.user_id);
    if (error) {
      await sendMessage(chatId, "Este Telegram já está ligado a outra pessoa da casa.");
      return;
    }
    await admin.from("telegram_link_codes").delete().eq("code", code);
    const { data: m } = await admin.from("members").select("display_name").eq("user_id", row.user_id).single();
    const nome = m?.display_name ? `, ${m.display_name}` : "";
    await sendMessage(chatId, `Pronto${nome}! Vou avisar por aqui um dia antes de cada vencimento.`);
    return;
  }

  const member = await memberByChat(admin, chatId);
  if (!member) {
    await sendMessage(chatId, "Ainda não sei quem é você. Ligue este Telegram no app, em Configurações.");
    return;
  }

  const since = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
  const { data: prompt } = await admin
    .from("telegram_prompts")
    .select("id,bill_id")
    .eq("chat_id", chatId)
    .eq("kind", "ask_amount")
    .is("answered_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prompt) {
    await sendMessage(chatId, "No momento não estou esperando nenhum valor. Os avisos chegam um dia antes do vencimento.");
    return;
  }

  const amount = parseBRL(text);
  if (amount === null || amount <= 0) {
    await sendMessage(chatId, "Não entendi o valor. Envie só o número, por exemplo 241,70.");
    return;
  }

  const ctx = await billContext(admin, prompt.bill_id, member.household_id);
  if (!ctx) return;
  await admin.from("bills").update({ amount }).eq("id", ctx.bill.id);
  await admin.from("telegram_prompts").update({ answered_at: new Date().toISOString() }).eq("bill_id", ctx.bill.id);
  const msg = amountSavedMessage(ctx.info, amount);
  await sendMessage(chatId, msg.text, msg.buttons);
}

async function onButton(admin: Admin, cb: NonNullable<Update["callback_query"]>) {
  const chatId = cb.message?.chat.id;
  const data = cb.data ?? "";
  if (!chatId || !data.startsWith("paid:")) {
    await answerCallback(cb.id);
    return;
  }
  const member = await memberByChat(admin, chatId);
  if (!member) {
    await answerCallback(cb.id, "Ligue este Telegram no app primeiro.");
    return;
  }
  const ctx = await billContext(admin, data.slice(5), member.household_id);
  if (!ctx) {
    await answerCallback(cb.id, "Não encontrei essa conta.");
    return;
  }
  if (ctx.bill.status === "paid") {
    await answerCallback(cb.id, "Essa conta já estava paga.");
  } else if (ctx.bill.amount === null) {
    await answerCallback(cb.id, "Falta informar o valor da conta.");
    return;
  } else {
    await admin
      .from("bills")
      .update({ status: "paid", paid_on: todayInSP(), interest: 0 })
      .eq("id", ctx.bill.id);
    await answerCallback(cb.id, "Marcado como pago.");
    // Avisa a outra pessoa da casa, para os dois ficarem em dia.
    const { data: others } = await admin
      .from("members")
      .select("telegram_chat_id")
      .eq("household_id", member.household_id)
      .neq("user_id", member.user_id)
      .not("telegram_chat_id", "is", null);
    for (const o of others ?? []) {
      await sendMessage(o.telegram_chat_id as number, `${member.display_name} marcou ${ctx.expense.name} como pago.`);
    }
  }
  if (cb.message) await clearButtons(chatId, cb.message.message_id);
}
