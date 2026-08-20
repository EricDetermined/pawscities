-- 023_outbound_clicks.sql
--
-- WHY
-- ---
-- Paw Cities is a directory: the page highlights an event, then the visitor
-- leaves for the organiser's own site. That outbound click IS the moment we
-- delivered value — and until now it was completely unmeasured. A visitor who
-- found the Ekka page, got exactly what they needed, and clicked through to
-- the organiser was indistinguishable in our data from one who bounced.
--
-- That gap mattered more than it sounds. GA4 told us organic search is 62% of
-- traffic and that Instagram visitors leave after ~5 seconds, but it could not
-- tell us whether a single one of those visits succeeded.
--
-- WHY NOT JUST GA4
-- ----------------
-- GA4 gets the same click as event_external_click (one event name, identity in
-- parameters). But GA4 caps key events at 30 per property and folds dimensions
-- with >500 daily unique values into an "(other)" row. With 327 events and
-- growing, per-event detail is exactly the thing GA4 handles worst.
--
-- So: GA4 for the aggregate trend and channel attribution, this table for
-- "which specific events actually send people onward" — where we own the data
-- and can join straight to events, cities and establishments.
--
-- PRIVACY
-- -------
-- Deliberately NO ip address, user id, session id, user agent string or full
-- referrer URL. This table answers "which events convert", not "who clicked".
-- Everything here is aggregate-safe by construction rather than by policy.

CREATE TABLE IF NOT EXISTS outbound_clicks (
  id            BIGSERIAL PRIMARY KEY,

  -- What was clicked. event_slug is kept as TEXT rather than a FK to events(id)
  -- so a click record survives the event being deleted or re-slugged; losing
  -- the historical signal to a cascade would defeat the purpose.
  event_slug    TEXT        NOT NULL,
  event_id      UUID,
  city_slug     TEXT,

  -- 'tickets'   -> external_url, the primary conversion
  -- 'instagram' -> organiser's profile
  -- 'maps'      -> venue directions
  link_type     VARCHAR(20) NOT NULL,

  -- Destination HOST only (eventbrite.com), never the full URL with its query
  -- string, which can carry tracking and personal parameters.
  dest_host     TEXT,

  -- State of the event at click time, so we can answer whether dead pages
  -- still send people somewhere useful — the thing the 404 fix was for.
  event_state   VARCHAR(12),

  -- Coarse channel bucket ('organic','instagram','direct','other'). Bucketed
  -- at write time rather than storing the referrer, to keep this non-identifying.
  channel       VARCHAR(20),

  clicked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_slug
  ON outbound_clicks(event_slug, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_city
  ON outbound_clicks(city_slug, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_time
  ON outbound_clicks(clicked_at DESC);

ALTER TABLE outbound_clicks ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only. The public API route is the sole writer and
-- it validates input before inserting, so the anon key never touches this.

-- Which events actually send people onward, last 30 days.
-- This is the question the nightly brief should be asking instead of counting
-- how many events we published.
CREATE OR REPLACE VIEW event_outbound_performance AS
SELECT
  oc.event_slug,
  oc.city_slug,
  COUNT(*)                                            AS clicks,
  COUNT(*) FILTER (WHERE oc.link_type = 'tickets')    AS ticket_clicks,
  COUNT(*) FILTER (WHERE oc.event_state <> 'live')    AS clicks_on_dead_pages,
  MAX(oc.clicked_at)                                  AS last_click
FROM outbound_clicks oc
WHERE oc.clicked_at > now() - INTERVAL '30 days'
GROUP BY oc.event_slug, oc.city_slug
ORDER BY clicks DESC;

COMMENT ON TABLE outbound_clicks IS
  'Clicks from an event page out to the organiser. The success metric for a '
  'directory site. Intentionally stores no IP, user agent, session or full '
  'referrer — aggregate analysis only.';

COMMENT ON COLUMN outbound_clicks.event_state IS
  'live | cancelled | past at the moment of the click. Lets us verify whether '
  'the cancelled-page fix (which turned 76 404s into 200s) actually routes '
  'people onward rather than just serving them a tombstone.';
