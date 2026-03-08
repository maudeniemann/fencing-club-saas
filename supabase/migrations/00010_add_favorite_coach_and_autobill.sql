-- Migration 00010: Add favorite coach and auto-billing features
-- Athletes can favorite one coach whose availability appears on their main schedule
-- Athletes can opt-in to monthly auto-billing for completed lessons

-- Add favorite_coach_id to club_members
ALTER TABLE club_members
  ADD COLUMN favorite_coach_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
  ADD COLUMN auto_billing_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Add index for favorite coach queries
CREATE INDEX idx_club_members_favorite_coach ON club_members(favorite_coach_id);

-- Add check constraint: only coaches can be favorited
-- Note: This is enforced at application level due to circular reference challenges
-- The constraint would need to verify that favorite_coach_id references a row where role='coach'

-- Comments for documentation
COMMENT ON COLUMN club_members.favorite_coach_id IS
  'Athletes can select one favorite coach whose availability appears on their main schedule page.';
COMMENT ON COLUMN club_members.auto_billing_enabled IS
  'When TRUE, athlete has opted in to automatic monthly billing for completed bookings. Requires payment method on file.';
