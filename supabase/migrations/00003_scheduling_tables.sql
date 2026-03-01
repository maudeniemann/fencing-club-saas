-- Migration: Scheduling Tables
-- Venues, strips, lesson types, availability, bookings

-- ============================================================
-- VENUES
-- ============================================================
CREATE TABLE venues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_venues_club_id ON venues(club_id);

-- ============================================================
-- STRIPS
-- ============================================================
CREATE TABLE strips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  venue_id    UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_strips_updated_at
  BEFORE UPDATE ON strips FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_strips_venue_id ON strips(venue_id);
CREATE INDEX idx_strips_club_id ON strips(club_id);

-- ============================================================
-- LESSON TYPES
-- ============================================================
CREATE TABLE lesson_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('private', 'group', 'clinic')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER NOT NULL DEFAULT 1,
  price_cents     INTEGER NOT NULL,
  currency        TEXT DEFAULT 'usd',
  color           TEXT,
  description     TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_lesson_types_updated_at
  BEFORE UPDATE ON lesson_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_lesson_types_club_id ON lesson_types(club_id);
CREATE INDEX idx_lesson_types_category ON lesson_types(club_id, category);

-- ============================================================
-- AVAILABILITY SLOTS
-- ============================================================
CREATE TABLE availability_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  coach_member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  venue_id        UUID REFERENCES venues(id) ON DELETE SET NULL,
  strip_id        UUID REFERENCES strips(id) ON DELETE SET NULL,

  is_recurring    BOOLEAN DEFAULT FALSE,
  day_of_week     INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  recurrence_start DATE,
  recurrence_end   DATE,

  slot_date       DATE,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,

  allowed_lesson_type_ids UUID[],
  is_blocked      BOOLEAN DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT recurring_has_day CHECK (
    (is_recurring = false) OR (is_recurring = true AND day_of_week IS NOT NULL)
  ),
  CONSTRAINT one_off_has_date CHECK (
    (is_recurring = true) OR (is_recurring = false AND slot_date IS NOT NULL)
  )
);

CREATE TRIGGER trg_availability_slots_updated_at
  BEFORE UPDATE ON availability_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_availability_club_coach ON availability_slots(club_id, coach_member_id);
CREATE INDEX idx_availability_date ON availability_slots(slot_date);
CREATE INDEX idx_availability_day ON availability_slots(day_of_week);
CREATE INDEX idx_availability_coach_date ON availability_slots(coach_member_id, slot_date);

-- ============================================================
-- RECURRING BOOKINGS (template for series)
-- ============================================================
CREATE TABLE recurring_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  coach_member_id     UUID NOT NULL REFERENCES club_members(id) ON DELETE RESTRICT,
  lesson_type_id      UUID NOT NULL REFERENCES lesson_types(id) ON DELETE RESTRICT,
  venue_id            UUID REFERENCES venues(id),
  strip_id            UUID REFERENCES strips(id),

  day_of_week         INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  recurrence_start    DATE NOT NULL,
  recurrence_end      DATE,
  frequency           TEXT NOT NULL DEFAULT 'weekly'
                        CHECK (frequency IN ('weekly', 'biweekly')),

  is_active           BOOLEAN DEFAULT TRUE,
  payment_failures    INTEGER DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_recurring_bookings_updated_at
  BEFORE UPDATE ON recurring_bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_recurring_club ON recurring_bookings(club_id);
CREATE INDEX idx_recurring_coach ON recurring_bookings(coach_member_id);
CREATE INDEX idx_recurring_active ON recurring_bookings(is_active) WHERE is_active = true;

