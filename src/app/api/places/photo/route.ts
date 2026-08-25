import { NextRequest, NextResponse } from 'next/server';

function getApiKey() { return process.env.GOOGLE_PLACES_API_KEY || ''; }
const BASE_URL = 'https://places.googleapis.com/v1';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const photoName = searchParams.get('name');
  const maxWidth = searchParams.get('maxWidth') || '800';
  const API_KEY = getApiKey();

  if (!photoName) {
    return NextResponse.json({ error: 'Missing photo name' }, { status: 400 });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const photoUrl = `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`;

    const response = await fetch(photoUrl, {
      redirect: 'follow',
    });

    if (!response.ok) {
      // Surface Google's actual error (2026-08-23: all photos 400'd site-wide
      // while searchText worked — opaque "Failed to fetch photo" hid the cause).
      const googleError = await response.text().catch(() => '');
      console.error(`[PHOTO-PROXY] Google ${response.status} for ${photoName.slice(0, 80)}: ${googleError.slice(0, 300)}`);
      // Never let a visitor see a broken image (2026-08-25 BrewDog-page
      // incident: dead refs rendered as alt-text placeholders on cards).
      // Redirect to a warm dog-friendly fallback; short CDN cache so it
      // self-corrects quickly once the ref is refreshed. Health check still
      // sees real failures via its direct upstream probe + the log line above.
      return NextResponse.redirect(
        'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&h=600&fit=crop',
        { status: 302, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } },
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800', // Cache 1 day client, 7 days CDN
      },
    });
  } catch (error) {
    console.error('Photo proxy error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
