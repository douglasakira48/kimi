"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createExpenseAction, suggestCategoryAction } from "@/app/actions";
import { firstMonthlyDue } from "@/lib/bills";
import { cardDueDate, dayInMonth, formatCurto, formatData, parseYMD, shiftMonth } from "@/lib/dates";
import OwnerField from "@/components/OwnerField";
import { formatBRL, parseBRL, splitInstallments } from "@/lib/money";

interface CardOpt {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  kind: "credit" | "debit";
  owner_user_id: string | null;
}

interface Props {
  categories: { id: string; name: string }[];
  cards: CardOpt[];
  today: string;
  members: { user_id: string; display_name: string }[];
  defaultOwner: string;
}

type Mode = "once" | "monthly" | "installment";
type Payment = "pix" | "boleto" | "card" | "debit" | "cash";

const MODES: { id: Mode; label: string }[] = [
  { id: "once", label: "Uma vez" },
  { id: "monthly", label: "Todo mês" },
  { id: "installment", label: "Parcelado" },
];

export default function NewExpenseForm({ categories, cards, today, members, defaultOwner }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [mode, setMode] = useState<Mode>("once");
  const [isVariable, setIsVariable] = useState(false);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [source, setSource] = useState<"rule" | "ai" | "none" | "manual">("none");
  const [payment, setPayment] = useState<Payment>("pix");
  const creditCards = cards.filter((c) => c.kind === "credit");
  const debitCards = cards.filter((c) => c.kind === "debit");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState(12);
  const [ruleKind, setRuleKind] = useState<"day" | "business">("day");
  const [n, setN] = useState(5);
  const [date, setDate] = useState(today);
  const [paidNow, setPaidNow] = useState(false);
  const [ownerId, setOwnerId] = useState(defaultOwner);

  const effectivePayment: Payment = mode === "installment" ? "card" : payment;
  const card = creditCards.find((c) => c.id === cardId) ?? null;
  const usesCard = effectivePayment === "card";
  const effectiveRuleKind = usesCard ? "day" : ruleKind;
  const needsCardButNone = usesCard && creditCards.length === 0;
  const canPayNow = mode !== "installment" && !usesCard;
  const paidNowOn = paidNow && canPayNow;

  async function suggest() {
    if (!name.trim() || source === "manual") return;
    const s = await suggestCategoryAction(name);
    if (s.categoryId) {
      setCategoryId(s.categoryId);
      setSource(s.source);
    }
  }

  function pickMode(m: Mode) {
    setMode(m);
    if (m === "installment") {
      setIsVariable(false);
      if (!creditCards.some((c) => c.id === cardId)) setCardId(creditCards[0]?.id ?? "");
    }
  }

  function setRule(kind: "day" | "business") {
    setRuleKind(kind);
    setN(kind === "day" ? 16 : 5);
  }

  // Prévia do que o app vai calcular
  let preview: string[] = [];
  if (mode === "installment" && card) {
    const total = parseBRL(amount);
    if (total && total > 0) {
      const first = cardDueDate(date, card.closing_day, card.due_day);
      const f = parseYMD(first);
      const lastYm = shiftMonth(f.y, f.m, installments - 1);
      const last = dayInMonth(lastYm.y, lastYm.m, card.due_day);
      const parts = splitInstallments(total, installments);
      preview = [`${formatBRL(parts[0])} por mês`, `1ª parcela em ${formatData(first)}`, `Última em ${formatData(last)}`];
    }
  } else if (mode === "monthly") {
    const next = firstMonthlyDue(
      {
        recurrence: "monthly", payment_method: effectivePayment,
        day_of_month: effectiveRuleKind === "day" ? n : null,
        business_day: effectiveRuleKind === "business" ? n : null,
        installments: null, amount: null, total_amount: null, is_variable: true,
      },
      card,
      `${today.slice(0, 8)}01`,
    );
    preview = [`Próximo vencimento: ${formatCurto(next)}`];
  } else if (mode === "once" && usesCard && card) {
    preview = [`Entra na fatura que vence em ${formatData(cardDueDate(date, card.closing_day, card.due_day))}`];
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await createExpenseAction({
        name, amount, isVariable: mode !== "installment" && isVariable, categoryId: categoryId || null,
        mode, payment: effectivePayment, cardId: usesCard || effectivePayment === "debit" ? cardId || null : null,
        installments, ruleKind: effectiveRuleKind, n, date, paidNow: paidNowOn, ownerId: ownerId || null,
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const paymentOptions: { id: Payment | string; label: string; payment: Payment; cardId?: string }[] =
    mode === "installment"
      ? creditCards.map((c) => ({ id: c.id, label: c.name, payment: "card", cardId: c.id }))
      : [
          { id: "pix", label: "PIX", payment: "pix" },
          ...(debitCards.length === 0
            ? [{ id: "debit", label: "Débito", payment: "debit" as Payment }]
            : debitCards.map((c) => ({ id: c.id, label: `Débito ${c.name}`, payment: "debit" as Payment, cardId: c.id }))),
          { id: "cash", label: "Dinheiro", payment: "cash" },
          { id: "boleto", label: "Boleto", payment: "boleto" },
          ...creditCards.map((c) => ({ id: c.id, label: c.name, payment: "card" as Payment, cardId: c.id })),
        ];

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 22 }}>
      {error && <div className="error" role="alert">{error}</div>}

      <div className="field">
        <div className="row-between">
          <label htmlFor="amount">{mode === "installment" ? "Valor total" : "Valor"}</label>
          {mode !== "installment" && (
            <label htmlFor="variable" className="muted" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
              Muda todo mês
              <input
                id="variable" type="checkbox" checked={isVariable} onChange={(e) => setIsVariable(e.target.checked)}
                style={{ width: 22, height: 22, margin: 0, accentColor: "var(--accent)" }}
              />
            </label>
          )}
        </div>
        {isVariable && mode !== "installment" && (
          <div className="small">
            {mode === "monthly"
              ? "Valor deste mês (opcional). Os próximos meses usam esse valor como estimativa até você informar o real."
              : "Valor desta conta (opcional). Se deixar vazio, você informa no aviso."}
          </div>
        )}
        {(
          <div className="prefix">
            <span>R$</span>
            <input
              id="amount" className="input xl num" inputMode="decimal" autoComplete="off" placeholder="0,00"
              value={amount} onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        )}
      </div>

      {canPayNow && (
        <label htmlFor="paidnow" className="check-line" style={{ cursor: "pointer" }}>
          <span style={{ fontWeight: 600 }}>
            Já está paga
            <span className="small" style={{ display: "block", fontWeight: 400 }}>Marca como paga hoje ao salvar</span>
          </span>
          <input id="paidnow" type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
        </label>
      )}

      <OwnerField members={members} value={ownerId} onChange={setOwnerId} />

      <div className="field">
        <label htmlFor="name">O que é?</label>
        <input
          id="name" className="input lg" value={name} maxLength={80} autoComplete="off"
          onChange={(e) => setName(e.target.value)} onBlur={suggest}
        />
      </div>

      <div className="field">
        <label htmlFor="category">
          Categoria{source === "rule" || source === "ai" ? (source === "ai" ? " (sugerida pela IA)" : " (sugerida)") : ""}
        </label>
        <select
          id="category" className="select" value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setSource("manual"); }}
        >
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="label" id="when-label">Quando</span>
        <div className="segment" role="group" aria-labelledby="when-label">
          {MODES.map((m) => (
            <button
              key={m.id} type="button" className={mode === m.id ? "on" : ""} aria-pressed={mode === m.id}
              onClick={() => pickMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "once" && !usesCard && (
        <div className="check-line">
          <label htmlFor="date" style={{ fontWeight: 600 }}>Vence em</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: 0, background: "transparent" }} />
        </div>
      )}

      {(mode === "installment" || (mode === "once" && usesCard)) && (
        <div className="check-line">
          <label htmlFor="date" style={{ fontWeight: 600 }}>Data da compra</label>
          <input id="date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ border: 0, background: "transparent" }} />
        </div>
      )}

      {mode === "monthly" && (
        <div className="stack" style={{ gap: 12 }}>
          {!usesCard && (
            <div className="chips" role="group" aria-label="Como repete">
              <button type="button" className={`chip ${ruleKind === "day" ? "on" : ""}`} aria-pressed={ruleKind === "day"} onClick={() => setRule("day")}>Dia fixo</button>
              <button type="button" className={`chip ${ruleKind === "business" ? "on" : ""}`} aria-pressed={ruleKind === "business"} onClick={() => setRule("business")}>Dia útil</button>
            </div>
          )}
          <div className="row-between">
            <span style={{ fontWeight: 600 }}>{effectiveRuleKind === "day" ? "Todo dia" : "Todo dia útil nº"}</span>
            <div className="stepper">
              <button type="button" aria-label="Diminuir" onClick={() => setN(Math.max(1, n - 1))}>−</button>
              <span className="value num">{n}</span>
              <button type="button" aria-label="Aumentar" onClick={() => setN(Math.min(effectiveRuleKind === "day" ? 31 : 23, n + 1))}>+</button>
            </div>
          </div>
        </div>
      )}

      {mode === "installment" && (
        <div className="row-between">
          <span style={{ fontWeight: 600 }}>Parcelas</span>
          <div className="stepper">
            <button type="button" aria-label="Menos parcelas" onClick={() => setInstallments(Math.max(2, installments - 1))}>−</button>
            <span className="value num">{installments}x</span>
            <button type="button" aria-label="Mais parcelas" onClick={() => setInstallments(Math.min(48, installments + 1))}>+</button>
          </div>
        </div>
      )}

      <div className="field">
        <span className="label" id="pay-label">{mode === "installment" ? "Cartão" : "Como paga"}</span>
        <div className="chips" role="group" aria-labelledby="pay-label">
          {paymentOptions.map((o) => {
            const selected = o.cardId
              ? effectivePayment === o.payment && cardId === o.cardId
              : effectivePayment === o.payment && (o.payment !== "debit" || !debitCards.some((c) => c.id === cardId));
            return (
              <button
                key={o.id} type="button" className={`chip ${selected ? "on" : ""}`} aria-pressed={selected}
                onClick={() => { setPayment(o.payment); setCardId(o.cardId ?? ""); }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {needsCardButNone && (
          <div className="hint-box small" style={{ color: "var(--ink)" }}>
            Nenhum cartão cadastrado. <Link href="/config" style={{ color: "var(--accent)", fontWeight: 600 }}>Cadastre em Ajustes</Link> e volte aqui.
          </div>
        )}
        {usesCard && card && (
          <div className="small">{card.name} fecha dia {card.closing_day} e vence dia {card.due_day}.</div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="info-box num">
          {preview.map((line, i) => (
            <div key={line} style={i === 0 ? { fontWeight: 700, fontSize: 17 } : { color: "var(--ink2)", fontSize: 15 }}>{line}</div>
          ))}
        </div>
      )}

      <div className="footer-bar">
        <div className="footer-inner">
          <button type="submit" className="btn" disabled={busy || needsCardButNone}>
            {busy ? "Salvando…" : "Salvar despesa"}
          </button>
        </div>
      </div>
    </form>
  );
}
