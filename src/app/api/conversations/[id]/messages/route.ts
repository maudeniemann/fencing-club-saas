import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  const { id: conversationId } = await params;

  // Verify user is participant
  const { data: participant } = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('member_id', member.id)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  // Get messages
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      *,
      sender:club_members!messages_sender_member_id_fkey(id, display_name, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return NextResponse.json(messages || []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, display_name, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  const { id: conversationId } = await params;

  // Verify user is participant
  const { data: participant } = await admin
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('member_id', member.id)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { content } = parsed.data;

  // Create message
  const { data: message, error: messageError } = await admin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_member_id: member.id,
      content,
    })
    .select(`
      *,
      sender:club_members!messages_sender_member_id_fkey(id, display_name, avatar_url)
    `)
    .single();

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  // Get other participants to notify
  const { data: otherParticipants } = await admin
    .from('conversation_participants')
    .select('member_id')
    .eq('conversation_id', conversationId)
    .neq('member_id', member.id);

  // Create notifications for other participants
  if (otherParticipants) {
    const senderName = member.display_name || 'Someone';
    await admin.from('notifications').insert(
      otherParticipants.map((p: any) => ({
        club_id: member.club_id,
        recipient_member_id: p.member_id,
        type: 'new_message',
        title: 'New Message',
        body: `${senderName} sent you a message`,
        data: { conversation_id: conversationId, message_id: message.id },
        related_conversation_id: conversationId,
        channel: 'in_app' as const,
      }))
    );
  }

  return NextResponse.json(message, { status: 201 });
}
