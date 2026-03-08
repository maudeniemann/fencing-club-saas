import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get current coach member
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

  // Fetch all waitlist + lesson requests for this coach
  const { data, error } = await supabase
    .from('waitlist_entries')
    .select(`
      *,
      player:club_members!waitlist_entries_player_member_id_fkey(id, display_name, avatar_url, phone),
      lesson_type:lesson_types(id, name, duration_minutes, price_cents, category)
    `)
    .eq('coach_member_id', member.id)
    .in('status', ['waiting', 'notified'])
    .order('is_new_time_request', { ascending: true })
    .order('priority_score', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}
