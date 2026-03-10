import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { getAvailableSlots } from '@/lib/scheduling/availability';
import { startOfWeek, endOfWeek, parseISO } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { id: coachMemberId } = await params;
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('week_start');

  // Default to current week
  const baseDate = weekStart ? parseISO(weekStart) : new Date();
  const dateFrom = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday
  const dateTo = endOfWeek(baseDate, { weekStartsOn: 1 }); // Sunday

  const slots = await getAvailableSlots({
    supabase: client!,
    clubId: member!.club_id,
    coachMemberId,
    dateFrom,
    dateTo,
    subdivide: true,
  });

  return NextResponse.json(slots);
}
