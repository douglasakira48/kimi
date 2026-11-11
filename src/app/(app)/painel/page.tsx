import Link from "next/link";
import { loadLookups, toBill } from "@/lib/data";
import { daysInMonth, formatCurto, formatMes, mesNome, monthKey, parseYMD, shiftMonth, todayInSP, toYMD } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import VisaoFilter from "@/components/VisaoFilter";
import { monthKeys, monthlyTotals, variableSeries, type SeriesBill } from "@/lib/series";
import { filterBills, getVisao } from "@/lib/visao";
import { createClient } from "@/lib/supabase/server";

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; modo?: string }>;
}) {
  const sp = await searchParams;
  const today = todayInSP();
  const nowKey = monthKey(today);
  const cur = parseYMD(today);
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
  const histStart = shiftMonth(cur.y, cur.m, -5);
  const projEnd = shiftMonth(cur.y, cur.m, 6);
  const [paidRes, pendingRes, futureRes, lk, histRes] = await Promise.all([
    sb.from("bills").select("*").eq("status", "paid").gte(dateColumn, start).lte(dateColumn, end),
    sb.from("bills").select("*").eq("status", "pending").gte("due_date", start).lte("due_date", end),
    sb.from("bills").select("*").eq("status", "pending").gte("due_date", today).order("due_date").limit(600),
    loadLookups(sb),
    sb.from("bills").select("*")
      .gte("due_date", toYMD(histStart.y, histStart.m, 1))
      .lte("due_date", toYMD(projEnd.y, projEnd.m, daysInMonth(projEnd.y, projEnd.m)))
      .order("due_date").limit(2000),
  ]);
  const visao = await getVisao(lk);

  const paid = filterBills((paidRes.data ?? []).map(toBill), lk, visao);
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
  const stillToPay = filterBills((pendingRes.data ?? []).map(toBill), lk, visao).reduce((s, b) => s + (b.amount ?? 0), 0);

  // Parcelas que já estão comprometidas daqui para frente
  const committed = new Map<string, { name: string; count: number; sum: number; perMonth: number; last: string }>();
  for (const b of filterBills((futureRes.data ?? []).map(toBill), lk, visao)) {
    const e = lk.expenses.get(b.expense_id);
    if (!e || e.recurrence !== "installment") continue;
    const cur = committed.get(e.id) ?? { name: e.name, count: 0, sum: 0, perMonth: b.amount ?? 0, last: b.due_date };
    cur.count++;
    cur.sum += b.amount ?? 0;
    cur.last = b.due_date;
    committed.set(e.id, cur);
  }

  // Evolução: 5 meses atrás, o atual e 6 à frente (contas pelo mês de vencimento).
  const hist: SeriesBill[] = filterBills((histRes.data ?? []).map(toBill), lk, visao);
  const keys = monthKeys(`${histStart.y}-${String(histStart.m).padStart(2, "0")}`, 12);
  const points = monthlyTotals(hist, keys);
  const maxTotal = Math.max(...points.map((p) => p.paid + p.pending + p.estimate), 1);
  const MES = (k: string) => mesNome(Number(k.slice(5))).slice(0, 3);

  const variableIds = Array.from(lk.expenses.values())
    .filter((e) => e.is_variable && e.recurrence === "monthly" && (visao === "casal" || hist.some((b) => b.expense_id === e.id)))
    .map((e) => e.id);
  const varCards = variableIds
    .map((id) => ({ id, name: lk.expenses.get(id)!.name, pts: variableSeries(hist, id, keys) }))
    .filter((v) => v.pts.length > 0);

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

      <VisaoFilter members={lk.members} current={visao} />

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

      <section className="panel-card stack" style={{ gap: 12 }} aria-label="Despesa mês a mês">
        <h2>Despesa mês a mês</h2>
        <div className="evo" aria-hidden="true">
          {points.map((p) => {
            const t = p.paid + p.pending + p.estimate;
            const h = (v: number) => `${(v / maxTotal) * 100}%`;
            return (
              <div key={p.key} className={`evo-col ${p.key === nowKey ? "now" : ""}`}>
                <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }} title={`${p.key}: ${formatBRL(t)}`}>
                  <div className="seg-est" style={{ height: h(p.estimate) }} />
                  <div className="seg-pend" style={{ height: h(p.pending) }} />
                  <div className="seg-paid" style={{ height: h(p.paid) }} />
                </div>
                <div className="evo-label">{MES(p.key)}</div>
              </div>
            );
          })}
        </div>
        <div className="legend" aria-hidden="true">
          <span><i style={{ background: "var(--ok)" }} />Pago</span>
          <span><i style={{ background: "var(--accent)" }} />A pagar</span>
          <span><i style={{ background: "#c9d6f7", border: "1px dashed var(--accent)" }} />Estimado</span>
        </div>
        <details>
          <summary className="small" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Ver valores</summary>
          {points.map((p) => (
            <div key={p.key} className="row-between small num" style={{ padding: "6px 0" }}>
              <span>{formatMes(p.key)}{p.key > nowKey ? " (projeção)" : ""}</span>
              <span>{formatBRL(p.paid + p.pending + p.estimate)}</span>
            </div>
          ))}
        </details>
      </section>

      {varCards.length > 0 && (
        <section className="stack" style={{ gap: 12 }} aria-label="Contas que variam">
          <h2>Contas que variam</h2>
          {varCards.map((v) => {
            const real = v.pts.filter((p) => !p.estimate);
            const last = real[real.length - 1];
            const before = real[real.length - 2];
            const diff = last && before ? last.amount - before.amount : null;
            const vmax = Math.max(...v.pts.map((p) => p.amount), 1);
            return (
              <div key={v.id} className="panel-card stack" style={{ gap: 10 }}>
                <div className="row-between">
                  <span style={{ fontWeight: 600 }}>{v.name}</span>
                  {last && <span className="num" style={{ fontWeight: 700 }}>{formatBRL(last.amount)}</span>}
                </div>
                {diff !== null && (
                  <div className="small num">
                    {diff === 0 ? "Igual ao mês anterior" : `${diff > 0 ? "+" : "-"}${formatBRL(Math.abs(diff))} em relação ao mês anterior`}
                  </div>
                )}
                <div className="evo" style={{ height: 70 }} aria-hidden="true">
                  {keys.map((k) => {
                    const p = v.pts.find((x) => x.key === k);
                    return (
                      <div key={k} className={`evo-col ${k === nowKey ? "now" : ""}`}>
                        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }} title={p ? `${k}: ${formatBRL(p.amount)}` : k}>
                          {p && <div className={p.estimate ? "seg-est" : "seg-pend"} style={{ height: `${(p.amount / vmax) * 100}%` }} />}
                        </div>
                        <div className="evo-label">{MES(k)}</div>
                      </div>
                    );
                  })}
                </div>
                <details>
                  <summary className="small" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Ver valores</summary>
                  {v.pts.map((p) => (
                    <div key={p.key} className="row-between small num" style={{ padding: "6px 0" }}>
                      <span>{formatMes(p.key)}{p.estimate ? " (estimado)" : ""}</span>
                      <span>{formatBRL(p.amount)}</span>
                    </div>
                  ))}
                </details>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
