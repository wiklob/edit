-- Backfill existing auth users into public.users
insert into public.users (id, email, name, avatar_url)
select id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;
