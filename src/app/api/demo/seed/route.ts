import { NextResponse } from 'next/server';
import { seedDemoData } from './seed-demo';

export async function POST() {
  try {
    await seedDemoData();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Seed failed' },
      { status: 500 }
    );
  }
}
