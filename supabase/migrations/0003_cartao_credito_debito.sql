-- Cartão pode ser de crédito ou de débito; despesa no débito pode apontar para um cartão de débito.
alter table public.cards add column kind text not null default 'credit' check (kind in ('credit', 'debit'));

alter table public.expenses drop constraint expenses_check;
alter table public.expenses add constraint expenses_card_link_check check (
  (payment_method <> 'card' or card_id is not null)
  and (payment_method in ('card', 'debit') or card_id is null)
);
