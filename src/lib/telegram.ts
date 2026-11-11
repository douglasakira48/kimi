import { timingSafeEqual } from "node:crypto";
import { formatBRL } from "./money";
import { formatCurto, type YMD } from "./dates";

async function call(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return (await res.json()) as { ok: boolean; result?: unknown };
  } catch {
    return { ok: false };
  }
}

export interface Button {
  text: string;
  callback_data?: string;
  url?: string;
}

export async function sendMessage(chatId: number, text: string, buttons?: Button[]): Promise<boolean> {
  const res = await call("sendMessage", {
    chat_id: chatId,
    text,
    ...(buttons && buttons.length ? { reply_markup: { inline_keyboard: buttons.map((b) => [b]) } } : {}),
  });
  return res.ok;
}

export async function answerCallback(id: string, text?: string) {
  await call("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
}

export async function clearButtons(chatId: number, messageId: number) {
  await call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
}

export async function setWebhook(url: string, secret: string) {
  return call("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query"] });
}

/** Compara segredos sem vazar informação pelo tempo de resposta. */
export function sameSecret(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ---------- Textos dos avisos ---------- */

interface BillInfo {
  id: string;
  name: string;
  due_date: YMD;
  amount: number | null;
  label: string; // PIX, Boleto ou nome do cartão
  installment?: string; // "parcela 3 de 12"
}

function actionButtons(billId: string): Button[] {
  const buttons: Button[] = [{ text: "Paguei", callback_data: `paid:${billId}` }];
  if (process.env.APP_URL) buttons.push({ text: "Paguei com juros", url: `${process.env.APP_URL}/pagar/${billId}` });
  return buttons;
}

export function askAmountMessage(b: BillInfo, overdue: boolean) {
  const when = overdue ? `Venceu ${formatCurto(b.due_date)}` : `Amanhã vence (${formatCurto(b.due_date)})`;
  const guess = b.amount !== null ? `\nEstimei ${formatBRL(b.amount)} pelo último valor.` : "";
  return {
    text: `${when}: ${b.name}.${guess}\nQual o valor da conta? Responda só com o número, por exemplo 241,70.`,
    buttons: undefined as Button[] | undefined,
  };
}

export function noticeMessage(b: BillInfo, overdue: boolean) {
  const parcela = b.installment ? `, ${b.installment}` : "";
  const when = overdue ? `Venceu ${formatCurto(b.due_date)}` : `Amanhã vence (${formatCurto(b.due_date)})`;
  return {
    text: `${when}: ${b.name}${parcela}.\n${formatBRL(b.amount ?? 0)} no ${b.label}.${overdue ? "\nJá pagou?" : ""}`,
    buttons: actionButtons(b.id),
  };
}

export function amountSavedMessage(b: BillInfo, amount: number) {
  return {
    text: `Anotado: ${b.name} ${formatBRL(amount)}, vence ${formatCurto(b.due_date)}.\nQuando pagar, é só tocar em Paguei.`,
    buttons: actionButtons(b.id),
  };
}
