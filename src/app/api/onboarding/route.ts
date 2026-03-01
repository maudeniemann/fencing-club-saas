import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action, clubName, joinCode, role } = body;

    const admin = createAdminClient();

    if (action === 'create-club') {
      if (!clubName?.trim()) {
        return NextResponse.json({ error: 'Club name is required' }, { status: 400 });
      }

      const slug = clubName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Create the club (admin client bypasses RLS)
      const { data: club, error: clubError } = await admin
        .from('clubs')
        .insert({
          name: clubName.trim(),
          slug: `${slug}-${Date.now().toString(36)}`,
        })
        .select('id')
        .single();

      if (clubError) {
        return NextResponse.json({ error: clubError.message }, { status: 500 });
      }

      // Create admin membership
      const { error: memberError } = await admin
        .from('club_members')
        .insert({
          club_id: club.id,
          user_id: user.id,
          role: 'admin',
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url,
        });

      if (memberError) {
        // Rollback: delete the club if membership creation fails
        await admin.from('clubs').delete().eq('id', club.id);
        return NextResponse.json({ error: memberError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'join-club') {
      if (!joinCode?.trim() || !role) {
        return NextResponse.json({ error: 'Club code and role are required' }, { status: 400 });
      }

      // Look up club by slug
      const { data: club, error: clubError } = await admin
        .from('clubs')
        .select('id')
        .eq('slug', joinCode.trim().toLowerCase())
        .single();

      if (clubError || !club) {
        return NextResponse.json({ error: 'Club not found. Check the code and try again.' }, { status: 404 });
      }

      // Check for existing membership
      const { data: existing } = await admin
        .from('club_members')
        .select('id')
        .eq('club_id', club.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'You are already a member of this club.' }, { status: 409 });
      }

      // Create membership
      const { error: memberError } = await admin
        .from('club_members')
        .insert({
          club_id: club.id,
          user_id: user.id,
          role,
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url,
        });

      if (memberError) {
        return NextResponse.json({ error: memberError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
