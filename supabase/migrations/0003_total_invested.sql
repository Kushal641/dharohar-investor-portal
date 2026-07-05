-- The admin master sheet provides "Invested Amount" per investor directly.
-- Store it verbatim instead of deriving it from ledger rows — consistent with
-- the "calculate outside, display inside" principle.
alter table public.investor_vehicle_positions
  add column total_invested numeric(18,2);
