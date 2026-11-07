import Link from "next/link";
import { loadLookups, toBill } from "@/lib/data";
import { addDays, daysInMonth, formatExtenso, mesNome, parseYMD, shiftMonth, todayInSP, toYMD } from "@/lib/dates";
import BillRow from "@/components/BillRow";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Bill } from "@/lib/types";

const MAX_OFFSET = 12;

function ymKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m: mParam } = await searchParams;
  const sb = await createClient();
  const today = todayInSP();
  const cur = parseYMD(today);

  let y = cur.y;
  let m = cur.m;
  const match = mParam ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mParam) : null;
  if (match) {
    y = Number(match[1]);
    m = Number(match[2]);
  }
  let offset = y * 12 + m - (cur.y * 12 + cur.m);
  if (Math.abs(offset) > MAX_OFFSET) {
    y = cur.y;
    m = cur.m;
    offset = 0;
  }
  const isCurrent = offset === 0;

  const monthStart = toYMD(y, m, 1);
  const monthEnd = toYMD(y, m, daysInMonth(y, m));
  const prev = shiftMonth(y, m, -1);
  const next = shiftMonth(y, m, 1);
  const hrefFor = (p: { y: number; m: number }) =>
    p.y === cur.y && p.m === cur.m ? "/" : `/?m=${ymKey(p.y, p.m)}`;

  const lk = await loadLookups(sb);
  let pending: Bill[];
  let paidBills: Bill[] = [];
  let paid: number;

  if (isCurrent) {
    const [pendingRes, paidRes] = await Promise.all([
      sb.from("bills").select("*").eq("status", "pending").lte("due_date", monthEnd).order("due_date"),
      sb.from("bills").select("amount,interest").eq("status", "paid").gte("due_date", monthStart).lte("due_date", monthEnd),
    ]);
    pending = (pendingRes.data ?? []).map(toBill);
    paid = (paidRes.data ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0) + Number(r.interest ?? 0), 0);
  } else {
    const { data } = await sb
      .from("bills").select("*").gte("due_date", monthStart).lte("due_date", monthEnd).order("due_date");
    const all = (data ?? []).map(toBill);
    pending = all.filter((b) => b.status === "pending");
    paidBills = all.filter((b) => b.status === "paid");
    paid = paidBills.reduce((acc, b) => acc + (b.amount ?? 0) + b.interest, 0);
  }

  // Último valor pago de cada despesa, para mostrar como referência nas contas de valor variável.
  const lastPaid = new Map<string, number>();
  const unknownIds = Array.from(new Set(pending.filter((b) => b.amount === null).map((b) => b.expense_id)));
  if (unknownIds.length > 0) {
    const { data: lastRows } = await sb
      .from("bills").select("expense_id,amount,due_date").in("expense_id", unknownIds).eq("status", "paid")
      .not("amount", "is", null).order("due_date", { ascending: false });
    for (const r of lastRows ?? []) {
      if (!lastPaid.has(r.expense_id as string)) lastPaid.set(r.expense_id as string, Number(r.amount));
    }
  }

  const inMonth = pending.filter((b) => b.due_date <= monthEnd);
  const toPay = inMonth.reduce((acc, b) => acc + (b.amount ?? 0), 0);
  const unknown = inMonth.filter((b) => b.amount === null);
  const total = paid + toPay;

  const tomorrow = addDays(today, 1);
  const groups = isCurrent
    ? [
        { label: "Atrasadas", late: true, items: pending.filter((b) => b.due_date < today) },
        { label: "Hoje", late: false, items: pending.filter((b) => b.due_date === today) },
        { label: "Amanhã", late: false, items: pending.filter((b) => b.due_date === tomorrow) },
        { label: "Próximas", late: false, items: pending.filter((b) => b.due_date > tomorrow && b.due_date <= monthEnd) },
      ]
    : [
        { label: "A pagar", late: false, items: pending },
        { label: "Pagas", late: false, items: paidBills },
      ];
  const shown = groups.filter((g) => g.items.length > 0);

  const unknownNames = unknown
    .map((b) => lk.expenses.get(b.expense_id)?.name)
    .filter(Boolean)
    .slice(0, 2)
    .join(" e ");

  const nome = mesNome(m).charAt(0).toUpperCase() + mesNome(m).slice(1);
  const title = y === cur.y ? nome : `${nome} ${y}`;

  return (
    <div className="stack">
      <div className="month-nav">
        {offset > -MAX_OFFSET ? (
          <Link href={hrefFor(prev)} aria-label="Mês anterior">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </Link>
        ) : <span className="off" />}
        <div className="stack-sm" style={{ textAlign: "center", gap: 2 }}>
          <div className="muted">{isCurrent ? formatExtenso(today) : offset > 0 ? "Mês futuro" : "Mês passado"}</div>
          <h1>{title}</h1>
        </div>
        {offset < MAX_OFFSET ? (
          <Link href={hrefFor(next)} aria-label="Próximo mês">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </Link>
        ) : <span className="off" />}
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
        {shown.length === 0 && (
          <p className="empty">
            {isCurrent
              ? "Nada pendente neste mês. Toque no + para cadastrar uma despesa."
              : "Nenhuma conta neste mês."}
          </p>
        )}
        {shown.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <div className={`group-label ${g.late ? "late" : ""}`}>{g.label}</div>
            {g.items.map((b) => (
              <BillRow key={b.id} bill={b} lk={lk} today={today} last={lastPaid.get(b.expense_id)} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
