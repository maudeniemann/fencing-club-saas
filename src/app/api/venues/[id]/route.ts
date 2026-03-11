import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { z } from 'zod';

const updateVenueSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: venueId } = await params;
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { data, error } = await client
    .from('venues')
    .select('*, strips(*)')
    .eq('id', venueId)
    .eq('club_id', member.club_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: venueId } = await params;
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateVenueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await client
    .from('venues')
    .update(parsed.data)
    .eq('id', venueId)
    .eq('club_id', member.club_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: venueId } = await params;
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { error } = await client
    .from('venues')
    .update({ is_active: false })
    .eq('id', venueId)
    .eq('club_id', member.club_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
