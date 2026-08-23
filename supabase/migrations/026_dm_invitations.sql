-- 026: DM invitation tracking (2026-08-23)
--
-- WHY: business-invitation DMs started 2026-08-22 (warm-first, cap 8/day,
-- sent via browser sessions). Sends were logged only in the local file
-- data/engagement/dm-invitations-log.json — invisible to the nightly brief,
-- the digest, and the analytics dashboard. This table is the cloud record of
-- who we invited, when, on what basis, and whether they replied/claimed.
--
-- The local file stays the posting-side source of truth (same pattern as
-- comment-queue.json -> engagement_queue); the nightly sweep upserts here.

create table if not exists dm_invitations (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,          -- instagram username, no @
  venue_name text,
  city text,                            -- hyphenated slug
  event_name text,                      -- the event that motivated the invite
  tier text,                            -- warm-replied | warm-mutual | warm-recent | cold
  message_text text,
  sent_at timestamptz not null,
  replied boolean default false,
  replied_at timestamptz,
  reply_text text,
  claimed_listing boolean default false, -- did they claim on pawcities.com
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dm_invitations_city_idx on dm_invitations (city);
create index if not exists dm_invitations_sent_idx on dm_invitations (sent_at desc);

comment on table dm_invitations is
  'Business invitation DMs sent from @thepawcities. One row per account ever DMd (unique handle = the never-DM-twice guard).';
