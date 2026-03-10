import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';
import { z } from 'zod';

const createMemberSchema = z.object({
  display_name: z.string().min(1).max(200),
  email: z.string().email(),
  role: z.enum(['player', 'coach']),
  phone: z.string().optional(),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  commission_rate: z.number().min(0).max(100).optional(),
});

async function getAdminMember(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') return null;
  return member;
}

export async function GET(request: NextRequest) {
  const { client: supabase, member: currentMember } = await getDemoSafeClient();

  if (!currentMember) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  let query = supabase
    .from('club_members')
    .select('*')
    .eq('club_id', currentMember.club_id)
    .eq('is_active', true)
    .order('display_name');

  if (role) query = query.eq('role', role);

  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const member = await getAdminMember(supabase);
  if (!member) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { display_name, email, role, phone, bio, specialties, commission_rate } = parsed.data;

  // Create auth user via admin API so the user_id FK is satisfied
  const admin = createAdminClient();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from('club_members')
    .insert({
      club_id: member.club_id,
      user_id: authUser.user.id,
      role,
      display_name,
      phone: phone || null,
      bio: role === 'coach' ? (bio || null) : null,
      specialties: role === 'coach' ? (specialties || null) : null,
      commission_rate: role === 'coach' ? (commission_rate ?? null) : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const member = await getAdminMember(supabase);
  if (!member) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  // Prevent self-deletion
  if (memberId === member.id) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('club_members')
    .update({ is_active: false })
    .eq('id', memberId)
    .eq('club_id', member.club_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