-- ============================================================
-- BOOKINGS (core appointment record)
-- ============================================================
CREATE TABLE bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  booking_number      TEXT NOT NULL DEFAULT generate_booking_number(),

  coach_member_id     UUID NOT NULL REFERENCES club_members(id) ON DELETE RESTRICT,
  lesson_type_id      UUID NOT NULL REFERENCES lesson_types(id) ON DELETE RESTRICT,
  venue_id            UUID REFERENCES venues(id) ON DELETE SET NULL,
  strip_id            UUID REFERENCES strips(id) ON DELETE SET NULL,

  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER NOT NULL,

  recurring_booking_id UUID REFERENCES recurring_bookings(id) ON DELETE SET NULL,

  status              TEXT NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN (
                          'confirmed', 'completed', 'cancelled', 'no_show', 'disputed'
                        )),

  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_fee_cents INTEGER DEFAULT 0,

  no_show_reported_at     TIMESTAMPTZ,
  no_show_reported_by     UUID REFERENCES club_members(id),

  google_event_id_coach   TEXT,
  google_event_id_player  TEXT,

  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT valid_booking_time CHECK (ends_at > starts_at)
);

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX idx_bookings_number ON bookings(club_id, booking_number);
CREATE INDEX idx_bookings_club_id ON bookings(club_id);
CREATE INDEX idx_bookings_coach ON bookings(coach_member_id, starts_at);
CREATE INDEX idx_bookings_status ON bookings(club_id, status);
CREATE INDEX idx_bookings_starts_at ON bookings(starts_at);
CREATE INDEX idx_bookings_recurring ON bookings(recurring_booking_id);

-- Prevent double-booking a coach at the same time (using exclusion would need btree_gist)
-- We use a partial index + application-level check instead
CREATE INDEX idx_bookings_coach_active_time ON bookings(coach_member_id, starts_at, ends_at)
  WHERE status IN ('confirmed', 'completed');

-- ============================================================
-- BOOKING PARTICIPANTS (supports group lessons)
-- ============================================================
CREATE TABLE booking_participants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  player_member_id  UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  booked_by_member_id UUID REFERENCES club_members(id),

  price_charged_cents INTEGER NOT NULL,

  status            TEXT NOT NULL DEFAULT 'confirmed'
                      CHECK (status IN ('confirmed', 'cancelled', 'no_show', 'completed')),

  google_event_id   TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_booking_participants_updated_at
  BEFORE UPDATE ON booking_participants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_bp_booking_id ON booking_participants(booking_id);
CREATE INDEX idx_bp_player ON booking_participants(player_member_id);
CREATE INDEX idx_bp_club ON booking_participants(club_id);
CREATE UNIQUE INDEX idx_bp_booking_player ON booking_participants(booking_id, player_member_id);

-- ============================================================
-- RLS for all scheduling tables
-- ============================================================
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE strips ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_participants ENABLE ROW LEVEL SECURITY;

-- Venues
CREATE POLICY "venues_select" ON venues FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "venues_insert" ON venues FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "venues_update" ON venues FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "venues_delete" ON venues FOR DELETE TO authenticated USING (club_id = get_user_club_id());

-- Strips
CREATE POLICY "strips_select" ON strips FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "strips_insert" ON strips FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "strips_update" ON strips FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "strips_delete" ON strips FOR DELETE TO authenticated USING (club_id = get_user_club_id());

-- Lesson Types
CREATE POLICY "lesson_types_select" ON lesson_types FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "lesson_types_insert" ON lesson_types FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "lesson_types_update" ON lesson_types FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "lesson_types_delete" ON lesson_types FOR DELETE TO authenticated USING (club_id = get_user_club_id());

-- Availability Slots
CREATE POLICY "availability_select" ON availability_slots FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "availability_insert" ON availability_slots FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "availability_update" ON availability_slots FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "availability_delete" ON availability_slots FOR DELETE TO authenticated USING (club_id = get_user_club_id());

-- Recurring Bookings
CREATE POLICY "recurring_select" ON recurring_bookings FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "recurring_insert" ON recurring_bookings FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "recurring_update" ON recurring_bookings FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());

-- Bookings
CREATE POLICY "bookings_select" ON bookings FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "bookings_insert" ON bookings FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "bookings_update" ON bookings FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());

-- Booking Participants
CREATE POLICY "bp_select" ON booking_participants FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "bp_insert" ON booking_participants FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "bp_update" ON booking_participants FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());
