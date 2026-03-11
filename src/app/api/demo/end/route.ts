import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('demo_role');
  return NextResponse.json({ success: true, redirect: '/' });
}
