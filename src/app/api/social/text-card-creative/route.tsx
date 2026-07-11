import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { pickContextualDogPhotoWithId, photoUrlFromId } from '@/lib/dog-photos';

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
  nyc: '#059669',
  sydney: '#0284c7',
  tokyo: '#e11d48',
};

/**
 * GET /api/social/text-card-creative
 *
 * Generates a branded 1080x1080 text card for tip/guide posts.
 * Top half: beautiful real dog photography
 * Bottom half: branded text content on dark background
 * Smooth gradient blend between photo and text
 *
 * Query params:
 *   headline  - Main headline text (required)
 *   body      - Supporting body text (optional, truncated to fit)
 *   city      - City name for display (required)
 *   citySlug  - City slug for accent color & photo selection (required)
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
  // Dedup controls: `photo` forces a specific Unsplash id; `recent` is a
  // comma-separated list of ids to avoid so the grid stays visually varied.
  const forcedPhoto = searchParams.get('photo') || '';
  const recentParam = searchParams.get('recent') || '';
  const recentIds = recentParam ? recentParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;

  const accent = CITY_ACCENTS[citySlug] || BRAND_ORANGE;
  let dogPhoto: string;
  let chosenPhotoId: string;
  if (forcedPhoto) {
    chosenPhotoId = forcedPhoto;
    dogPhoto = photoUrlFromId(forcedPhoto, 'wide');
  } else {
    const picked = pickContextualDogPhotoWithId({
      text: headline,
      citySlug,
      description: body || undefined,
      recentlyUsedPhotoIds: recentIds,
    }, 'wide');
    dogPhoto = picked.url;
    chosenPhotoId = picked.photoId;
  }

  // Truncate text for readability
  const displayHeadline = headline.length > 55 ? headline.slice(0, 52) + '...' : headline;
  const displayBody = body.length > 120 ? body.slice(0, 117) + '...' : body;
  const headlineFontSize = displayHeadline.length > 40 ? '44px' : displayHeadline.length > 30 ? '50px' : '56px';

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
        {/* ─── Dog photo (top half) ─────────────────────────────────────── */}
        <img
          src={dogPhoto}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '600px',
            objectFit: 'cover',
          }}
        />

        {/* Gradient blend from photo to dark background */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '620px',
            background: 'linear-gradient(180deg, rgba(26,26,46,0.1) 0%, rgba(26,26,46,0.2) 40%, rgba(26,26,46,0.7) 70%, rgba(26,26,46,1) 90%)',
            display: 'flex',
          }}
        />

        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '8px',
            background: BRAND_ORANGE,
            display: 'flex',
          }}
        />

        {/* ─── Type badge + city (top left, over photo) ──────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '60px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: BRAND_ORANGE,
              color: 'white',
              padding: '10px 22px',
              borderRadius: '30px',
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '2px',
            }}
          >
            {typeLabel}
          </div>
          <div
            style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '30px',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '1px',
            }}
          >
            {city.toUpperCase()}
          </div>
        </div>

        {/* ─── Text content (bottom half) ────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            bottom: '100px',
            left: 0,
            width: '1080px',
            display: 'flex',
            flexDirection: 'column',
            padding: '0 70px',
          }}
        >
          {/* Headline */}
          <div
            style={{
              display: 'flex',
              color: 'white',
              fontSize: headlineFontSize,
              fontWeight: 800,
              lineHeight: 1.25,
              maxWidth: '940px',
            }}
          >
            {displayHeadline}
          </div>

          {/* Body text */}
          {displayBody && (
            <div
              style={{
                display: 'flex',
                marginTop: '18px',
                color: '#d1d5db',
                fontSize: '26px',
                lineHeight: 1.5,
                maxWidth: '900px',
              }}
            >
              {displayBody}
            </div>
          )}

          {/* City accent underline */}
          <div
            style={{
              display: 'flex',
              marginTop: '24px',
              width: '80px',
              height: '4px',
              background: accent,
              borderRadius: '2px',
            }}
          />
        </div>

        {/* ─── Bottom bar — brand + CTA ──────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '1080px',
            height: '90px',
            background: 'rgba(249, 115, 22, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 70px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', fontSize: '28px' }}>🐾</div>
            <div
              style={{
                display: 'flex',
                color: BRAND_ORANGE,
                fontSize: '24px',
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
              fontSize: '20px',
            }}
          >
            pawcities.com/{citySlug}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: { 'X-Photo-Id': chosenPhotoId },
    }
  );
}
