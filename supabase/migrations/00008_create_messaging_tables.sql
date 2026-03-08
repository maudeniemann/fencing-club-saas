-- Migration 00008: Create messaging tables for built-in chat functionality
-- Supports both booking-specific threads and general DM conversations

-- Conversations table (for both booking-specific and general DMs)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  -- NULL booking_id means general DM conversation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants (always 2: coach and athlete)
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, member_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_club ON conversations(club_id);
CREATE INDEX idx_conversations_booking ON conversations(booking_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_conversation_participants_member ON conversation_participants(member_id);
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(conversation_id, created_at DESC);

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can see conversations they're part of
CREATE POLICY "Members can view their conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.member_id IN (
        SELECT id FROM club_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can view participants of their conversations
CREATE POLICY "Members can view conversation participants"
  ON conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.member_id IN (
        SELECT id FROM club_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can view messages in their conversations
CREATE POLICY "Members can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.member_id IN (
        SELECT id FROM club_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can send messages to their conversations
CREATE POLICY "Members can send messages to their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_member_id IN (SELECT id FROM club_members WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.member_id = sender_member_id
    )
  );

-- Users can update last_read_at for themselves
CREATE POLICY "Members can update their own read status"
  ON conversation_participants FOR UPDATE
  USING (
    member_id IN (SELECT id FROM club_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    member_id IN (SELECT id FROM club_members WHERE user_id = auth.uid())
  );

-- Function to auto-update conversation.updated_at when new message arrives
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Comments for documentation
COMMENT ON TABLE conversations IS 'Chat conversations between coaches and athletes. booking_id NULL = general DM';
COMMENT ON TABLE conversation_participants IS 'Always 2 participants per conversation: coach and athlete';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON COLUMN conversations.booking_id IS 'If set, this is a booking-specific thread. If NULL, general DM';
