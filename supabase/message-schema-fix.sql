-- CampusTrader message schema alignment
-- Safe migration to standardize messages.content

-- Ensure messages table exists before making schema changes
alter table if exists public.messages add column if not exists content text;

-- App code reads and writes public.messages.content only.
