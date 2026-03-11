import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  // Demo mode bypass
  const cookieStore = await cookies();
  const demoRole = cookieStore.get('demo_role')?.value;
  if (demoRole && ['admin', 'coach', 'player'].includes(demoRole)) {
    const admin = createAdminClient();
    const { data: club } = await admin
      .from('clubs')
      .select('*')
      .eq('slug', 'demo')
      .single();
    if (!club) return NextResponse.json({ member: null, club: null });

    const { data: member } = await admin
      .from('club_members')
      .select('*')
      .eq('club_id', club.id)
      .eq('role', demoRole)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (!member) return NextResponse.json({ member: null, club: null });

    return NextResponse.json({ member, club, isDemo: true });
  }

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
