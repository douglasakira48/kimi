-- Conta com valor estimado (projeção pelo último valor informado) e dono da despesa/cartão.
alter table public.bills add column is_estimate boolean not null default false;
alter table public.expenses add column owner_user_id uuid references auth.users(id) on delete set null;
alter table public.cards add column owner_user_id uuid references auth.users(id) on delete set null;
