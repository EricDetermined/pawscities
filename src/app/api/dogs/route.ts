import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(Optionis: { searchParams: { cityId: string } }) {
  try {
    const dogs = await prisma.dog.findMany(
      { where: { cityId: searchParams.cityId } }
    );

    return NextResponse.json(dogs);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch dogs' }, { status: 500 });
  }
}
