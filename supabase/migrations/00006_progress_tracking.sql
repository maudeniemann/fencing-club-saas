-- Migration: Progress/Bout Tracking (Lesson Logs)

CREATE TABLE lesson_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  coach_member_id     UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  player_member_id    UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,

  weapon              TEXT CHECK (weapon IN ('epee', 'foil', 'sabre')),
  focus_areas         TEXT[],
  drills_performed    TEXT[],
  notes               TEXT,
  rating              INTEGER CHECK (rating BETWEEN 1 AND 5),

  bout_scores         JSONB,

  is_visible_to_player BOOLEAN DEFAULT TRUE,
  is_visible_to_parent BOOLEAN DEFAULT TRUE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_lesson_logs_updated_at
  BEFORE UPDATE ON lesson_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_lesson_logs_club ON lesson_logs(club_id);
CREATE INDEX idx_lesson_logs_booking ON lesson_logs(booking_id);
CREATE INDEX idx_lesson_logs_player ON lesson_logs(player_member_id, created_at DESC);
CREATE INDEX idx_lesson_logs_coach ON lesson_logs(coach_member_id, created_at DESC);

-- RLS
ALTER TABLE lesson_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_logs_select" ON lesson_logs FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "lesson_logs_insert" ON lesson_logs FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "lesson_logs_update" ON lesson_logs FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());
