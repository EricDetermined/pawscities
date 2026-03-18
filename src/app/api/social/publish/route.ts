import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { publishImagePost, publishCarouselPost } from '@/lib/instagram';
import { CONTENT_BANK, CITY_META, generateCaption } from '@/lib/social-content';

/**
 * POST /api/social/publish
 *
 * Admin-only endpoint to manually publish an Instagram post.
 * Accepts either a specific content piece (by headline) or custom content.
 *
 * Body:
 *   { headline: string }              - Publish a specific fact from the content bank
 *   { imageUrl: string, caption: string } - Publish custom content
 *   { imageUrls: string[], caption: string } - Publish carousel
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();

    let imageUrl: string;
    let caption: string;
    let isCarousel = false;
    let imageUrls: string[] = [];

    if (body.headline) {
      // Find in content bank
      const fact = CONTENT_BANK.find(f => f.headline === body.headline);
      if (!fact) {
        return NextResponse.json(
          { error: `Content not found: "${body.headline}"` },
          { status: 404 }
        );
      }

      caption = generateCaption(fact);

      // Use provided imageUrl or fall back
      if (body.imageUrl) {
        imageUrl = body.imageUrl;
      } else {
        return NextResponse.json(
          { error: 'imageUrl is required (Google Places photo URL for the post)' },
          { status: 400 }
        );
      }
    } else if (body.imageUrls && Array.isArray(body.imageUrls) && body.caption) {
      // Custom carousel
      imageUrls = body.imageUrls;
      caption = body.caption;
      isCarousel = true;
    } else if (body.imageUrl && body.caption) {
      // Custom single post
      imageUrl = body.imageUrl;
      caption = body.caption;
    } else {
      return NextResponse.json(
        { error: 'Provide either { headline, imageUrl } or { imageUrl, caption } or { imageUrls, caption }' },
        { status: 400 }
      );
    }

    // Publish
    const result = isCarousel
      ? await publishCarouselPost(imageUrls, caption)
      : await publishImagePost(imageUrl!, caption);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, containerId: result.containerId },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'published',
      postId: result.postId,
      containerId: result.containerId,
    });
  } catch (error) {
    console.error('Social publish error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
