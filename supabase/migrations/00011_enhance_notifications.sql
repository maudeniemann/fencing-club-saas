-- Migration 00011: Enhance notifications table for email/SMS tracking and message linking

-- Add columns for SMS and email tracking
ALTER TABLE notifications
  ADD COLUMN sms_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN email_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN related_conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- Add index for conversation notifications
CREATE INDEX idx_notifications_conversation ON notifications(related_conversation_id);

-- Add index for notification delivery tracking
CREATE INDEX idx_notifications_delivery ON notifications(recipient_member_id, is_read, created_at DESC);

-- Update comment on notification types
COMMENT ON COLUMN notifications.type IS
  'Notification types: booking_confirmed, booking_cancelled, booking_reminder, waitlist_notified, lesson_request_received, lesson_request_approved, lesson_request_declined, new_message, payment_processed, payment_failed, auto_billing_processed';

COMMENT ON COLUMN notifications.sms_sent_at IS
  'Timestamp when SMS notification was sent (if applicable)';
COMMENT ON COLUMN notifications.email_sent_at IS
  'Timestamp when email notification was sent (if applicable)';
COMMENT ON COLUMN notifications.related_conversation_id IS
  'Link to conversation if notification is about a message';
