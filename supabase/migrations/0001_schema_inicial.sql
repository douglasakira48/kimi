-- Contas da Casa: esquema inicial (já aplicado no projeto Supabase).

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nossa casa',
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at timestamptz not null default now()
);

create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null,
  telegram_chat_id bigint unique,
  created_at timestamptz not null default now()
);
create index members_household_idx on public.members(household_id);

create or replace function public.auth_household()
returns uuid
language sql stable security definer set search_path = public
as $$ select household_id from public.members where user_id = auth.uid() $$;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  unique (household_id, name),
  unique (id, household_id)
);

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  keyword text not null check (keyword = lower(keyword)),
  category_id uuid not null,
  unique (household_id, keyword),
  foreign key (category_id, household_id) references public.categories(id, household_id) on delete cascade
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

create or replace function public.limit_cards_per_household()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if (select count(*) from public.cards where household_id = new.household_id) >= 5 then
    raise exception 'Limite de 5 cartões por casa';
  end if;
  return new;
end $$;

create trigger cards_limit before insert on public.cards
  for each row execute function public.limit_cards_per_household();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  amount numeric(12,2) check (amount is null or amount >= 0),
  total_amount numeric(12,2) check (total_amount is null or total_amount >= 0),
  is_variable boolean not null default false,
  category_id uuid,
  payment_method text not null check (payment_method in ('pix', 'boleto', 'card')),
  card_id uuid,
  recurrence text not null check (recurrence in ('once', 'monthly', 'installment')),
  day_of_month smallint check (day_of_month between 1 and 31),
  business_day smallint check (business_day between 1 and 23),
  first_due_date date not null,
  installments smallint check (installments between 2 and 48),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (category_id, household_id) references public.categories(id, household_id) on delete set null (category_id),
  foreign key (card_id, household_id) references public.cards(id, household_id) on delete restrict,
  check ((payment_method = 'card') = (card_id is not null)),
  check (recurrence <> 'installment' or (installments is not null and card_id is not null)),
  check (recurrence <> 'monthly' or ((day_of_month is not null) <> (business_day is not null)))
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  expense_id uuid not null,
  due_date date not null,
  amount numeric(12,2) check (amount is null or amount >= 0),
  interest numeric(12,2) not null default 0 check (interest >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_on date,
  installment_no smallint,
  reminder_sent_at timestamptz,
  overdue_reminded_on date,
  created_at timestamptz not null default now(),
  unique (expense_id, due_date),
  foreign key (expense_id, household_id) references public.expenses(id, household_id) on delete cascade,
  check ((status = 'paid') = (paid_on is not null)),
  check (status <> 'paid' or amount is not null)
);
create index bills_household_due_idx on public.bills(household_id, due_date);
create index bills_household_paid_idx on public.bills(household_id, paid_on) where paid_on is not null;
create index expenses_household_idx on public.expenses(household_id);

create table public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

