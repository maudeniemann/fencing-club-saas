import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const updateFavoriteSchema = z.object({
  coach_id: z.string().uuid().nullable(),
});

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  // Only players can set favorite coaches
  if (member.role !== 'player') {
    return NextResponse.json({ error: 'Only players can favorite coaches' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateFavoriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { coach_id } = parsed.data;

  // If setting a favorite, validate it's a coach
  if (coach_id) {
    const { data: coach } = await supabase
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
