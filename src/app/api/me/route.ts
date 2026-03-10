import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ member: null, club: null });
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from('club_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!member) {
    return NextResponse.json({ member: null, club: null });
  }

  const { data: club } = await admin
    .from('clubs')
    .select('*')
    .eq('id', member.club_id)
    .single();

  return NextResponse.json({ member, club });
}
