import Link from "next/link";
import { loadLookups, toBill } from "@/lib/data";
import { daysInMonth, formatCurto, formatMes, mesNome, monthKey, parseYMD, shiftMonth, todayInSP, toYMD } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; modo?: string }>;
}) {
  const sp = await searchParams;
  const today = todayInSP();
  const nowKey = monthKey(today);
  const key = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes ?? "") ? (sp.mes as string) : nowKey;
  const modo = sp.modo === "fluxo" ? "fluxo" : "custo";

  const [y, m] = key.split("-").map(Number);
  const start = toYMD(y, m, 1);
  const end = toYMD(y, m, daysInMonth(y, m));
  const prev = shiftMonth(y, m, -1);
  const next = shiftMonth(y, m, 1);
  const prevKey = `${prev.y}-${String(prev.m).padStart(2, "0")}`;
  const nextKey = `${next.y}-${String(next.m).padStart(2, "0")}`;

  const sb = await createClient();
  const dateColumn = modo === "custo" ? "due_date" : "paid_on";
  const [paidRes, pendingRes, futureRes, lk] = await Promise.all([
    sb.from("bills").select("*").eq("status", "paid").gte(dateColumn, start).lte(dateColumn, end),
    sb.from("bills").select("*").eq("status", "pending").gte("due_date", start).lte("due_date", end),
    sb.from("bills").select("*").eq("status", "pending").gte("due_date", today).order("due_date").limit(600),
    loadLookups(sb),
  ]);

  const paid = (paidRes.data ?? []).map(toBill);
  const byCategory = new Map<string, number>();
  let interestTotal = 0;
  for (const b of paid) {
    const e = lk.expenses.get(b.expense_id);
    const cat = (e?.category_id && lk.categories.get(e.category_id)?.name) || "Sem categoria";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + (b.amount ?? 0));
    interestTotal += b.interest;
  }
  const rows = Array.from(byCategory.entries())
    .map(([name, value]) => ({ name, value, juros: false }))
    .sort((a, b) => b.value - a.value);
  if (interestTotal > 0) rows.push({ name: "Juros", value: interestTotal, juros: true });
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(...rows.map((r) => r.value), 1);

  const withInterest = paid.filter((b) => b.interest > 0).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const stillToPay = (pendingRes.data ?? []).map(toBill).reduce((s, b) => s + (b.amount ?? 0), 0);

  // Parcelas que já estão comprometidas daqui para frente
  const committed = new Map<string, { name: string; count: number; sum: number; perMonth: number; last: string }>();
  for (const b of (futureRes.data ?? []).map(toBill)) {
    const e = lk.expenses.get(b.expense_id);
    if (!e || e.recurrence !== "installment") continue;
    const cur = committed.get(e.id) ?? { name: e.name, count: 0, sum: 0, perMonth: b.amount ?? 0, last: b.due_date };
    cur.count++;
    cur.sum += b.amount ?? 0;
    cur.last = b.due_date;
    committed.set(e.id, cur);
  }

  const monthName = mesNome(m).charAt(0).toUpperCase() + mesNome(m).slice(1);
  const closed = key < nowKey;
  const href = (mes: string, mode: string) => `/painel?mes=${mes}&modo=${mode}`;

  return (
    <div className="stack">
      <div className="row-between">
        <div className="row-between" style={{ gap: 4 }}>
          <Link href={href(prevKey, modo)} className="check" aria-label="Mês anterior" style={{ marginLeft: -12 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </Link>
          <h1>{monthName}</h1>
          {key < nowKey ? (
            <Link href={href(nextKey, modo)} className="check" aria-label="Próximo mês">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </Link>
          ) : (
            <span style={{ width: 44 }} />
          )}
        </div>
        <span className="small">{closed ? "Mês fechado" : "Em andamento"}</span>
      </div>

      <div className="segment" role="group" aria-label="Como contar os gastos">
        <Link href={href(key, "custo")} className={modo === "custo" ? "on" : ""} aria-current={modo === "custo" ? "true" : undefined}>Custo do mês</Link>
        <Link href={href(key, "fluxo")} className={modo === "fluxo" ? "on" : ""} aria-current={modo === "fluxo" ? "true" : undefined}>Fluxo de caixa</Link>
      </div>

      <div className="stack-sm">
        <div className="muted">Pago em {mesNome(m)}</div>
        <div className="big-number num" style={{ fontSize: 44 }}>{formatBRL(total)}</div>
        <div className="small" style={{ lineHeight: 1.4 }}>
          {modo === "custo"
            ? "Contas pelo mês de vencimento. Só entra o que já foi pago."
            : "Pelo dia em que o dinheiro saiu da conta."}
        </div>
        {modo === "custo" && stillToPay > 0 && (
          <div className="small num">Ainda a pagar neste mês: {formatBRL(stillToPay)}</div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="empty">Nada pago em {mesNome(m)} ainda.</p>
      ) : (
        <div className="bars">
          {rows.map((r) => (
            <div key={r.name} className="stack-sm">
              <div className="bar-head">
                <span>{r.name}</span>
                <span className="num">{formatBRL(r.value)}</span>
              </div>
              <div className={`bar ${r.juros ? "juros" : ""}`} aria-hidden="true">
                <div style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {withInterest.length > 0 && (
        <section className="juros-card" aria-label="Contas pagas com juros">
          {withInterest.map((b) => {
            const e = lk.expenses.get(b.expense_id);
            return (
              <div key={b.id} className="list-row">
                <div className="stack-sm" style={{ gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{e?.name} pagou juros</span>
                  <span className="small" style={{ color: "#6b3f00" }}>
                    Venceu {formatCurto(b.due_date)}{b.paid_on ? `, paga ${formatCurto(b.paid_on)}` : ""}
                  </span>
                </div>
                <span className="num" style={{ fontWeight: 700, fontSize: 17 }}>{formatBRL(b.interest)}</span>
              </div>
            );
          })}
        </section>
      )}

      {Array.from(committed.values()).map((c) => {
        const l = parseYMD(c.last);
        return (
          <div key={c.name} className="list-row">
            <div className="stack-sm" style={{ gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{c.name}, {c.count}x restantes</span>
              <span className="small num">{formatBRL(c.perMonth)} por mês, até {formatMes(`${l.y}-${String(l.m).padStart(2, "0")}`).toLowerCase()}</span>
            </div>
            <div className="stack-sm" style={{ alignItems: "flex-end", gap: 2 }}>
              <span className="num" style={{ fontWeight: 600 }}>{formatBRL(c.sum)}</span>
              <span className="small">já comprometido</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
