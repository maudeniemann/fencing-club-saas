import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const rejectSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, role, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });
  if (member.role !== 'coach' && member.role !== 'admin') {
    return NextResponse.json({ error: 'Coaches only' }, { status: 403 });
  }

  const { id } = await params;

  // Parse request body
  const body = await request.json();
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { reason } = parsed.data;

  // Get waitlist entry
  const { data: entry, error: fetchError } = await admin
    .from('waitlist_entries')
    .select('*')
    .eq('id', id)
    .eq('coach_member_id', member.id)
    .single();

  if (fetchError || !entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  if (entry.status !== 'waiting') {
    return NextResponse.json({ error: 'Entry already processed' }, { status: 400 });
  }

  // Update waitlist entry to declined
  const { error: updateError } = await admin
    .from('waitlist_entries')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Create notification for athlete
  const notificationBody = reason
    ? `Your lesson request was declined. Reason: ${reason}`
    : 'Your lesson request was declined by the coach.';

  await admin.from('notifications').insert({
    club_id: entry.club_id,
    recipient_member_id: entry.player_member_id,
    type: 'lesson_request_declined',
    title: 'Lesson Request Declined',
    body: notificationBody,
    data: { waitlist_entry_id: entry.id, reason },
    channel: 'in_app',
  });

  return NextResponse.json({ success: true });
}
