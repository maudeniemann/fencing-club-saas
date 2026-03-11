import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { seedDemoData } from '../seed/seed-demo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = body.role;

    if (!role || !['admin', 'coach', 'player'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if demo club exists, auto-seed if not
    const admin = createAdminClient();
    const { data: club } = await admin
      .from('clubs')
      .select('id')
      .eq('slug', 'demo')
      .single();

    if (!club) {
      // Auto-seed demo data
      await seedDemoData();
    }

    // Set demo cookie
    const cookieStore = await cookies();
    cookieStore.set('demo_role', role, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      httpOnly: false,
    });

    return NextResponse.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start demo' },
      { status: 500 }
    );
  }
}
