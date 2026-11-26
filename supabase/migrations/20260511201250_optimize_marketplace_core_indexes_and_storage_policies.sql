-- CampusTrader performance and upload stability migration
-- Adds missing indexes for active marketplace flows and ensures storage buckets/policies exist.

create index if not exists businesses_owner_id_idx on public.businesses(owner_id);
create index if not exists businesses_user_id_idx on public.businesses(user_id);
create index if not exists businesses_status_idx on public.businesses(status);
create index if not exists businesses_verification_status_idx on public.businesses(verification_status);

create index if not exists listings_user_id_idx on public.listings(user_id);
create index if not exists listings_seller_id_idx on public.listings(seller_id);
create index if not exists listings_business_id_idx on public.listings(business_id);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_category_idx on public.listings(category);
create index if not exists listings_created_at_idx on public.listings(created_at desc);
create index if not exists listings_hidden_by_idx on public.listings(hidden_by);
create index if not exists listings_deleted_by_idx on public.listings(deleted_by);

create index if not exists conversations_buyer_id_idx on public.conversations(buyer_id);
create index if not exists conversations_seller_id_idx on public.conversations(seller_id);
create index if not exists conversations_listing_id_idx on public.conversations(listing_id);
create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);

create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists messages_created_at_idx on public.messages(created_at asc);

create index if not exists verification_requests_user_id_idx on public.verification_requests(user_id);
create index if not exists verification_requests_business_id_idx on public.verification_requests(business_id);
create index if not exists verification_requests_status_idx on public.verification_requests(status);
create index if not exists verification_requests_reviewed_by_idx on public.verification_requests(reviewed_by);
create index if not exists verification_requests_created_at_idx on public.verification_requests(created_at desc);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(read);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

create index if not exists reports_reporter_id_idx on public.reports(reporter_id);
create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_created_at_idx on public.reports(created_at desc);

create index if not exists complaints_user_id_idx on public.complaints(user_id);
create index if not exists complaints_status_idx on public.complaints(status);

create index if not exists item_requests_user_id_idx on public.item_requests(user_id);
create index if not exists item_requests_status_idx on public.item_requests(status);
create index if not exists item_requests_category_idx on public.item_requests(category);

create index if not exists admin_actions_admin_id_idx on public.admin_actions(admin_id);
create index if not exists admin_actions_target_user_id_idx on public.admin_actions(target_user_id);
create index if not exists admin_actions_target_listing_id_idx on public.admin_actions(target_listing_id);
create index if not exists admin_actions_target_business_id_idx on public.admin_actions(target_business_id);
create index if not exists admin_actions_created_at_idx on public.admin_actions(created_at desc);

-- Backward compatibility: frontend should use messages.content, but legacy body should not block inserts.
alter table public.messages alter column body drop not null;
update public.messages set content = body where content is null and body is not null;

-- Ensure media buckets exist and are public for URL display.
insert into storage.buckets (id, name, public)
values
  ('listing-media', 'listing-media', true),
  ('profile-media', 'profile-media', true),
  ('verification-media', 'verification-media', true)
on conflict (id) do update set public = true;

-- Clean duplicate bucket policies before recreating simple policies.
drop policy if exists "Public can view listing media" on storage.objects;
drop policy if exists "Authenticated users can upload listing media" on storage.objects;
drop policy if exists "Users can update listing media" on storage.objects;
drop policy if exists "Users can delete listing media" on storage.objects;
drop policy if exists "Public can view profile media" on storage.objects;
drop policy if exists "Authenticated users can upload profile media" on storage.objects;
drop policy if exists "Users can update profile media" on storage.objects;
drop policy if exists "Users can delete profile media" on storage.objects;
drop policy if exists "Users can upload verification media" on storage.objects;
drop policy if exists "Users can view verification media" on storage.objects;
drop policy if exists "Users can update verification media" on storage.objects;
drop policy if exists "Users can delete verification media" on storage.objects;

create policy "Public can view listing media"
on storage.objects for select
to public
using (bucket_id = 'listing-media');

create policy "Authenticated users can upload listing media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'listing-media');

create policy "Users can update listing media"
on storage.objects for update
to authenticated
using (bucket_id = 'listing-media')
with check (bucket_id = 'listing-media');

create policy "Users can delete listing media"
on storage.objects for delete
to authenticated
using (bucket_id = 'listing-media');

create policy "Public can view profile media"
on storage.objects for select
to public
using (bucket_id = 'profile-media');

create policy "Authenticated users can upload profile media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'profile-media');

create policy "Users can update profile media"
on storage.objects for update
to authenticated
using (bucket_id = 'profile-media')
with check (bucket_id = 'profile-media');

create policy "Users can delete profile media"
on storage.objects for delete
to authenticated
using (bucket_id = 'profile-media');

create policy "Users can upload verification media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'verification-media');

create policy "Users can view verification media"
on storage.objects for select
to authenticated
using (bucket_id = 'verification-media');

create policy "Users can update verification media"
on storage.objects for update
to authenticated
using (bucket_id = 'verification-media')
with check (bucket_id = 'verification-media');

create policy "Users can delete verification media"
on storage.objects for delete
to authenticated
using (bucket_id = 'verification-media');
