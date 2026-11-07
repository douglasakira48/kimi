import Link from "next/link";
import BillRow from "@/components/BillRow";
import { loadLookups, toBill } from "@/lib/data";
import {
  addDays, daysInMonth, formatCurto, formatExtenso, mesNome, parseYMD, shiftMonth, todayInSP, toYMD, weekday, type YMD,
} from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Bill } from "@/lib/types";

type View = "dia" | "semana" | "mes";
const VIEWS: { id: View; label: string }[] = [
  { id: "dia", label: "Dia" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
];
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function sum(bills: Bill[], paid: boolean): number {
  return bills
    .filter((b) => (b.status === "paid") === paid)
    .reduce((acc, b) => acc + (b.amount ?? 0) + (paid ? b.interest : 0), 0);
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string }> }) {
  const { v, d } = await searchParams;
  const today = todayInSP();
  const view: View = v === "semana" || v === "mes" ? v : "dia";
  const ref: YMD = d && YMD_RE.test(d) ? d : today;
  const r = parseYMD(ref);

  let start: YMD;
  let end: YMD;
  let prev: YMD;
  let next: YMD;
  let title: string;
  if (view === "dia") {
    start = end = ref;
    prev = addDays(ref, -1);
    next = addDays(ref, 1);
    title = formatExtenso(ref);
  } else if (view === "semana") {
    start = addDays(ref, -weekday(ref));
    end = addDays(start, 6);
    prev = addDays(ref, -7);
    next = addDays(ref, 7);
    title = `${formatCurto(start)} a ${formatCurto(end)}`;
  } else {
    start = toYMD(r.y, r.m, 1);
    end = toYMD(r.y, r.m, daysInMonth(r.y, r.m));
    const p = shiftMonth(r.y, r.m, -1);
    const n = shiftMonth(r.y, r.m, 1);
    prev = toYMD(p.y, p.m, 1);
    next = toYMD(n.y, n.m, 1);
    title = `${mesNome(r.m).charAt(0).toUpperCase()}${mesNome(r.m).slice(1)} ${r.y}`;
  }

  const sb = await createClient();
  const [{ data }, lk] = await Promise.all([
    sb.from("bills").select("*").gte("due_date", start).lte("due_date", end).order("due_date"),
    loadLookups(sb),
  ]);
  const bills = (data ?? []).map(toBill);

  const byDay = new Map<string, Bill[]>();
  for (const b of bills) {
    byDay.set(b.due_date, [...(byDay.get(b.due_date) ?? []), b]);
  }

  const href = (nv: View, nd: YMD) => `/agenda?v=${nv}&d=${nd}`;
  const showToday = today < start || today > end;

  // Último valor pago de cada despesa de valor variável (referência)
  const lastPaid = new Map<string, number>();
  const unknownIds = Array.from(new Set(bills.filter((b) => b.status === "pending" && b.amount === null).map((b) => b.expense_id)));
  if (unknownIds.length > 0) {
    const { data: lastRows } = await sb
      .from("bills").select("expense_id,amount,due_date").in("expense_id", unknownIds).eq("status", "paid")
      .not("amount", "is", null).order("due_date", { ascending: false });
    for (const row of lastRows ?? []) {
      if (!lastPaid.has(row.expense_id as string)) lastPaid.set(row.expense_id as string, Number(row.amount));
    }
  }

  const rows = (list: Bill[]) =>
    list.map((b) => <BillRow key={b.id} bill={b} lk={lk} today={today} last={lastPaid.get(b.expense_id)} />);

  // Calendário do mês
  const cells: (YMD | null)[] = [];
  if (view === "mes") {
    for (let i = 0; i < weekday(start); i++) cells.push(null);
    for (let day = 1; day <= daysInMonth(r.y, r.m); day++) cells.push(toYMD(r.y, r.m, day));
  }

  return (
    <div className="stack">
      <h1>Agenda</h1>

      <div className="segment" role="group" aria-label="Visualização">
        {VIEWS.map((o) => (
          <Link key={o.id} href={href(o.id, ref)} className={view === o.id ? "on" : ""} aria-current={view === o.id ? "page" : undefined}>
            {o.label}
          </Link>
        ))}
      </div>

      <div className="month-nav">
        <Link href={href(view, prev)} aria-label="Anterior">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <div className="stack-sm" style={{ textAlign: "center", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
          {showToday && <Link href={href(view, today)} className="chip-ask" style={{ alignSelf: "center" }}>Ir para hoje</Link>}
        </div>
        <Link href={href(view, next)} aria-label="Próximo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>

      <div className="row-between small num">
        <span>A pagar {formatBRL(sum(bills, false))}</span>
        <span>Pago {formatBRL(sum(bills, true))}</span>
      </div>

      {view === "mes" && (
        <div className="cal" role="grid" aria-label={title}>
          {["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => (
            <div key={i} className="cal-h">{l}</div>
          ))}
          {cells.map((c, i) => {
            if (!c) return <div key={`e${i}`} className="cal-d off" />;
            const list = byDay.get(c) ?? [];
            return (
              <Link key={c} href={href("dia", c)} className={`cal-d ${c === today ? "today" : ""}`} aria-label={`${formatExtenso(c)}, ${list.length} contas`}>
                {parseYMD(c).d}
                <span className="dots">
                  {list.slice(0, 3).map((b) => (
                    <i key={b.id} className={b.status === "paid" ? "ok" : b.due_date < today ? "late" : ""} />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {view === "dia" && (
        <div>
          {bills.length === 0 && <p className="empty">Nenhuma conta neste dia.</p>}
          {rows(bills)}
        </div>
      )}

      {view === "semana" && (
        <div>
          {bills.length === 0 && <p className="empty">Nenhuma conta nesta semana.</p>}
          {Array.from({ length: 7 }, (_, i) => addDays(start, i))
            .filter((day) => byDay.has(day))
            .map((day) => {
              const list = byDay.get(day)!;
              return (
                <section key={day} aria-label={formatCurto(day)}>
                  <div className="day-head">
                    <Link href={href("dia", day)}>{day === today ? `Hoje, ${formatCurto(day)}` : formatCurto(day)}</Link>
                    <span className="num">{formatBRL(sum(list, false) + sum(list, true))}</span>
                  </div>
                  {rows(list)}
                </section>
              );
            })}
        </div>
      )}

      {view === "mes" && bills.length === 0 && <p className="empty">Nenhuma conta neste mês.</p>}
    </div>
  );
}
