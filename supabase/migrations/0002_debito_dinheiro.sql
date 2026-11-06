-- Novas formas de pagamento: débito e dinheiro (já aplicado no projeto Supabase).
alter table public.expenses drop constraint expenses_payment_method_check;
alter table public.expenses add constraint expenses_payment_method_check
  check (payment_method in ('pix', 'boleto', 'card', 'debit', 'cash'));
