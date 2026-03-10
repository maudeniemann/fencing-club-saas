import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';
import { z } from 'zod';

const createLessonTypeSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['private', 'group', 'clinic']),
  duration_minutes: z.number().min(15).max(480),
  max_participants: z.number().min(1).max(50),
  price_cents: z.number().min(0),
  currency: z.string().default('usd'),
  color: z.string().optional(),
  description: z.string().optional(),
});

export async function GET() {
  const { client: supabase, member } = await getDemoSafeClient();

  if (!member) {
    return NextResponse.json([]);
  }

  const { data } = await supabase
    .from('lesson_types')
    .select('*')
    .eq('club_id', member.club_id)
    .eq('is_active', true)
    .order('name');
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createLessonTypeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from('lesson_types')
    .insert({ club_id: member.club_id, ...parsed.data })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
