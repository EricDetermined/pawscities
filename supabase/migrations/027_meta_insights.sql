-- 027: Meta insights unlock (2026-08-23)
--
-- 1. app_config: small key/value store so rotating credentials (like the Meta
--    page token) can be updated at runtime without a Vercel redeploy. The
--    instagram_manage_insights re-auth produced a new never-expiring Page
--    token; crons read it from here first, env var as fallback.
-- 2. account_snapshots gains daily insight metrics now that the token has the
--    instagram_manage_insights scope (was OAuthException #10 before).

create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

comment on table app_config is
  'Runtime configuration/credentials (e.g. meta_page_token). Service-role access only.';

alter table account_snapshots add column if not exists reach_day integer;
alter table account_snapshots add column if not exists profile_views_day integer;
alter table account_snapshots add column if not exists accounts_engaged_day integer;
