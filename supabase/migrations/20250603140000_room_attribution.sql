-- Room pick attribution: who picked what (multi-pick per set, display names).

alter table public.festival_rooms
  add column if not exists members jsonb not null default '{}'::jsonb
    check (jsonb_typeof(members) = 'object'),
  add column if not exists picks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(picks) = 'array');

create or replace function public.sanitize_member_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  cleaned := regexp_replace(trim(p_name), '[[:cntrl:]]', '', 'g');
  if char_length(cleaned) < 2 or char_length(cleaned) > 24 then
    raise exception 'display name must be 2-24 characters';
  end if;
  return cleaned;
end;
$$;

drop function if exists public.toggle_pick(text, text);
drop function if exists public.set_room_ids(text, jsonb);

create or replace function public.upsert_member(
  p_code text,
  p_member_id text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  name text;
  next_members jsonb;
begin
  if p_code is null or char_length(trim(p_code)) < 6 then
    raise exception 'invalid room code';
  end if;
  if p_member_id is null or char_length(trim(p_member_id)) = 0 then
    raise exception 'invalid member id';
  end if;

  name := public.sanitize_member_name(p_display_name);

  select members into next_members
  from public.festival_rooms
  where code = trim(p_code)
  for update;

  if not found then
    raise exception 'room not found';
  end if;

  next_members := coalesce(next_members, '{}'::jsonb)
    || jsonb_build_object(trim(p_member_id), name);

  update public.festival_rooms
  set members = next_members, updated_at = now()
  where code = trim(p_code);

  return next_members;
end;
$$;

create or replace function public.toggle_pick(
  p_code text,
  p_set_id text,
  p_member_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_picks jsonb;
  next_picks jsonb;
  max_picks constant int := 500;
  pick_exists boolean;
begin
  if p_code is null or char_length(trim(p_code)) < 6 then
    raise exception 'invalid room code';
  end if;
  if p_set_id is null or char_length(trim(p_set_id)) = 0 then
    raise exception 'invalid set id';
  end if;
  if p_member_id is null or char_length(trim(p_member_id)) = 0 then
    raise exception 'invalid member id';
  end if;

  select picks into current_picks
  from public.festival_rooms
  where code = trim(p_code)
  for update;

  if not found then
    raise exception 'room not found';
  end if;

  current_picks := coalesce(current_picks, '[]'::jsonb);

  pick_exists := exists (
    select 1
    from jsonb_array_elements(current_picks) as elem
    where elem->>'set_id' = p_set_id and elem->>'member_id' = trim(p_member_id)
  );

  if pick_exists then
    next_picks := (
      select coalesce(jsonb_agg(elem order by elem->>'set_id', elem->>'member_id'), '[]'::jsonb)
      from jsonb_array_elements(current_picks) as elem
      where not (elem->>'set_id' = p_set_id and elem->>'member_id' = trim(p_member_id))
    );
  else
    if jsonb_array_length(current_picks) >= max_picks then
      raise exception 'room pick limit reached';
    end if;
    next_picks := current_picks || jsonb_build_array(
      jsonb_build_object('set_id', p_set_id, 'member_id', trim(p_member_id))
    );
  end if;

  update public.festival_rooms
  set picks = next_picks, updated_at = now()
  where code = trim(p_code);

  return next_picks;
end;
$$;

create or replace function public.clear_member_picks(p_code text, p_member_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_picks jsonb;
  next_picks jsonb;
begin
  if p_code is null or char_length(trim(p_code)) < 6 then
    raise exception 'invalid room code';
  end if;
  if p_member_id is null or char_length(trim(p_member_id)) = 0 then
    raise exception 'invalid member id';
  end if;

  select picks into current_picks
  from public.festival_rooms
  where code = trim(p_code)
  for update;

  if not found then
    raise exception 'room not found';
  end if;

  next_picks := (
    select coalesce(jsonb_agg(elem order by elem->>'set_id', elem->>'member_id'), '[]'::jsonb)
    from jsonb_array_elements(coalesce(current_picks, '[]'::jsonb)) as elem
    where elem->>'member_id' <> trim(p_member_id)
  );

  update public.festival_rooms
  set picks = next_picks, updated_at = now()
  where code = trim(p_code);

  return next_picks;
end;
$$;

create or replace function public.set_member_picks(
  p_code text,
  p_member_id text,
  p_set_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_picks jsonb;
  next_picks jsonb;
  cleaned_ids jsonb;
  max_picks constant int := 500;
begin
  if p_code is null or char_length(trim(p_code)) < 6 then
    raise exception 'invalid room code';
  end if;
  if p_member_id is null or char_length(trim(p_member_id)) = 0 then
    raise exception 'invalid member id';
  end if;
  if p_set_ids is null or jsonb_typeof(p_set_ids) <> 'array' then
    raise exception 'set ids must be a json array';
  end if;

  select coalesce(
    jsonb_agg(distinct elem order by elem),
    '[]'::jsonb
  )
  into cleaned_ids
  from jsonb_array_elements_text(p_set_ids) as elem
  where elem is not null and char_length(elem) > 0;

  select picks into current_picks
  from public.festival_rooms
  where code = trim(p_code)
  for update;

  if not found then
    raise exception 'room not found';
  end if;

  current_picks := coalesce(current_picks, '[]'::jsonb);

  next_picks := (
    select coalesce(jsonb_agg(elem order by elem->>'set_id', elem->>'member_id'), '[]'::jsonb)
    from jsonb_array_elements(current_picks) as elem
    where elem->>'member_id' <> trim(p_member_id)
  );

  if jsonb_array_length(next_picks) + jsonb_array_length(cleaned_ids) > max_picks then
    raise exception 'room pick limit reached';
  end if;

  next_picks := next_picks || (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('set_id', elem, 'member_id', trim(p_member_id))
        order by elem
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements_text(cleaned_ids) as elem
  );

  update public.festival_rooms
  set picks = next_picks, updated_at = now()
  where code = trim(p_code);

  return next_picks;
end;
$$;

grant execute on function public.upsert_member(text, text, text) to anon, authenticated;
grant execute on function public.toggle_pick(text, text, text) to anon, authenticated;
grant execute on function public.clear_member_picks(text, text) to anon, authenticated;
grant execute on function public.set_member_picks(text, text, jsonb) to anon, authenticated;