create table public.telegram_prompts (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  bill_id uuid not null references public.bills(id) on delete cascade,
  kind text not null check (kind in ('ask_amount', 'notice')),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index telegram_prompts_chat_idx on public.telegram_prompts(chat_id, created_at desc);
create index telegram_prompts_bill_idx on public.telegram_prompts(bill_id);

create or replace function public.seed_household_defaults(p_household uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.categories (household_id, name) values
    (p_household, 'Despesas fixas'), (p_household, 'Alimentação'), (p_household, 'Lazer'),
    (p_household, 'Saúde e bem-estar'), (p_household, 'Equipamentos'), (p_household, 'Transporte'),
    (p_household, 'Outros');

  insert into public.category_rules (household_id, keyword, category_id)
  select p_household, k.keyword, c.id
  from (values
    ('aluguel', 'Despesas fixas'), ('condominio', 'Despesas fixas'), ('energia', 'Despesas fixas'),
    ('luz', 'Despesas fixas'), ('agua', 'Despesas fixas'), ('internet', 'Despesas fixas'),
    ('gas', 'Despesas fixas'), ('iptu', 'Despesas fixas'), ('celular', 'Despesas fixas'),
    ('telefone', 'Despesas fixas'),
    ('comida', 'Alimentação'), ('mercado', 'Alimentação'), ('supermercado', 'Alimentação'),
    ('padaria', 'Alimentação'), ('lanche', 'Alimentação'), ('restaurante', 'Alimentação'),
    ('ifood', 'Alimentação'), ('hortifruti', 'Alimentação'), ('acougue', 'Alimentação'),
    ('pizza', 'Alimentação'),
    ('cinema', 'Lazer'), ('show', 'Lazer'), ('viagem', 'Lazer'), ('netflix', 'Lazer'),
    ('spotify', 'Lazer'), ('streaming', 'Lazer'), ('passeio', 'Lazer'),
    ('academia', 'Saúde e bem-estar'), ('saude', 'Saúde e bem-estar'),
    ('farmacia', 'Saúde e bem-estar'), ('medico', 'Saúde e bem-estar'),
    ('dentista', 'Saúde e bem-estar'), ('remedio', 'Saúde e bem-estar'),
    ('impressora', 'Equipamentos'), ('notebook', 'Equipamentos'), ('computador', 'Equipamentos'),
    ('monitor', 'Equipamentos'), ('teclado', 'Equipamentos'), ('fone', 'Equipamentos'),
    ('combustivel', 'Transporte'), ('gasolina', 'Transporte'), ('uber', 'Transporte'),
    ('estacionamento', 'Transporte'), ('ipva', 'Transporte')
  ) as k(keyword, category)
  join public.categories c on c.household_id = p_household and c.name = k.category;
end $$;

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Você já faz parte de uma casa';
  end if;
  insert into public.households (name) values (coalesce(nullif(trim(p_name), ''), 'Nossa casa'))
    returning id into v_id;
  insert into public.members (user_id, household_id, display_name)
    values (auth.uid(), v_id, coalesce(nullif(trim(p_display_name), ''), 'Eu'));
  perform public.seed_household_defaults(v_id);
  return v_id;
end $$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Você já faz parte de uma casa';
  end if;
  select id into v_id from public.households where invite_code = lower(trim(p_code));
  if v_id is null then raise exception 'Código inválido'; end if;
  if (select count(*) from public.members where household_id = v_id) >= 2 then
    raise exception 'Esta casa já tem duas pessoas';
  end if;
  insert into public.members (user_id, household_id, display_name)
    values (auth.uid(), v_id, coalesce(nullif(trim(p_display_name), ''), 'Eu'));
  return v_id;
end $$;

create or replace function public.create_telegram_link_code()
returns text
language plpgsql security definer set search_path = public
as $$
declare v_code text;
begin
  if auth.uid() is null or not exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Entre em uma casa primeiro';
  end if;
  delete from public.telegram_link_codes where user_id = auth.uid() or expires_at < now();
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.telegram_link_codes (code, user_id, expires_at)
    values (v_code, auth.uid(), now() + interval '15 minutes');
  return v_code;
end $$;

-- Permissões
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public, anon;
grant execute on function public.auth_household() to authenticated;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.create_telegram_link_code() to authenticated;
revoke execute on function public.seed_household_defaults(uuid) from public, anon, authenticated;

revoke all on public.telegram_link_codes, public.telegram_prompts from authenticated;
revoke update on public.members from authenticated;
grant update (display_name) on public.members to authenticated;

-- Acesso por casa (RLS)
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.categories enable row level security;
alter table public.category_rules enable row level security;
alter table public.cards enable row level security;
alter table public.expenses enable row level security;
alter table public.bills enable row level security;
alter table public.telegram_link_codes enable row level security;
alter table public.telegram_prompts enable row level security;

create policy households_select on public.households for select to authenticated
  using (id = (select public.auth_household()));
create policy members_select on public.members for select to authenticated
  using (household_id = (select public.auth_household()));
create policy members_update_self on public.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy categories_all on public.categories for all to authenticated
  using (household_id = (select public.auth_household())) with check (household_id = (select public.auth_household()));
create policy category_rules_all on public.category_rules for all to authenticated
  using (household_id = (select public.auth_household())) with check (household_id = (select public.auth_household()));
create policy cards_all on public.cards for all to authenticated
  using (household_id = (select public.auth_household())) with check (household_id = (select public.auth_household()));
create policy expenses_all on public.expenses for all to authenticated
  using (household_id = (select public.auth_household())) with check (household_id = (select public.auth_household()));
create policy bills_all on public.bills for all to authenticated
  using (household_id = (select public.auth_household())) with check (household_id = (select public.auth_household()));
