import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ message: 'Coming soon' }); }
export async function POST() { return NextResponse.json({ message: 'Coming soon' }, { status: 501 }); }
