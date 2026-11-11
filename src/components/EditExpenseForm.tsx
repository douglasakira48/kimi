"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateExpenseAction } from "@/app/actions";
import OwnerField from "@/components/OwnerField";

type Payment = "pix" | "boleto" | "card" | "debit" | "cash";

interface Props {
  expense: {
    id: string;
    name: string;
    categoryId: string | null;
    payment: Payment;
    cardId: string | null;
    amount: number | null;
    recurrence: "once" | "monthly" | "installment";
    isVariable: boolean;
    ownerId: string | null;
  };
  members: { user_id: string; display_name: string }[];
  categories: { id: string; name: string }[];
  debitCards: { id: string; name: string }[];
  creditName: string | null;
}

export default function EditExpenseForm({ expense, categories, debitCards, creditName, members }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState(expense.name);
  const [categoryId, setCategoryId] = useState(expense.categoryId ?? "");
  const [payment, setPayment] = useState<Payment>(expense.payment);
  const [cardId, setCardId] = useState(expense.cardId ?? "");
  const [amount, setAmount] = useState(expense.amount !== null ? String(expense.amount).replace(".", ",") : "");

  const [ownerId, setOwnerId] = useState(expense.ownerId ?? "");
  const [isVariable, setIsVariable] = useState(expense.isVariable);
  const isCredit = expense.payment === "card";
  const canToggle = expense.recurrence === "monthly";
  const editAmount = expense.recurrence !== "installment" && !isVariable;

  const options: { id: string; label: string; payment: Payment; cardId: string }[] = [
    { id: "pix", label: "PIX", payment: "pix", cardId: "" },
    ...(debitCards.length === 0
      ? [{ id: "debit", label: "Débito", payment: "debit" as Payment, cardId: "" }]
      : debitCards.map((c) => ({ id: c.id, label: `Débito ${c.name}`, payment: "debit" as Payment, cardId: c.id }))),
    { id: "cash", label: "Dinheiro", payment: "cash", cardId: "" },
    { id: "boleto", label: "Boleto", payment: "boleto", cardId: "" },
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await updateExpenseAction({
        id: expense.id, name, categoryId: categoryId || null, payment,
        cardId: payment === "debit" ? cardId || null : null, amount,
        ownerId: ownerId || null, isVariable: canToggle ? isVariable : undefined,
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 22 }}>
      {error && <div className="error" role="alert">{error}</div>}

      <div className="field">
        <label htmlFor="name">O que é?</label>
        <input id="name" className="input lg" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>

      {canToggle && (
        <label htmlFor="variable" className="check-line" style={{ cursor: "pointer" }}>
          <span style={{ fontWeight: 600 }}>
            Valor muda todo mês
            <span className="small" style={{ display: "block", fontWeight: 400 }}>Os próximos meses usam o último valor como estimativa</span>
          </span>
          <input id="variable" type="checkbox" checked={isVariable} onChange={(e) => setIsVariable(e.target.checked)} />
        </label>
      )}

      {editAmount && (
        <div className="field">
          <label htmlFor="amount">Valor</label>
          <div className="prefix">
            <span>R$</span>
            <input id="amount" className="input xl num" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
      )}

      <OwnerField members={members} value={ownerId} onChange={setOwnerId} />

      <div className="field">
        <label htmlFor="category">Categoria</label>
        <select id="category" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="label" id="pay-label">Como paga</span>
        {isCredit ? (
          <div className="hint-box small" style={{ color: "var(--ink)" }}>
            {creditName} (crédito). Para trocar o cartão de crédito, apague a despesa e cadastre de novo.
          </div>
        ) : (
          <div className="chips" role="group" aria-labelledby="pay-label">
            {options.map((o) => {
              const selected = o.payment === "debit"
                ? payment === "debit" && (o.cardId ? cardId === o.cardId : !debitCards.some((c) => c.id === cardId))
                : payment === o.payment;
              return (
                <button key={o.id} type="button" className={`chip ${selected ? "on" : ""}`} aria-pressed={selected}
                  onClick={() => { setPayment(o.payment); setCardId(o.cardId); }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="small">
        {editAmount
          ? "As mudanças valem para esta conta e para as próximas ainda não pagas. O que já foi pago não muda."
          : "As mudanças valem para esta despesa."}
      </div>

      <div className="footer-bar">
        <div className="footer-inner">
          <button type="submit" className="btn" disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</button>
        </div>
      </div>
    </form>
  );
}
