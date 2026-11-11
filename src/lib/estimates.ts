import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Despesa de valor variável: os meses seguintes usam o último valor informado como estimativa.
 * Só mexe em contas pendentes que ainda estão sem valor ou com valor estimado, nunca no que a pessoa informou.
 */
export async function propagateEstimate(sb: SupabaseClient, expenseId: string, afterDue: string, amount: number) {
  await sb
    .from("bills")
    .update({ amount, is_estimate: true })
    .eq("expense_id", expenseId)
    .eq("status", "pending")
    .gt("due_date", afterDue)
    .or("is_estimate.eq.true,amount.is.null");
}

/** Último valor realmente informado (pago ou digitado) de uma despesa, ou null se nunca houve. */
export async function lastKnownAmount(sb: SupabaseClient, expenseId: string): Promise<number | null> {
  const { data } = await sb
    .from("bills")
    .select("amount")
    .eq("expense_id", expenseId)
    .eq("is_estimate", false)
    .not("amount", "is", null)
    .order("due_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.amount === undefined || data?.amount === null ? null : Number(data.amount);
}
