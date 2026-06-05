import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

const BRAND_ORANGE = '#f97316';
const BRAND_DARK = '#1a1a2e';

// City accent colors for subtle differentiation
const CITY_ACCENTS: Record<string, string> = {
  paris: '#2563eb',
  geneva: '#dc2626',
  london: '#7c3aed',
  barcelona: '#ea580c',
  losangeles: '#0891b2',
  newyork: '#059669',
  sydney: '#0284c7',
  tokyo: '#e11d48',
};

/**
 * GET /api/social/text-card-creative
 *
 * Generates a branded 1080x1080 text card for tip/guide posts.
 * Bold Paw Cities orange with white text — clean, instantly recognizable.
 *
 * Query params:
 *   headline  - Main headline text (required)
 *   body      - Supporting body text (optional, truncated to fit)
 *   city      - City name for display (required)
 *   citySlug  - City slug for accent color (required)
 *   type      - Content type: tip, guide, did-you-know (required)
 *   icon      - Emoji icon to display (optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const headline = searchParams.get('headline') || 'Dog-Friendly Tip';
  const body = searchParams.get('body') || '';
  const city = searchParams.get('city') || 'City';
  const citySlug = searchParams.get('citySlug') || 'losangeles';
  const type = searchParams.get('type') || 'tip';
  const icon = searchParams.get('icon') || '🐾';

  const accent = CITY_ACCENTS[citySlug] || BRAND_ORANGE;

  // Truncate text for readability
  const displayHeadline = headline.length > 55 ? headline.slice(0, 52) + '...' : headline;
  const displayBody = body.length > 140 ? body.slice(0, 137) + '...' : body;
  const headlineFontSize = displayHeadline.length > 35 ? '48px' : displayHeadline.length > 25 ? '56px' : '64px';

  // Type label
  const typeLabels: Record<string, string> = {
    tip: '💡 TIP',
    guide: '📍 GUIDE',
    'did-you-know': '🧠 DID YOU KNOW',
    fun: '😄 FUN FACT',
    spotlight: '⭐ SPOTLIGHT',
  };
  const typeLabel = typeLabels[type] || '🐾 PAW CITIES';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          fontFamily: 'sans-serif',
          background: BRAND_DARK,
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '8px',
            background: BRAND_ORANGE,
          }}
        />

        {/* Decorative paw pattern (subtle) */}
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '60px',
            fontSize: '120px',
            opacity: 0.08,
            display: 'flex',
          }}
        >
          🐾
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '120px',
            left: '40px',
            fontSize: '80px',
            opacity: 0.06,
            display: 'flex',
          }}
        >
          🐾
        </div>

        {/* Type label badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '80px 80px 0 80px',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: BRAND_ORANGE,
              color: 'white',
              padding: '12px 28px',
              borderRadius: '30px',
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '2px',
            }}
          >
            {typeLabel}
          </div>
          <div
            style={{
              display: 'flex',
              color: accent,
              fontSize: '24px',
              fontWeight: 600,
              marginLeft: '20px',
              letterSpacing: '1px',
            }}
          >
            {city.toUpperCase()}
          </div>
        </div>

        {/* Main icon */}
        <div
          style={{
            display: 'flex',
            margin: '50px 80px 0 80px',
            fontSize: '72px',
          }}
        >
          {icon}
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            margin: '30px 80px 0 80px',
            color: 'white',
            fontSize: headlineFontSize,
            fontWeight: 800,
            lineHeight: 1.2,
            maxWidth: '920px',
          }}
        >
          {displayHeadline}
        </div>

        {/* Body text */}
        {displayBody && (
          <div
            style={{
              display: 'flex',
              margin: '30px 80px 0 80px',
              color: '#d1d5db',
              fontSize: '30px',
              lineHeight: 1.5,
              maxWidth: '920px',
            }}
          >
            {displayBody}
          </div>
        )}

        {/* Bottom bar — brand + CTA */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '1080px',
            height: '100px',
            background: 'rgba(249, 115, 22, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 80px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', fontSize: '32px' }}>🐾</div>
            <div
              style={{
                display: 'flex',
                color: BRAND_ORANGE,
                fontSize: '28px',
                fontWeight: 700,
              }}
            >
              Paw Cities
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              color: '#9ca3af',
              fontSize: '22px',
            }}
          >
            pawcities.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
