-- Migration 00009: Enhance waitlist table to support lesson requests for non-existent time slots
-- Athletes can now request: (1) existing occupied slots (waitlist), or (2) completely new times (lesson request)

-- Add new columns to support lesson requests
ALTER TABLE waitlist_entries
  ADD COLUMN is_new_time_request BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN request_notes TEXT;

-- Add index for filtering by request type
CREATE INDEX idx_waitlist_is_new_time_request ON waitlist_entries(is_new_time_request, status);
CREATE INDEX idx_waitlist_coach_status ON waitlist_entries(coach_member_id, status, is_new_time_request);

-- Add comments for clarity
COMMENT ON COLUMN waitlist_entries.is_new_time_request IS
  'TRUE when athlete requests a time not on coach schedule (lesson request). FALSE when requesting existing occupied slot (waitlist).';
COMMENT ON COLUMN waitlist_entries.request_notes IS
  'Optional notes from athlete explaining their request (e.g., why they need this specific time).';
