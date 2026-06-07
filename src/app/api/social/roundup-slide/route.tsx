import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

const BRAND_ORANGE = '#f97316';
const BRAND_DARK = '#1a1a2e';
const BRAND_DARK_LIGHTER = '#252547';

// City accent colors
const CITY_ACCENTS: Record<string, string> = {
  paris: '#2563eb',
  geneva: '#dc2626',
  london: '#7c3aed',
  barcelona: '#ea580c',
  losangeles: '#0891b2',
  newyork: '#059669',
  nyc: '#059669',
  sydney: '#0284c7',
  tokyo: '#e11d48',
};

// City display names
const CITY_NAMES: Record<string, string> = {
  paris: 'Paris',
  geneva: 'Geneva',
  london: 'London',
  barcelona: 'Barcelona',
  losangeles: 'Los Angeles',
  newyork: 'New York',
  nyc: 'New York',
  sydney: 'Sydney',
  tokyo: 'Tokyo',
};

/**
 * GET /api/social/roundup-slide
 *
 * Generates branded 1080x1080 slides for weekly event roundup carousels.
 *
 * Query params:
 *   slide     - Slide type: 'cover' | 'event' | 'cta' (required)
 *   citySlug  - City slug (required)
 *   count     - Number of events (cover slide)
 *   dateRange - e.g. "Jun 8–14" (cover slide)
 *   name      - Event name (event slide)
 *   date      - Event date display, e.g. "Sat, Jun 10" (event slide)
 *   venue     - Venue name (event slide)
 *   time      - Event time (event slide, optional)
 *   sponsor   - Sponsor/organizer handle (event slide, optional)
 *   free      - "true" if free event (event slide, optional)
 *   index     - Slide number in carousel, e.g. "3" (event slide, optional)
 *   total     - Total event count (event slide, optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slide = searchParams.get('slide') || 'cover';
  const citySlug = searchParams.get('citySlug') || 'losangeles';
  const accent = CITY_ACCENTS[citySlug] || BRAND_ORANGE;
  const cityName = CITY_NAMES[citySlug] || citySlug;

  if (slide === 'cover') {
    return renderCoverSlide(searchParams, cityName, citySlug, accent);
  } else if (slide === 'event') {
    return renderEventSlide(searchParams, cityName, citySlug, accent);
  } else {
    return renderCtaSlide(searchParams, cityName, citySlug, accent);
  }
}

// ─── Cover Slide ──────────────────────────────────────────────────────────────
// "6 Dog-Friendly Events This Week in LA" — bold branded hero

function renderCoverSlide(
  params: URLSearchParams,
  cityName: string,
  citySlug: string,
  accent: string,
) {
  const count = params.get('count') || '6';
  const dateRange = params.get('dateRange') || 'This Week';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
          background: BRAND_DARK,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '1080px', height: '10px', background: BRAND_ORANGE, display: 'flex' }} />

        {/* Large decorative paw watermarks */}
        <div style={{ position: 'absolute', top: '80px', right: '40px', fontSize: '200px', opacity: 0.06, display: 'flex' }}>🐾</div>
        <div style={{ position: 'absolute', bottom: '180px', left: '-20px', fontSize: '150px', opacity: 0.04, display: 'flex' }}>🐾</div>

        {/* Paw Cities badge */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '80px 80px 0 80px', gap: '14px' }}>
          <div style={{ display: 'flex', fontSize: '40px' }}>🐾</div>
          <div style={{ display: 'flex', color: BRAND_ORANGE, fontSize: '32px', fontWeight: 700, letterSpacing: '2px' }}>
            PAW CITIES
          </div>
        </div>

        {/* City name with accent */}
        <div style={{ display: 'flex', margin: '40px 80px 0 80px' }}>
          <div style={{ display: 'flex', background: accent, color: 'white', padding: '10px 30px', borderRadius: '8px', fontSize: '28px', fontWeight: 700, letterSpacing: '3px' }}>
            {cityName.toUpperCase()}
          </div>
        </div>

        {/* Event count — big hero number */}
        <div style={{ display: 'flex', alignItems: 'baseline', margin: '50px 80px 0 80px', gap: '20px' }}>
          <div style={{ display: 'flex', color: BRAND_ORANGE, fontSize: '140px', fontWeight: 900, lineHeight: 1 }}>
            {count}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', color: 'white', fontSize: '44px', fontWeight: 800, lineHeight: 1.2 }}>
              Dog-Friendly
            </div>
            <div style={{ display: 'flex', color: 'white', fontSize: '44px', fontWeight: 800, lineHeight: 1.2 }}>
              Events
            </div>
          </div>
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', margin: '40px 80px 0 80px', color: '#9ca3af', fontSize: '36px', fontWeight: 600 }}>
          {dateRange}
        </div>

        {/* Swipe prompt */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '50px 80px 0 80px', gap: '12px' }}>
          <div style={{ display: 'flex', color: BRAND_ORANGE, fontSize: '26px', fontWeight: 600 }}>
            Swipe to see all events →
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, width: '1080px', height: '90px',
            background: 'rgba(249, 115, 22, 0.12)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 80px',
          }}
        >
          <div style={{ display: 'flex', color: '#9ca3af', fontSize: '22px' }}>
            @thepawcities
          </div>
          <div style={{ display: 'flex', color: '#6b7280', fontSize: '20px' }}>
            pawcities.com/{citySlug}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}

