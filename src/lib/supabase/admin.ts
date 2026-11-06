import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave de serviço. Ignora as regras de acesso, então só pode ser usado
 * em rotas de servidor (Telegram e rotina diária), nunca em páginas de usuário.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
