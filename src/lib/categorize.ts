export interface CategoryRow {
  id: string;
  name: string;
}

export interface RuleRow {
  keyword: string;
  category_id: string;
}

/** Minúsculas e sem acentos, para comparar "Água" com "agua". */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Regra mais específica (palavra mais longa) que começa em alguma palavra do nome. */
export function matchRule(name: string, rules: RuleRow[]): string | null {
  const text = normalize(name);
  let best: RuleRow | null = null;
  for (const rule of rules) {
    const kw = normalize(rule.keyword);
    if (!kw) continue;
    const found = text === kw || text.startsWith(kw) || text.includes(" " + kw);
    if (found && (!best || kw.length > normalize(best.keyword).length)) best = rule;
  }
  return best ? best.category_id : null;
}

export type Suggestion = { categoryId: string | null; source: "rule" | "ai" | "none" };

/** Primeiro as regras da casa. Só se nenhuma servir, pergunta ao Gemini (enviando apenas o nome). */
export async function suggestCategory(
  name: string,
  categories: CategoryRow[],
  rules: RuleRow[],
): Promise<Suggestion> {
  const byRule = matchRule(name, rules);
  if (byRule) return { categoryId: byRule, source: "rule" };

  const key = process.env.GEMINI_API_KEY;
  if (!key || categories.length === 0 || !name.trim()) return { categoryId: null, source: "none" };

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const names = categories.map((c) => c.name);
  const prompt =
    `Classifique a despesa doméstica "${name.trim()}" em exatamente uma destas categorias: ` +
    `${names.join(", ")}. Responda só com o nome da categoria, sem mais nada.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { categoryId: null, source: "none" };
    const data = await res.json();
    const answer: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const wanted = normalize(answer.replace(/[."'*\n]/g, ""));
    const hit = categories.find((c) => normalize(c.name) === wanted);
    return hit ? { categoryId: hit.id, source: "ai" } : { categoryId: null, source: "none" };
  } catch {
    return { categoryId: null, source: "none" };
  }
}
