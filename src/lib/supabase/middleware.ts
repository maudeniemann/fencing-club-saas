import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't need auth redirect
  // API routes handle their own auth via getAuthenticatedMember()
  const isPublicRoute =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/auth') ||
    request.nextUrl.pathname.startsWith('/api');

  // Redirect unauthenticated page requests to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // If authenticated on a page route, resolve club membership
  const isPageRoute = !request.nextUrl.pathname.startsWith('/api') && !request.nextUrl.pathname.startsWith('/auth');
  if (user && isPageRoute) {
    const { data: membership } = await supabase
      .from('club_members')
      .select('id, club_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!membership) {
      // No club membership — redirect to onboarding
      const url = request.nextUrl.clone();
      url.pathname = '/auth/onboarding';
      return NextResponse.redirect(url);
    }

    // Set club context in response headers for downstream use
    supabaseResponse.headers.set('x-club-id', membership.club_id);
    supabaseResponse.headers.set('x-member-id', membership.id);
    supabaseResponse.headers.set('x-user-role', membership.role);
  }

  // Role-based route protection
  if (user && request.nextUrl.pathname.startsWith('/admin')) {
    const role = supabaseResponse.headers.get('x-user-role');
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Coach-only routes
  if (user && (
    request.nextUrl.pathname.startsWith('/availability') ||
    request.nextUrl.pathname.startsWith('/earnings')
  )) {
    const role = supabaseResponse.headers.get('x-user-role');
    if (role !== 'coach' && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return supabaseResponse;
}
