-- Migration: Smart Waitlist

CREATE TABLE waitlist_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

  coach_member_id     UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  lesson_type_id      UUID NOT NULL REFERENCES lesson_types(id) ON DELETE CASCADE,
  desired_date        DATE NOT NULL,
  desired_start_time  TIME,
  desired_end_time    TIME,

  player_member_id    UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  booked_by_member_id UUID REFERENCES club_members(id),

  proximity_score     NUMERIC(5,2) DEFAULT 0,
  booking_history_count INTEGER DEFAULT 0,
  priority_score      NUMERIC(8,2) DEFAULT 0,

  status              TEXT NOT NULL DEFAULT 'waiting'
                        CHECK (status IN (
                          'waiting', 'notified', 'accepted', 'declined',
                          'expired', 'fulfilled', 'cancelled'
                        )),

  notified_at         TIMESTAMPTZ,
  accept_deadline     TIMESTAMPTZ,
  responded_at        TIMESTAMPTZ,

  resulting_booking_id UUID REFERENCES bookings(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_waitlist_updated_at
  BEFORE UPDATE ON waitlist_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_waitlist_club ON waitlist_entries(club_id);
CREATE INDEX idx_waitlist_coach_date ON waitlist_entries(coach_member_id, desired_date);
CREATE INDEX idx_waitlist_player ON waitlist_entries(player_member_id);
CREATE INDEX idx_waitlist_status ON waitlist_entries(status);
CREATE INDEX idx_waitlist_priority ON waitlist_entries(priority_score DESC);
CREATE INDEX idx_waitlist_deadline ON waitlist_entries(accept_deadline) WHERE status = 'notified';

-- RLS
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_select" ON waitlist_entries FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "waitlist_insert" ON waitlist_entries FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "waitlist_update" ON waitlist_entries FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "waitlist_delete" ON waitlist_entries FOR DELETE TO authenticated USING (club_id = get_user_club_id());
