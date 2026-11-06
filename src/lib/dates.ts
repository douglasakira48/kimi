// Todas as datas do app são texto "AAAA-MM-DD" (sem fuso), para não haver erro de horário.
export type YMD = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toYMD(y: number, m: number, d: number): YMD {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseYMD(s: YMD): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(y: number, m: number, n: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** Dia do mês pedido, ou o último dia do mês quando ele não existe (ex.: dia 31 em abril). */
export function dayInMonth(y: number, m: number, d: number): YMD {
  return toYMD(y, m, Math.min(d, daysInMonth(y, m)));
}

export function addDays(s: YMD, n: number): YMD {
  const { y, m, d } = parseYMD(s);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return toYMD(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function weekday(s: YMD): number {
  const { y, m, d } = parseYMD(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
}

export function monthKey(s: YMD): string {
  return s.slice(0, 7); // "AAAA-MM"
}

export function todayInSP(now: Date = new Date()): YMD {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Domingo de Páscoa (algoritmo gregoriano anônimo). */
function easter(y: number): YMD {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return toYMD(y, month, day);
}

const holidayCache = new Map<number, Set<YMD>>();

/** Feriados nacionais. Carnaval e Corpus Christi não entram (são pontos facultativos). */
export function nationalHolidays(y: number): Set<YMD> {
  const cached = holidayCache.get(y);
  if (cached) return cached;
  const set = new Set<YMD>([
    toYMD(y, 1, 1),
    addDays(easter(y), -2), // Sexta-feira Santa
    toYMD(y, 4, 21),
    toYMD(y, 5, 1),
    toYMD(y, 9, 7),
    toYMD(y, 10, 12),
    toYMD(y, 11, 2),
    toYMD(y, 11, 15),
    toYMD(y, 12, 25),
  ]);
  if (y >= 2024) set.add(toYMD(y, 11, 20)); // Consciência Negra
  holidayCache.set(y, set);
  return set;
}

/** Dia útil = segunda a sexta, fora feriado nacional. */
export function isBusinessDay(s: YMD): boolean {
  const w = weekday(s);
  if (w === 0 || w === 6) return false;
  return !nationalHolidays(parseYMD(s).y).has(s);
}

/** N-ésimo dia útil do mês (1 = primeiro). */
export function nthBusinessDay(y: number, m: number, n: number): YMD {
  let count = 0;
  const last = daysInMonth(y, m);
  for (let d = 1; d <= last; d++) {
    const s = toYMD(y, m, d);
    if (isBusinessDay(s)) {
      count++;
      if (count === n) return s;
    }
  }
  // Mês com menos dias úteis que o pedido: usa o último dia útil.
  for (let d = last; d >= 1; d--) {
    const s = toYMD(y, m, d);
    if (isBusinessDay(s)) return s;
  }
  return toYMD(y, m, last);
}

/**
 * Vencimento da fatura em que uma compra cai.
 * Compra no dia do fechamento ou depois entra na fatura seguinte.
 */
export function cardDueDate(purchase: YMD, closingDay: number, dueDay: number): YMD {
  const { y, m, d } = parseYMD(purchase);
  const closing = Math.min(closingDay, daysInMonth(y, m));
  const invoice = d >= closing ? shiftMonth(y, m, 1) : { y, m };
  const dueMonth = dueDay > closingDay ? invoice : shiftMonth(invoice.y, invoice.m, 1);
  return dayInMonth(dueMonth.y, dueMonth.m, dueDay);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function mesNome(m: number): string {
  return MESES[m - 1];
}

export function formatCurto(s: YMD): string {
  const { m, d } = parseYMD(s);
  return `${DIAS_CURTOS[weekday(s)]} ${d} ${MESES_CURTOS[m - 1]}`;
}

const DIAS_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** "Sexta, 6 de novembro" */
export function formatExtenso(s: YMD): string {
  const { m, d } = parseYMD(s);
  return `${DIAS_LONGOS[weekday(s)]}, ${d} de ${MESES[m - 1]}`;
}

export function formatData(s: YMD): string {
  const { y, m, d } = parseYMD(s);
  return `${d} ${MESES_CURTOS[m - 1]} ${y}`;
}

export function formatMes(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MESES[m - 1].charAt(0).toUpperCase()}${MESES[m - 1].slice(1)} ${y}`;
}
