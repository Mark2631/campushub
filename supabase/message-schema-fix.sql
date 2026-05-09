-- CampusTrader message schema alignment
-- Safe migration to standardize messages.content

-- Ensure messages table exists before making schema changes
alter table if exists public.messages add column if not exists content text;

-- Populate new content column from legacy fields if content is still missing
update public.messages
set content = body
where content is null and body is not null;

update public.messages
set content = message
where content is null and message is not null;

update public.messages
set content = text
where content is null and text is not null;

-- If the table still has a legacy column named body or message or text and content exists, keep the old columns for compatibility.
-- After verifying the system works, you may drop legacy fields if they are no longer used.

-- If you want to drop legacy columns after migration, uncomment the following lines.
-- alter table if exists public.messages drop column if exists body;
-- alter table if exists public.messages drop column if exists message;
-- alter table if exists public.messages drop column if exists text;
