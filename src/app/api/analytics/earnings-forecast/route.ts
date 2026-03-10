import { NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { generateEarningsForecast } from '@/lib/analytics/earnings-forecast';

export async function GET() {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  if (member.role === 'admin') {
    // Admin: pick the first coach from the club
    const { data: firstCoach } = await client
      .from('club_members')
      .select('id, club_id')
      .eq('club_id', member.club_id)
      .eq('role', 'coach')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!firstCoach) return NextResponse.json({ error: 'No coaches found' }, { status: 404 });
    const forecast = await generateEarningsForecast(firstCoach.id, firstCoach.club_id, client);
    return NextResponse.json(forecast);
  }

  if (member.role !== 'coach') {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
  }

  const forecast = await generateEarningsForecast(member.id, member.club_id, client);
  return NextResponse.json(forecast);
}
