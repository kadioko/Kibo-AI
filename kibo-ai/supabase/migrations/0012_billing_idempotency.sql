-- Stripe retries the same webhook until it receives a successful response.
-- Keep one credit entry per Checkout Session so retries cannot mint credits.
delete from public.credit_ledger
where id in (
  select id from (
    select id, row_number() over (partition by reason order by created_at, id) as duplicate_number
    from public.credit_ledger
    where reason like 'stripe:%'
  ) duplicates
  where duplicate_number > 1
);

create unique index if not exists credit_ledger_stripe_session_unique
  on public.credit_ledger (reason)
  where reason like 'stripe:%';
