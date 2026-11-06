import { sameSecret, setWebhook } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Abra uma vez no navegador: /api/telegram/setup?secret=SEU_CRON_SECRET */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!sameSecret(secret, process.env.CRON_SECRET)) return new Response("forbidden", { status: 403 });

  const app = process.env.APP_URL;
  const hook = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!app || !hook || !process.env.TELEGRAM_BOT_TOKEN) {
    return Response.json({ ok: false, error: "Faltam APP_URL, TELEGRAM_WEBHOOK_SECRET ou TELEGRAM_BOT_TOKEN." }, { status: 400 });
  }
  const res = await setWebhook(`${app}/api/telegram/webhook`, hook);
  return Response.json(res);
}
