import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { z } from 'zod';

const updateLessonTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(['private', 'group', 'clinic']).optional(),
  duration_minutes: z.number().min(15).max(480).optional(),
  max_participants: z.number().min(1).max(50).optional(),
  price_cents: z.number().min(0).optional(),
  currency: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lessonTypeId } = await params;
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateLessonTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await client
    .from('lesson_types')
    .update(parsed.data)
    .eq('id', lessonTypeId)
    .eq('club_id', member.club_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lessonTypeId } = await params;
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { error } = await client
    .from('lesson_types')
    .update({ is_active: false })
    .eq('id', lessonTypeId)
    .eq('club_id', member.club_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
