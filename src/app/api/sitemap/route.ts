import { NextResponse } from 'next/server';

const BASE_URL = 'https://pawcities.com';

// Active city slugs
const CITY_SLUGS = [
  'geneva',
  'paris',
  'london',
  'losangeles',
  'newyork',
  'barcelona',
  'sydney',
  'tokyo',
];

// Static pages
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/explore', priority: '0.9', changefreq: 'daily' },
  { path: '/business/list', priority: '0.7', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.3', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'monthly' },
];

export async function GET() {
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Static pages
  for (const page of STATIC_PAGES) {
    xml += `  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // City pages
  for (const slug of CITY_SLUGS) {
    xml += `  <url>
    <loc>${BASE_URL}/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  // Try to fetch establishments from database for dynamic URLs
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: establishments } = await supabase
        .from('establishments')
        .select(`
          slug,
          updated_at,
          cities:city_id ( slug )
        `)
        .eq('status', 'ACTIVE')
        .order('updated_at', { ascending: false });

      if (establishments) {
        for (const est of establishments) {
          const citySlug = (est.cities)?.slug;
          if (!citySlug) continue;

          const lastmod = est.updated_at
            ? new Date(est.updated_at).toISOString().split('T')[0]
            : now;
          xml += `  <url>
    <loc>${BASE_URL}/${citySlug}/${est.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
        }
      }
    }
  } catch (error) {
    // If database query fails, continue with static URLs only
    console.error('Sitemap: Failed to fetch establishments:', error);
  }

  xml += `</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
