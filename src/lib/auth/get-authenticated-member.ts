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
