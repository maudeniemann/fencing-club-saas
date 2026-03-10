import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';
import { generateEarningsForecast } from '@/lib/analytics/earnings-forecast';

export async function GET() {
  const { member } = await getDemoSafeClient();
  const admin = createAdminClient();

  if (!member) {
    return NextResponse.json({ error: 'No membership' }, { status: 403 });
  }

  if (member.role === 'admin') {
    // Demo mode or admin: pick the first coach from the club
    const { data: firstCoach } = await admin
      .from('club_members')
      .select('id, club_id')
      .eq('club_id', member.club_id)
      .eq('role', 'coach')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!firstCoach) return NextResponse.json({ error: 'No coaches found' }, { status: 404 });
    const forecast = await generateEarningsForecast(firstCoach.id, firstCoach.club_id, admin);
    return NextResponse.json(forecast);
  }

  if (member.role !== 'coach') {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
  }

  const forecast = await generateEarningsForecast(member.id, member.club_id, admin);
  return NextResponse.json(forecast);
}
