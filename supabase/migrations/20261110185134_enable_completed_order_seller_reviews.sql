drop policy if exists "buyers_can_review_completed_orders" on public.reviews;

create policy "buyers_can_review_completed_orders"
on public.reviews
as permissive
for insert
to authenticated
with check (
  reviewer_id = (select auth.uid())
  and reviewer_id <> seller_id
  and listing_id is not null
  and rating between 1 and 5
  and exists (
    select 1
    from public.orders o
    where o.buyer_id = (select auth.uid())
      and o.seller_id = reviews.seller_id
      and o.listing_id = reviews.listing_id
      and o.order_state = 'completed'
      and o.buyer_receipt_state = 'confirmed'
  )
);

create index if not exists reviews_seller_created_at_idx
  on public.reviews (seller_id, created_at desc);

create or replace view public.marketplace_seller_rating_summary
with (security_barrier = true)
as
select
  seller_id,
  round(avg(rating)::numeric, 1) as average_rating,
  count(*)::integer as review_count
from public.reviews
group by seller_id;

grant select on public.marketplace_seller_rating_summary to anon, authenticated;
