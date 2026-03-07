import { NextResponse } from 'next/server';

export async function GET() {
    const robotsTxt = `# PawsCities - Dog-Friendly City Guide
    # https://pawcities.com

    User-agent: *
    Allow: /
    Disallow: /api/
    Disallow: /admin/
    Disallow: /profile/
    Disallow: /login
    Disallow: /signup

    # Sitemaps
    Sitemap: https://pawcities.com/sitemap.xml
    `;

  return new NextResponse(robotsTxt, {
        status: 200,
        headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
  });
}
