import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type AuthSuccess = {
  error?: undefined;
  user: { id: string; email?: string };
  member: {
    id: string;
    club_id: string;
    role: string;
    user_id: string;
    display_name: string | null;
    [key: string]: unknown;
  };
  club: {
    id: string;
    name: string;
    slug: string;
    [key: string]: unknown;
  };
  client: ReturnType<typeof createAdminClient>;
};

type AuthError = {
  error: NextResponse;
};

type AuthResult = AuthSuccess | AuthError;

/**
 * Authenticates the current user and resolves their club membership.
 * Returns admin client (bypasses RLS) for API route operations.
 *
 * Usage:
 *   const auth = await getAuthenticatedMember();
 *   if (auth.error) return auth.error;
 *   const { member, club, client } = auth;
 */
export async function getAuthenticatedMember(): Promise<AuthResult> {
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
    if (!club) {
      return { error: NextResponse.json({ error: 'Demo not available' }, { status: 500 }) };
    }
    const { data: member } = await admin
      .from('club_members')
      .select('*')
      .eq('club_id', club.id)
      .eq('role', demoRole)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (!member) {
      return { error: NextResponse.json({ error: 'Demo member not found' }, { status: 500 }) };
    }
    return {
      user: { id: member.user_id },
      member,
      club,
      client: admin,
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from('club_members')
    .select('*, clubs(*)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!member) {
    return { error: NextResponse.json({ error: 'No club membership' }, { status: 403 }) };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clubs: club, ...memberWithoutClub } = member;

  return {
    user: { id: user.id, email: user.email },
    member: memberWithoutClub,
    club,
    client: admin,
  };
}
