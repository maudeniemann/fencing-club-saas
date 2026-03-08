-- Migration 00012: Remove parent role from system
-- All parent accounts are converted to player accounts
-- Parent-child links table is dropped (booking history is preserved via booked_by_member_id)

-- Step 1: Convert all parents to players
UPDATE club_members
SET role = 'player'
WHERE role = 'parent';

-- Step 2: Drop parent_child_links table
-- All parent booking history is preserved in booking_participants.booked_by_member_id
DROP TABLE IF EXISTS parent_child_links CASCADE;

-- Step 3: Update CHECK constraint on role column to remove 'parent'
-- First, drop the existing constraint
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_role_check;

-- Recreate the constraint without 'parent'
ALTER TABLE club_members ADD CONSTRAINT club_members_role_check
  CHECK (role IN ('admin', 'coach', 'player'));

-- Step 4: Add comment to document the change
COMMENT ON COLUMN club_members.role IS
  'User role in club: admin, coach, or player. Parent role has been removed (as of migration 00012) - former parents are now players.';

-- Note: booking_participants.booked_by_member_id maintains record of who booked the lesson
-- This preserves the parent-child relationship history even after parent role removal
