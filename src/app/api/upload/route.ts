import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  return `${timestamp}-${random}${extension}`;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (files.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 files allowed per upload' },
        { status: 400 }
      );
    }

    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    // Process each file
    for (const file of files) {
      try {
        // Validate file type
        if (!ACCEPTED_TYPES.includes(file.type)) {
          errors.push(`${file.name}: Invalid file type. Accept JPG, PNG, or WebP.`);
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: File is too large. Maximum size is 5MB.`);
          continue;
        }

        // Generate unique filename
        const filename = generateUniqueFilename(file.name);
        const filepath = `photos/${user.id}/${filename}`;

        // Convert file to buffer
        const buffer = await file.arrayBuffer();

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filepath, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(filepath);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      } catch (fileError) {
        const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error';
        errors.push(`${file.name}: ${errorMsg}`);
      }
    }

    // Return results
    if (uploadedUrls.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: errors[0] || 'Upload failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
