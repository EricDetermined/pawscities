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
      return NextResponse.json(
        { error: 'Failed to fetch photo', google_status: response.status, google_error: googleError.slice(0, 500) },
        { status: response.status }
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
