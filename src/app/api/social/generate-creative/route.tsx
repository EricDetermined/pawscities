import { ImageResponse } from 'next/og';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CONTENT_BANK, CITY_META } from '@/lib/social-content';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Brand colors
const BRAND = {
  orange: '#f97316',
  darkBlue: '#1a1a2e',
  white: '#ffffff',
};

// City background images (Unsplash, high quality, free to use)
const CITY_BACKGROUNDS: Record<string, string> = {
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1080&h=1080&fit=crop',
  geneva: 'https://images.unsplash.com/photo-1752405165625-15bc2e842f05?w=1080&h=1080&fit=crop',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1080&h=1080&fit=crop',
  barcelona: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1080&h=1080&fit=crop',
  losangeles: 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1080&h=1080&fit=crop',
  nyc: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1080&h=1080&fit=crop',
  sydney: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1080&h=1080&fit=crop',
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1080&h=1080&fit=crop',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const index = searchParams.get('index');
  const preview = searchParams.get('preview') === 'true';

  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const factIndex = index ? parseInt(index) : 0;
  const fact = CONTENT_BANK[factIndex];
  if (!fact) {
    return NextResponse.json({ error: `No content at index ${factIndex}` }, { status: 404 });
  }

  const cityMeta = CITY_META[fact.city];
  const bgImage = CITY_BACKGROUNDS[fact.city] || CITY_BACKGROUNDS.paris;

  // Generate the branded creative as a 1080x1080 Instagram image
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
        {/* Background city image */}
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

        {/* Dark overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '1080px',
            background: 'linear-gradient(180deg, rgba(26,26,46,0.4) 0%, rgba(26,26,46,0.85) 50%, rgba(26,26,46,0.95) 100%)',
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
          {/* Top: Logo + City badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: BRAND.orange,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}
              >
                🐾
              </div>
              <span style={{ color: BRAND.white, fontSize: '28px', fontWeight: 'bold' }}>
                Paw Cities
              </span>
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '24px',
                padding: '8px 20px',
                color: BRAND.white,
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {cityMeta?.emoji} {cityMeta?.name || fact.city}
            </div>
          </div>

          {/* Middle: Fact content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Type badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '40px' }}>{fact.icon}</span>
              <span
                style={{
                  color: BRAND.orange,
                  fontSize: '22px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                }}
              >
                {fact.type === 'did-you-know' ? 'Did You Know?' : 'Pro Tip'}
              </span>
            </div>

            {/* Headline */}
            <h1
              style={{
                color: BRAND.white,
                fontSize: '52px',
                fontWeight: 'bold',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {fact.headline}
            </h1>

            {/* Body */}
            <p
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '26px',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {fact.body}
            </p>
          </div>

          {/* Bottom: CTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                background: BRAND.orange,
                borderRadius: '16px',
                padding: '14px 28px',
                color: BRAND.white,
                fontSize: '22px',
                fontWeight: 'bold',
                display: 'flex',
              }}
            >
              pawcities.com
            </div>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px' }}>
              Follow @thepawcities for more
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

  // If preview mode, just return the image
  if (preview) {
    return imageResponse;
  }

  // Otherwise, upload to Supabase Storage
  try {
    const supabase = getSupabaseAdmin();
    const imageBuffer = await imageResponse.arrayBuffer();
    const fileName = `social-creatives/${fact.city}-${factIndex}-${Date.now()}.png`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      index: factIndex,
      city: fact.city,
      headline: fact.headline,
      imageUrl: urlData.publicUrl,
      storagePath: fileName,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
