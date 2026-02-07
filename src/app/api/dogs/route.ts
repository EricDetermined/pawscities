import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

// GET - List user's dogs
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        dogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      dogs: dbUser?.dogs || [],
    });
  } catch (error) {
    console.error('Failed to fetch dogs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dogs' },
      { status: 500 }
    );
  }
}

// POST - Create a new dog
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, breed, birthDate, size, personality, photo, photos } = body;

    if (!name || !size) {
      return NextResponse.json(
        { error: 'Name and size are required' },
        { status: 400 }
      );
    }

    // Find or create user in our database
    let dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          supabaseId: user.id,
          email: user.email!,
          name: user.user_metadata?.name,
        },
      });
    }

    // Create the dog profile
    const dog = await prisma.dogProfile.create({
      data: {
        userId: dbUser.id,
        name,
        breed,
        birthDate: birthDate ? new Date(birthDate) : null,
        size,
        personality,
        photo: photos && photos.length > 0 ? photos[0] : photo,
      },
    });

    return NextResponse.json({
      success: true,
      dog,
    });
  } catch (error) {
    console.error('Failed to create dog:', error);
    return NextResponse.json(
      { error: 'Failed to create dog profile' },
      { status: 500 }
    );
  }
}

// PUT - Update a dog
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, name, breed, birthDate, size, personality, photo, photos } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Dog ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const existingDog = await prisma.dogProfile.findFirst({
      where: {
        id,
        userId: dbUser.id,
      },
    });

    if (!existingDog) {
      return NextResponse.json(
        { error: 'Dog not found or not owned by user' },
        { status: 404 }
      );
    }

    // Update the dog
    const dog = await prisma.dogProfile.update({
      where: { id },
      data: {
        name,
        breed,
        birthDate: birthDate ? new Date(birthDate) : null,
        size,
        personality,
        photo: photos && photos.length > 0 ? photos[0] : photo,
      },
    });

    return NextResponse.json({
      success: true,
      dog,
    });
  } catch (error) {
    console.error('Failed to update dog:', error);
    return NextResponse.json(
      { error: 'Failed to update dog profile' },
      { status: 500 }
    );
  }
}
