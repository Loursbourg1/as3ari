-- Minimal stand-in for the parts of Supabase the migrations rely on, so the real
-- migrations can be tested in an in-process Postgres (PGlite) without Docker.
-- Mirrors Supabase behaviour: roles anon/authenticated/service_role, auth.users,
-- auth.uid() from request.jwt.claims, and Supabase's broad default privileges
-- (which the migrations must explicitly revoke).
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text unique,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create schema realtime;
create table realtime.messages (
  topic text not null,
  event text not null,
  payload jsonb not null,
  is_private boolean not null
);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void
language plpgsql
as $$ begin
  insert into realtime.messages (topic, event, payload, is_private) values (topic, event, payload, private);
end $$;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
