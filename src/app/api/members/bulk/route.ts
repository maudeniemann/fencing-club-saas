import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const bulkMemberSchema = z.object({
  members: z.array(
    z.object({
      name: z.string().min(1).max(200),
      email: z.string().email(),
      phone: z.string().optional(),
    })
  ).min(1).max(100),
  role: z.enum(['coach', 'player']),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = bulkMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { members, role } = parsed.data;
  const admin = createAdminClient();

  const results: { success: number; failed: number; errors: Array<{ email: string; error: string }> } = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const entry of members) {
    try {
      // Create auth user
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email: entry.email,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message?.includes('already been registered')) {
          // User exists — look up their ID and add as member if not already in club
          const { data: existingUsers } = await admin.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === entry.email);
          if (existingUser) {
            const { data: existingMember } = await admin
              .from('club_members')
              .select('id')
              .eq('club_id', member.club_id)
              .eq('user_id', existingUser.id)
              .single();

            if (existingMember) {
              results.failed++;
              results.errors.push({ email: entry.email, error: 'Already a member of this club' });
              continue;
            }

            // Add existing user as member
            const { error: memberError } = await admin
              .from('club_members')
              .insert({
                club_id: member.club_id,
                user_id: existingUser.id,
                role,
                display_name: entry.name,
                phone: entry.phone || null,
              });

            if (memberError) {
              results.failed++;
              results.errors.push({ email: entry.email, error: memberError.message });
            } else {
              results.success++;
            }
            continue;
          }
        }
        results.failed++;
        results.errors.push({ email: entry.email, error: authError.message });
        continue;
      }

      // Create club member record
      const { error: memberError } = await admin
        .from('club_members')
        .insert({
          club_id: member.club_id,
          user_id: authUser.user.id,
          role,
          display_name: entry.name,
          phone: entry.phone || null,
        });

      if (memberError) {
        results.failed++;
        results.errors.push({ email: entry.email, error: memberError.message });
      } else {
        results.success++;
      }
    } catch {
      results.failed++;
      results.errors.push({ email: entry.email, error: 'Unexpected error' });
    }
  }

  return NextResponse.json(results, { status: 200 });
}
