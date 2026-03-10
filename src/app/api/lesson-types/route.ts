import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
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
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { data } = await client
    .from('lesson_types')
    .select('*')
    .eq('club_id', member.club_id)
    .eq('is_active', true)
    .order('name');
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createLessonTypeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await client
    .from('lesson_types')
    .insert({ club_id: member.club_id, ...parsed.data })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
