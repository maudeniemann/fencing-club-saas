import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { addHours } from 'date-fns';

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
    .select('id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });
  if (member.role !== 'coach' && member.role !== 'admin') {
    return NextResponse.json({ error: 'Coaches only' }, { status: 403 });
  }

  const { id } = await params;

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

  let updateData: Record<string, unknown>;
  let notificationType: string;
  let notificationTitle: string;
  let notificationBody: string;

  if (entry.is_new_time_request) {
    // New time request: mark as accepted (coach acknowledges request)
    updateData = {
      status: 'accepted',
      responded_at: new Date().toISOString(),
    };
    notificationType = 'new_time_request_accepted';
    notificationTitle = 'New Time Request Accepted';
    notificationBody = 'Your coach has accepted your lesson request for a new time slot. They will work with you to schedule it.';
  } else {
    // Traditional waitlist: mark as notified with 24h deadline
    const deadline = addHours(new Date(), 24);
    updateData = {
      status: 'notified',
      notified_at: new Date().toISOString(),
      accept_deadline: deadline.toISOString(),
    };
    notificationType = 'waitlist_spot_available';
    notificationTitle = 'Waitlist Spot Available';
    notificationBody = 'A spot has opened up for your waitlisted lesson. You have 24 hours to accept.';
  }

  // Update waitlist entry
  const { error: updateError } = await admin
    .from('waitlist_entries')
    .update(updateData)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Create notification for athlete
  await admin.from('notifications').insert({
    club_id: entry.club_id,
    recipient_member_id: entry.player_member_id,
    type: notificationType,
    title: notificationTitle,
    body: notificationBody,
    data: { waitlist_entry_id: entry.id },
    channel: 'in_app',
  });

  return NextResponse.json({ success: true });
}