// ─── Event Slide ──────────────────────────────────────────────────────────────
// Individual event card with name, date, venue, sponsor, and link

function renderEventSlide(
  params: URLSearchParams,
  cityName: string,
  citySlug: string,
  accent: string,
) {
  const name = params.get('name') || 'Dog-Friendly Event';
  const date = params.get('date') || 'Coming Soon';
  const venue = params.get('venue') || '';
  const time = params.get('time') || '';
  const sponsor = params.get('sponsor') || '';
  const isFree = params.get('free') === 'true';
  const index = params.get('index') || '';
  const total = params.get('total') || '';

  // Responsive font size based on event name length
  const nameFontSize = name.length > 50 ? '40px' : name.length > 35 ? '48px' : '56px';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
          background: BRAND_DARK,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left accent stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '8px', height: '1080px', background: accent, display: 'flex' }} />

        {/* Top right — slide counter */}
        {index && total && (
          <div style={{ position: 'absolute', top: '40px', right: '60px', display: 'flex', color: '#6b7280', fontSize: '22px', fontWeight: 600 }}>
            {index} / {total}
          </div>
        )}

        {/* Date badge */}
        <div style={{ display: 'flex', margin: '80px 80px 0 80px' }}>
          <div style={{ display: 'flex', background: BRAND_ORANGE, color: 'white', padding: '14px 32px', borderRadius: '8px', fontSize: '28px', fontWeight: 700 }}>
            📅 {date}
          </div>
          {isFree && (
            <div style={{ display: 'flex', background: '#059669', color: 'white', padding: '14px 28px', borderRadius: '8px', fontSize: '24px', fontWeight: 700, marginLeft: '16px' }}>
              FREE
            </div>
          )}
        </div>

        {/* Event name — hero text */}
        <div
          style={{
            display: 'flex', margin: '50px 80px 0 80px', color: 'white',
            fontSize: nameFontSize, fontWeight: 800, lineHeight: 1.25,
            maxWidth: '920px',
          }}
        >
          {name}
        </div>

        {/* Venue */}
        {venue && (
          <div style={{ display: 'flex', alignItems: 'center', margin: '35px 80px 0 80px', gap: '12px' }}>
            <div style={{ display: 'flex', fontSize: '28px' }}>📍</div>
            <div style={{ display: 'flex', color: '#d1d5db', fontSize: '30px', fontWeight: 600 }}>
              {venue.length > 45 ? venue.slice(0, 42) + '...' : venue}
            </div>
          </div>
        )}

        {/* Time */}
        {time && (
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 80px 0 80px', gap: '12px' }}>
            <div style={{ display: 'flex', fontSize: '28px' }}>🕐</div>
            <div style={{ display: 'flex', color: '#9ca3af', fontSize: '28px', fontWeight: 500 }}>
              {time}
            </div>
          </div>
        )}

        {/* Sponsor / Organizer */}
        {sponsor && (
          <div style={{ display: 'flex', alignItems: 'center', margin: '30px 80px 0 80px', gap: '12px' }}>
            <div style={{ display: 'flex', fontSize: '24px' }}>🏢</div>
            <div style={{ display: 'flex', color: accent, fontSize: '26px', fontWeight: 600 }}>
              @{sponsor.replace(/^@/, '')}
            </div>
          </div>
        )}

        {/* City tag */}
        <div style={{ display: 'flex', margin: '40px 80px 0 80px' }}>
          <div style={{ display: 'flex', background: BRAND_DARK_LIGHTER, border: `2px solid ${accent}`, color: accent, padding: '10px 24px', borderRadius: '30px', fontSize: '22px', fontWeight: 600, letterSpacing: '1px' }}>
            🐾 {cityName}
          </div>
        </div>

        {/* Bottom bar with link */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, width: '1080px', height: '90px',
            background: 'rgba(249, 115, 22, 0.12)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 80px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', fontSize: '24px' }}>🐾</div>
            <div style={{ display: 'flex', color: BRAND_ORANGE, fontSize: '22px', fontWeight: 700 }}>Paw Cities</div>
          </div>
          <div style={{ display: 'flex', color: '#9ca3af', fontSize: '20px' }}>
            Details → pawcities.com/{citySlug}/events
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}

