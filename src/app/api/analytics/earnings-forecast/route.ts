import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateEarningsForecast } from '@/lib/analytics/earnings-forecast';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'coach') {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
  }

  const admin = createAdminClient();
  const forecast = await generateEarningsForecast(member.id, member.club_id, admin);

  return NextResponse.json(forecast);
}
