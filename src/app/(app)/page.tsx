import Link from "next/link";
import { loadLookups, paymentLabel, toBill, type Lookups } from "@/lib/data";
import {
  addDays, daysInMonth, formatCurto, formatExtenso, mesNome, parseYMD, todayInSP, toYMD,
} from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Bill } from "@/lib/types";

function diasAtraso(due: string, today: string): number {
  const a = parseYMD(due);
  const b = parseYMD(today);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

function BillRow({ bill, lk, today }: { bill: Bill; lk: Lookups; today: string }) {
  const expense = lk.expenses.get(bill.expense_id);
  if (!expense) return null;
  const late = bill.due_date < today;
  const atraso = diasAtraso(bill.due_date, today);

  const extras: string[] = [];
  if (expense.business_day && expense.recurrence === "monthly") extras.push(`${expense.business_day}º dia útil`);
  if (bill.installment_no && expense.installments) extras.push(`parcela ${bill.installment_no} de ${expense.installments}`);

  let meta = formatCurto(bill.due_date);
  if (late) meta = atraso === 1 ? "Venceu ontem" : `Venceu há ${atraso} dias`;
  if (extras.length) meta += `, ${extras.join(", ")}`;

  return (
    <div className="bill">
      <Link href={`/pagar/${bill.id}`} className="check" aria-label={`Marcar ${expense.name} como paga`}>
        <span className="dot" />
      </Link>
      <div className="bill-text">
        <span className="bill-name">{expense.name}</span>
        <span className={`bill-meta ${late ? "late" : ""}`}>{meta}</span>
      </div>
      <div className="bill-value">
        {bill.amount === null ? (
          <Link href={`/pagar/${bill.id}`} className="chip-ask">Informar valor</Link>
        ) : (
          <span className="bill-amount">{formatBRL(bill.amount)}</span>
        )}
        <span className="bill-meta">{paymentLabel(expense, lk.cards)}</span>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const sb = await createClient();
  const today = todayInSP();
  const { y, m } = parseYMD(today);
  const monthStart = toYMD(y, m, 1);
  const monthEnd = toYMD(y, m, daysInMonth(y, m));
  const limit = addDays(today, 30) > monthEnd ? addDays(today, 30) : monthEnd;

  const [pendingRes, paidRes, lk] = await Promise.all([
    sb.from("bills").select("*").eq("status", "pending").lte("due_date", limit).order("due_date"),
    sb.from("bills").select("amount,interest").eq("status", "paid").gte("due_date", monthStart).lte("due_date", monthEnd),
    loadLookups(sb),
  ]);

  const pending = (pendingRes.data ?? []).map(toBill);
  const paid = (paidRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0) + Number(r.interest ?? 0), 0);
  const inMonth = pending.filter((b) => b.due_date <= monthEnd);
  const toPay = inMonth.reduce((s, b) => s + (b.amount ?? 0), 0);
  const unknown = inMonth.filter((b) => b.amount === null);
  const total = paid + toPay;

  const tomorrow = addDays(today, 1);
  const groups = [
    { label: "Atrasadas", late: true, items: pending.filter((b) => b.due_date < today) },
    { label: "Hoje", late: false, items: pending.filter((b) => b.due_date === today) },
    { label: "Amanhã", late: false, items: pending.filter((b) => b.due_date === tomorrow) },
    { label: "Próximas", late: false, items: pending.filter((b) => b.due_date > tomorrow && b.due_date <= addDays(today, 30)) },
  ].filter((g) => g.items.length > 0);

  const unknownNames = unknown
    .map((b) => lk.expenses.get(b.expense_id)?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(" e ");

  return (
    <div className="stack">
      <div className="stack-sm">
        <div className="muted">{formatExtenso(today)}</div>
        <h1>{mesNome(m).charAt(0).toUpperCase() + mesNome(m).slice(1)}</h1>
      </div>

      <div className="stack-sm" style={{ gap: 10 }}>
        <div className="muted">A pagar</div>
        <div className="big-number num">{formatBRL(toPay)}</div>
        <div className="progress" aria-hidden="true">
          <div style={{ width: `${total > 0 ? Math.round((paid / total) * 100) : 0}%` }} />
        </div>
        <div className="row-between small num">
          <span>Pago {formatBRL(paid)}</span>
          {unknown.length > 0 && (
            <span>{unknown.length === 1 ? `${unknownNames}: valor a informar` : `${unknown.length} valores a informar`}</span>
          )}
        </div>
      </div>

      <div>
        {groups.length === 0 && (
          <p className="empty">Nada vencendo nos próximos 30 dias. Toque no + para cadastrar uma despesa.</p>
        )}
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <div className={`group-label ${g.late ? "late" : ""}`}>{g.label}</div>
            {g.items.map((b) => (
              <BillRow key={b.id} bill={b} lk={lk} today={today} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
