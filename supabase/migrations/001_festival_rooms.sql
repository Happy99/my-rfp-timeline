-- Shared festival pick rooms for my-rfp-timeline (RfP-2026).
-- Apply in Supabase SQL editor or via CLI.

create table if not exists public.festival_rooms (
  code text primary key check (char_length(code) >= 6 and char_length(code) <= 12),
  festival text not null default 'RfP-2026',
  ids jsonb not null default '[]'::jsonb check (jsonb_typeof(ids) = 'array'),
  updated_at timestamptz not null default now()
);

create index if not exists festival_rooms_updated_at_idx on public.festival_rooms (updated_at);

alter table public.festival_rooms enable row level security;

create policy "festival_rooms_select_anon"
  on public.festival_rooms for select
  to anon, authenticated
  using (true);

create policy "festival_rooms_insert_anon"
  on public.festival_rooms for insert
  to anon, authenticated
  with check (festival = 'RfP-2026');

create policy "festival_rooms_update_anon"
  on public.festival_rooms for update
  to anon, authenticated
  using (true)
  with check (festival = 'RfP-2026');

-- Atomic toggle: add or remove one set id without read-modify-write races.
create or replace function public.toggle_pick(p_code text, p_set_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_ids jsonb;
  next_ids jsonb;
  max_picks constant int := 500;
begin
  if p_code is null or char_length(trim(p_code)) < 6 then
    raise exception 'invalid room code';
  end if;
  if p_set_id is null or char_length(trim(p_set_id)) = 0 then
    raise exception 'invalid set id';
  end if;

  select ids into current_ids
  from public.festival_rooms
  where code = trim(p_code)
  for update;

  if not found then
    raise exception 'room not found';
  end if;

  if current_ids @> to_jsonb(p_set_id) then
    next_ids := (
      select coalesce(jsonb_agg(elem order by elem), '[]'::jsonb)
      from jsonb_array_elements_text(current_ids) as elem
      where elem <> p_set_id
    );
  else
    if jsonb_array_length(current_ids) >= max_picks then
      raise exception 'room pick limit reached';
    end if;
    next_ids := current_ids || to_jsonb(p_set_id);
  end if;

  update public.festival_rooms
  set ids = next_ids, updated_at = now()
  where code = trim(p_code);

  return next_ids;
end;
$$;

grant execute on function public.toggle_pick(text, text) to anon, authenticated;

-- Replace full pick list (clear, import, merge on client).
create or replace function public.set_room_ids(p_code text, p_ids jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned jsonb;
  max_picks constant int := 500;
begin
  if p_code is null or char_length(trim(p_code)) < 6 then
    raise exception 'invalid room code';
  end if;
  if p_ids is null or jsonb_typeof(p_ids) <> 'array' then
    raise exception 'ids must be a json array';
  end if;

  select coalesce(
    jsonb_agg(distinct elem order by elem),
    '[]'::jsonb
  )
  into cleaned
  from jsonb_array_elements_text(p_ids) as elem
  where elem is not null and char_length(elem) > 0;

  if jsonb_array_length(cleaned) > max_picks then
    raise exception 'room pick limit reached';
  end if;

  update public.festival_rooms
  set ids = cleaned, updated_at = now()
  where code = trim(p_code);

  if not found then
    raise exception 'room not found';
  end if;

  return cleaned;
end;
$$;

grant execute on function public.set_room_ids(text, jsonb) to anon, authenticated;

-- Realtime: broadcast row updates to subscribed clients.
alter publication supabase_realtime add table public.festival_rooms;
