import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const BASE_URL = 'https://places.googleapis.com/v1';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const photoName = searchParams.get('name');
  const maxWidth = searchParams.get('maxWidth') || '800';

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
      return NextResponse.json({ error: 'Failed to fetch photo' }, { status: response.status });
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
