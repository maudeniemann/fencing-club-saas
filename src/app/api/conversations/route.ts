import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';
import { z } from 'zod';

const createConversationSchema = z.object({
  other_member_id: z.string().uuid(),
  booking_id: z.string().uuid().optional(),
});

export async function GET() {
  const { client: supabase, user } = await getDemoSafeClient();

  if (!user) {
    // Demo mode: no user context for conversations
    return NextResponse.json([]);
  }

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  // Get all conversations where user is a participant
  const { data: participants } = await supabase
    .from('conversation_participants')
    .select(`
      conversation_id,
      last_read_at,
      conversations(
        id,
        booking_id,
        created_at,
        updated_at
      )
    `)
    .eq('member_id', member.id);

  if (!participants) return NextResponse.json([]);

  // Get other participants and latest messages for each conversation
  const conversationsWithDetails = await Promise.all(
    participants.map(async (p: any) => {
      const conversation = p.conversations;
      
      // Get other participant
      const { data: otherParticipant } = await supabase
        .from('conversation_participants')
        .select('member_id, club_members(id, display_name, avatar_url, role)')
        .eq('conversation_id', conversation.id)
        .neq('member_id', member.id)
        .single();

      // Get latest message
      const { data: latestMessage } = await supabase
        .from('messages')
        .select('content, created_at, sender_member_id')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Count unread messages
      const { count: unreadCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id)
        .neq('sender_member_id', member.id)
        .gt('created_at', p.last_read_at || '1970-01-01');

      return {
        ...conversation,
        other_member: otherParticipant?.club_members,
        latest_message: latestMessage,
        unread_count: unreadCount || 0,
        last_read_at: p.last_read_at,
      };
    })
  );

  // Sort by latest activity
  conversationsWithDetails.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return NextResponse.json(conversationsWithDetails);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  const body = await request.json();
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { other_member_id, booking_id } = parsed.data;

  // Validate other member is in same club
  const { data: otherMember } = await supabase
    .from('club_members')
    .select('id, role')
    .eq('id', other_member_id)
    .eq('club_id', member.club_id)
    .eq('is_active', true)
    .single();

  if (!otherMember) {
    return NextResponse.json({ error: 'Other member not found' }, { status: 404 });
  }

  // Validate coach-athlete pairing
  const isCoachAthletePair = 
    (member.role === 'coach' && otherMember.role === 'player') ||
    (member.role === 'player' && otherMember.role === 'coach');

  if (!isCoachAthletePair && member.role !== 'admin' && otherMember.role !== 'admin') {
    return NextResponse.json({ error: 'Can only message between coaches and athletes' }, { status: 403 });
  }

  // Check if conversation already exists
  if (booking_id) {
    // Booking-specific conversation
    const { data: existing } = await admin
      .from('conversations')
      .select('id')
      .eq('booking_id', booking_id)
      .single();

    if (existing) {
      return NextResponse.json({ conversation_id: existing.id });
    }
  } else {
    // General DM - check if conversation exists between these two members
    const { data: existingParticipants } = await admin
      .from('conversation_participants')
      .select('conversation_id')
      .in('member_id', [member.id, other_member_id]);

    if (existingParticipants) {
      // Find conversation where both members are participants
      const conversationCounts = existingParticipants.reduce((acc: Record<string, number>, p: any) => {
        acc[p.conversation_id] = (acc[p.conversation_id] || 0) + 1;
        return acc;
      }, {});

      const existingConversationId = Object.keys(conversationCounts).find(
        id => conversationCounts[id] === 2
      );

      if (existingConversationId) {
        // Check it's not a booking conversation
        const { data: existingConv } = await admin
          .from('conversations')
          .select('id, booking_id')
          .eq('id', existingConversationId)
          .single();

        if (existingConv && !existingConv.booking_id) {
          return NextResponse.json({ conversation_id: existingConv.id });
        }
      }
    }
  }

  // Create new conversation
  const { data: conversation, error: convError } = await admin
    .from('conversations')
    .insert({
      club_id: member.club_id,
      booking_id: booking_id || null,
    })
    .select()
    .single();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }

  // Add participants
  await admin.from('conversation_participants').insert([
    { conversation_id: conversation.id, member_id: member.id },
    { conversation_id: conversation.id, member_id: other_member_id },
  ]);

  return NextResponse.json({ conversation_id: conversation.id }, { status: 201 });
}
