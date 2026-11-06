import TelegramLink from "@/components/TelegramLink";
import { addCardAction, addRuleAction, deleteCardAction, deleteRuleAction, endExpenseAction, signOutAction } from "@/app/actions";
import { getMember, loadLookups } from "@/lib/data";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRule, Expense } from "@/lib/types";

const ERROS: Record<string, string> = {
  "cartao-invalido": "Preencha o nome e os dois dias (de 1 a 31).",
  "cartao-limite": "Cada casa pode ter até 5 cartões.",
  "cartao-em-uso": "Esse cartão tem despesas ligadas a ele e não pode ser apagado.",
  "regra-invalida": "Escreva a palavra e escolha a categoria.",
};

function resumo(e: Expense): string {
  if (e.recurrence === "installment") return `${e.installments}x de ${formatBRL(e.amount ?? 0)}`;
  const quando = e.business_day ? `todo ${e.business_day}º dia útil` : `todo dia ${e.day_of_month}`;
  return `${quando}, ${e.is_variable ? "valor varia" : formatBRL(e.amount ?? 0)}`;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const sb = await createClient();
  const [member, lk, rulesRes, householdRes, membersRes] = await Promise.all([
    getMember(sb),
    loadLookups(sb),
    sb.from("category_rules").select("id,keyword,category_id").order("keyword"),
    sb.from("households").select("invite_code,name").maybeSingle(),
    sb.from("members").select("user_id,display_name,telegram_chat_id"),
  ]);

  const rules = (rulesRes.data ?? []) as CategoryRule[];
  const members = membersRes.data ?? [];
  const categories = Array.from(lk.categories.values());
  const cards = Array.from(lk.cards.values());
  const active = Array.from(lk.expenses.values()).filter((e) => e.active && e.recurrence !== "once");

  return (
    <div className="stack" style={{ gap: 32 }}>
      <h1>Ajustes</h1>
      {erro && ERROS[erro] && <div className="error" role="alert">{ERROS[erro]}</div>}

      <section className="stack" style={{ gap: 12 }} aria-label="Cartões">
        <h2>Cartões</h2>
        {cards.map((c) => (
          <form key={c.id} action={deleteCardAction} className="list-line">
            <input type="hidden" name="id" value={c.id} />
            <div className="stack-sm" style={{ gap: 0 }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span className="small">Fecha dia {c.closing_day}, vence dia {c.due_day}</span>
            </div>
            <button type="submit" className="btn small danger" aria-label={`Apagar ${c.name}`}>Apagar</button>
          </form>
        ))}
        {cards.length < 5 && (
          <form action={addCardAction} className="stack" style={{ gap: 14 }}>
            <div className="field">
              <label htmlFor="card-name">Nome do cartão</label>
              <input id="card-name" name="name" className="input lg" maxLength={40} required />
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="closing">Fecha no dia</label>
                <input id="closing" name="closing" type="number" min={1} max={31} inputMode="numeric" className="input lg" required />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="due">Vence no dia</label>
                <input id="due" name="due" type="number" min={1} max={31} inputMode="numeric" className="input lg" required />
              </div>
            </div>
            <button type="submit" className="btn secondary">Adicionar cartão</button>
          </form>
        )}
        {cards.length >= 5 && <p className="small">Você já usa os 5 cartões que cabem na casa.</p>}
      </section>

      <section className="stack" style={{ gap: 12 }} aria-label="Avisos no Telegram">
        <h2>Avisos no Telegram</h2>
        {members.map((m) => (
          <div key={m.user_id} className="list-line">
            <span style={{ fontWeight: 600 }}>{m.display_name}</span>
            <span className="small">{m.telegram_chat_id ? "ligado" : "não ligado"}</span>
          </div>
        ))}
        <p className="small" style={{ margin: 0 }}>Cada pessoa liga o próprio Telegram, entrando no app com o próprio login.</p>
        <TelegramLink linked={!!member?.telegram_chat_id} botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null} />
      </section>

      <section className="stack" style={{ gap: 12 }} aria-label="Convite">
        <h2>Convidar a outra pessoa</h2>
        <p className="small" style={{ margin: 0 }}>
          Depois de criar o login dela, ela entra na casa com este código.
        </p>
        <div className="info-box">
          <span className="code" style={{ fontSize: 24 }}>{householdRes.data?.invite_code}</span>
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }} aria-label="Regras de categoria">
        <h2>Regras de categoria</h2>
        <p className="small" style={{ margin: 0 }}>
          Quando o nome da despesa começa com a palavra, a categoria é escolhida sozinha.
        </p>
        <div>
          {rules.map((r) => (
            <form key={r.id} action={deleteRuleAction} className="list-line">
              <input type="hidden" name="id" value={r.id} />
              <span>
                <strong>{r.keyword}</strong> <span className="small">vira</span> {lk.categories.get(r.category_id)?.name}
              </span>
              <button type="submit" className="btn small danger" aria-label={`Apagar regra ${r.keyword}`}>Apagar</button>
            </form>
          ))}
        </div>
        <form action={addRuleAction} className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label htmlFor="keyword">Palavra</label>
            <input id="keyword" name="keyword" className="input lg" maxLength={40} required />
          </div>
          <div className="field">
            <label htmlFor="categoryId">Categoria</label>
            <select id="categoryId" name="categoryId" className="select" required defaultValue="">
              <option value="" disabled>Escolha</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn secondary">Adicionar regra</button>
        </form>
      </section>

      {active.length > 0 && (
        <section className="stack" style={{ gap: 12 }} aria-label="Despesas que se repetem">
          <h2>Despesas que se repetem</h2>
          <div>
            {active.map((e) => (
              <form key={e.id} action={endExpenseAction} className="list-line">
                <input type="hidden" name="id" value={e.id} />
                <div className="stack-sm" style={{ gap: 0 }}>
                  <span style={{ fontWeight: 600 }}>{e.name}</span>
                  <span className="small num">{resumo(e)}</span>
                </div>
                <button type="submit" className="btn small danger">Encerrar</button>
              </form>
            ))}
          </div>
          <p className="small" style={{ margin: 0 }}>Encerrar tira os próximos vencimentos. O que já foi pago continua no painel.</p>
        </section>
      )}

      <form action={signOutAction}>
        <button type="submit" className="btn secondary">Sair</button>
      </form>
    </div>
  );
}
