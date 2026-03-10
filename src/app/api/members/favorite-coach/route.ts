import { NextRequest, NextResponse } from 'next/server';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const updateFavoriteSchema = z.object({
  coach_id: z.string().uuid().nullable(),
});

export async function PUT(request: NextRequest) {
  const { member } = await getDemoSafeClient();

  if (!member) {
    return NextResponse.json({ error: 'No membership' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateFavoriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { coach_id } = parsed.data;
  const admin = createAdminClient();

  // If setting a favorite, validate it's a coach
  if (coach_id) {
    const { data: coach } = await admin
      .from('club_members')
      .select('id, role')
      .eq('id', coach_id)
      .eq('club_id', member.club_id)
      .eq('is_active', true)
      .single();

    if (!coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    if (coach.role !== 'coach') {
      return NextResponse.json({ error: 'Can only favorite coaches' }, { status: 400 });
    }
  }

  // Update favorite_coach_id
  const { error } = await admin
    .from('club_members')
    .update({ favorite_coach_id: coach_id })
    .eq('id', member.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
