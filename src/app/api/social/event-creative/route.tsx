import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';

// City background images (Unsplash, free to use, 1080x1080 crop)
const CITY_BACKGROUNDS: Record<string, string> = {
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1080&h=1080&fit=crop',
  geneva: 'https://images.unsplash.com/photo-1752405165625-15bc2e842f05?w=1080&h=1080&fit=crop',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1080&h=1080&fit=crop',
  barcelona: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1080&h=1080&fit=crop',
  losangeles: 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1080&h=1080&fit=crop',
  newyork: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1080&h=1080&fit=crop',
  sydney: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1080&h=1080&fit=crop',
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1080&h=1080&fit=crop',
};

const BRAND_ORANGE = '#f97316';

/**
 * GET /api/social/event-creative
 *
 * Generates a branded 1080x1080 Instagram creative for an event,
 * using the city skyline as background with event details overlaid.
 *
 * Query params:
 *   name     - Event name (required)
 *   city     - City name for display (required)
 *   citySlug - City slug for background image lookup (required)
 *   date     - Formatted date string (required)
 *   venue    - Venue name (optional)
 *   tags     - Comma-separated tags (optional)
 *   free     - "true" if free event (optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || 'Dog-Friendly Event';
  const city = searchParams.get('city') || 'City';
  const citySlug = searchParams.get('citySlug') || 'losangeles';
  const date = searchParams.get('date') || '';
  const venue = searchParams.get('venue') || '';
  const tags = searchParams.get('tags') || '';
  const isFree = searchParams.get('free') === 'true';

  const bgImage = CITY_BACKGROUNDS[citySlug] || CITY_BACKGROUNDS.losangeles;
  const tagList = tags ? tags.split(',').slice(0, 4) : [];

  // Truncate long event names
  const displayName = name.length > 60 ? name.slice(0, 57) + '...' : name;
  const fontSize = displayName.length > 35 ? '44px' : displayName.length > 25 ? '50px' : '56px';

  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* City background */}
        <img
          src={bgImage}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '1080px',
            objectFit: 'cover',
          }}
        />

        {/* Gradient overlay — darker at bottom for text readability */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '1080px',
            background: 'linear-gradient(180deg, rgba(26,26,46,0.3) 0%, rgba(26,26,46,0.5) 30%, rgba(26,26,46,0.92) 60%, rgba(26,26,46,0.98) 100%)',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '60px',
            justifyContent: 'space-between',
          }}
        >
          {/* Top: Paw Cities logo + city badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: BRAND_ORANGE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}
              >
                🐾
              </div>
              <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: 'bold' }}>
                Paw Cities
              </span>
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '24px',
                padding: '8px 20px',
                color: '#ffffff',
                fontSize: '20px',
                display: 'flex',
              }}
            >
              {city}
            </div>
          </div>

          {/* Middle + Bottom: Event details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Event type badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  color: BRAND_ORANGE,
                  fontSize: '22px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '3px',
                }}
              >
                📅 Dog-Friendly Event
              </span>
              {isFree && (
                <span
                  style={{
                    background: '#22c55e',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 12px',
                    borderRadius: '12px',
                  }}
                >
                  FREE
                </span>
              )}
            </div>

            {/* Event name */}
            <h1
              style={{
                color: '#ffffff',
                fontSize,
                fontWeight: 'bold',
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              {displayName}
            </h1>

            {/* Date */}
            {date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '28px' }}>🗓</span>
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '26px', fontWeight: '600' }}>
                  {date}
                </span>
              </div>
            )}

            {/* Venue */}
            {venue && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '28px' }}>📍</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '24px' }}>
                  {venue.length > 50 ? venue.slice(0, 47) + '...' : venue}
                </span>
              </div>
            )}

            {/* Tags */}
            {tagList.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: 'rgba(249,115,22,0.2)',
                      border: '1px solid rgba(249,115,22,0.4)',
                      borderRadius: '16px',
                      padding: '6px 14px',
                      color: BRAND_ORANGE,
                      fontSize: '18px',
                      fontWeight: '600',
                    }}
                  >
                    #{tag.trim().replace(/[- ]/g, '')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bottom CTA bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                background: BRAND_ORANGE,
                borderRadius: '16px',
                padding: '14px 28px',
                color: '#ffffff',
                fontSize: '22px',
                fontWeight: 'bold',
                display: 'flex',
              }}
            >
              pawcities.com/events
            </div>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px' }}>
              Follow @thepawcities
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );

  return imageResponse;
}
