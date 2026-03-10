import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// TEMP: Force demo mode — always return Dynamo Fencing context
export async function GET() {
  const admin = createAdminClient();
  const DEMO_CLUB_ID = 'da1f8770-aabf-49a2-986c-1e4fb45d2651';

  const { data: adminMember } = await admin
    .from('club_members')
    .select('*')
    .eq('club_id', DEMO_CLUB_ID)
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!adminMember) {
    return NextResponse.json({ member: null, club: null });
  }

  const { data: club } = await admin
    .from('clubs')
    .select('*')
    .eq('id', adminMember.club_id)
    .single();

  return NextResponse.json({ member: adminMember, club });
}
