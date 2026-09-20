-- Reconcile Seedance 2.5 jobs created with the retired local rate.
-- The old estimator used $0.1534/s at 720p; Higgsfield's public usage rate is
-- $0.3236/s. Keep estimated_cost intact as the quote shown at submission, but
-- correct final recorded usage and any linked Kibo ledger debit.

update public.generations
set actual_cost = round((settings ->> 'duration')::numeric * 0.3236, 4)
where provider = 'higgsfield'
  and model = 'seedance-2.5'
  and status = 'completed'
  and settings ->> 'resolution' = '720p'
  and estimated_cost = round((settings ->> 'duration')::numeric * 0.1534, 4)
  and actual_cost = estimated_cost;

update public.usage_logs as usage
set cost_usd = generation.actual_cost
from public.generations as generation
where usage.generation_id = generation.id
  and generation.provider = 'higgsfield'
  and generation.model = 'seedance-2.5'
  and generation.status = 'completed'
  and generation.settings ->> 'resolution' = '720p'
  and generation.estimated_cost = round((generation.settings ->> 'duration')::numeric * 0.1534, 4)
  and generation.actual_cost = round((generation.settings ->> 'duration')::numeric * 0.3236, 4);

update public.credit_ledger as ledger
set amount = -round(generation.actual_cost, 2)
from public.generations as generation
where ledger.generation_id = generation.id
  and ledger.reason = 'generation'
  and generation.provider = 'higgsfield'
  and generation.model = 'seedance-2.5'
  and generation.status = 'completed'
  and generation.settings ->> 'resolution' = '720p'
  and generation.estimated_cost = round((generation.settings ->> 'duration')::numeric * 0.1534, 4)
  and generation.actual_cost = round((generation.settings ->> 'duration')::numeric * 0.3236, 4);

update public.team_credit_ledger as ledger
set amount = -round(generation.actual_cost, 2)
from public.generations as generation
where ledger.generation_id = generation.id
  and ledger.reason = 'generation'
  and generation.provider = 'higgsfield'
  and generation.model = 'seedance-2.5'
  and generation.status = 'completed'
  and generation.settings ->> 'resolution' = '720p'
  and generation.estimated_cost = round((generation.settings ->> 'duration')::numeric * 0.1534, 4)
  and generation.actual_cost = round((generation.settings ->> 'duration')::numeric * 0.3236, 4);
