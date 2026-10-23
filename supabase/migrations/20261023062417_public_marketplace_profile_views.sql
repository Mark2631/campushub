-- Keep seller/business decoration available to public marketplace clients
-- through a deliberately narrow public-safe projection. Do not expose private
-- profile columns or unmasked phone numbers through these views.
begin;

drop view if exists public.marketplace_profiles;
create view public.marketplace_profiles
  with (security_invoker = false, security_barrier = true)
as
select
  p.id,
  p.full_name,
  p.avatar_url,
  null::text as phone_number,
  p.badge_type,
  p.verification_status,
  p.created_at
from public.profiles p
where coalesce(p.account_status, 'active') = 'active';

drop view if exists public.marketplace_businesses;
create view public.marketplace_businesses
  with (security_invoker = false, security_barrier = true)
as
select
  b.id,
  b.business_name,
  b.verification_status,
  b.badge_type
from public.businesses b
where coalesce(b.status, 'active') = 'active';

comment on view public.marketplace_profiles is
  'Public-safe seller projection only. Phone number is intentionally masked.';
comment on view public.marketplace_businesses is
  'Public-safe business projection restricted to active business records.';

revoke all on public.marketplace_profiles from public;
revoke all on public.marketplace_businesses from public;
grant select on public.marketplace_profiles to anon, authenticated;
grant select on public.marketplace_businesses to anon, authenticated;

notify pgrst, 'reload schema';
commit;