// ─── CTA Slide ────────────────────────────────────────────────────────────────
// Final carousel slide — "Find all events & details" with site link

function renderCtaSlide(
  params: URLSearchParams,
  cityName: string,
  citySlug: string,
  accent: string,
) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          background: BRAND_DARK,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '1080px', height: '10px', background: BRAND_ORANGE, display: 'flex' }} />

        {/* Large watermark paws */}
        <div style={{ position: 'absolute', top: '100px', left: '60px', fontSize: '200px', opacity: 0.04, display: 'flex' }}>🐾</div>
        <div style={{ position: 'absolute', bottom: '100px', right: '60px', fontSize: '180px', opacity: 0.04, display: 'flex' }}>🐾</div>

        {/* Main icon */}
        <div style={{ display: 'flex', fontSize: '100px', marginBottom: '30px' }}>🐾</div>

        {/* Headline */}
        <div style={{ display: 'flex', color: 'white', fontSize: '52px', fontWeight: 800, textAlign: 'center', lineHeight: 1.3, maxWidth: '800px' }}>
          Want all the details?
        </div>

        {/* Sub-headline */}
        <div style={{ display: 'flex', color: '#d1d5db', fontSize: '32px', fontWeight: 500, marginTop: '20px', textAlign: 'center', maxWidth: '700px' }}>
          Dates, venues, links & more for every dog-friendly event in {cityName}
        </div>

        {/* URL button */}
        <div
          style={{
            display: 'flex', marginTop: '50px', background: BRAND_ORANGE,
            color: 'white', padding: '22px 50px', borderRadius: '16px',
            fontSize: '34px', fontWeight: 800,
          }}
        >
          pawcities.com/{citySlug}/events
        </div>

        {/* Follow CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px', gap: '10px' }}>
          <div style={{ display: 'flex', color: accent, fontSize: '28px', fontWeight: 600 }}>
            Follow @thepawcities
          </div>
          <div style={{ display: 'flex', color: '#6b7280', fontSize: '22px' }}>
            Dog-friendly events in 8 cities worldwide
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, width: '1080px', height: '90px',
            background: 'rgba(249, 115, 22, 0.12)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 80px',
          }}
        >
          <div style={{ display: 'flex', color: '#6b7280', fontSize: '22px' }}>
            Save this post · Share with a friend · Tag your dog 🐶
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
