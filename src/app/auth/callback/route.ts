import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has a club membership
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: membership } = await supabase
          .from('club_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (!membership) {
          // New user — redirect to onboarding
          return NextResponse.redirect(`${origin}/auth/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
}
