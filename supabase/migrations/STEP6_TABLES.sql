-- STEP 6 OF 6: All tables, indexes, RLS policies
-- Run this AFTER steps 1-5

CREATE TABLE clubs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  logo_url              TEXT,
  address_line1         TEXT,
  address_line2         TEXT,
  city                  TEXT,
  state                 TEXT,
  zip                   TEXT,
  country               TEXT DEFAULT 'US',
  timezone              TEXT NOT NULL DEFAULT 'America/New_York',
  phone                 TEXT,
  email                 TEXT,
  website               TEXT,
  stripe_account_id     TEXT,
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
  stripe_customer_id    TEXT,
  subscription_plan     TEXT DEFAULT 'free'
                          CHECK (subscription_plan IN ('free', 'starter', 'pro', 'enterprise')),
  subscription_status   TEXT DEFAULT 'trialing'
                          CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  subscription_stripe_id TEXT,
  default_cancellation_policy JSONB DEFAULT '{"free_cancel_hours": 24, "late_cancel_charge_percent": 50, "no_show_charge_percent": 100}'::jsonb,
  default_commission_split NUMERIC(5,2) DEFAULT 70.00,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_clubs_slug ON clubs(slug);
CREATE INDEX idx_clubs_stripe_account_id ON clubs(stripe_account_id);

CREATE TABLE club_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'player', 'parent')),
  display_name TEXT,
  avatar_url  TEXT,
  phone       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  bio               TEXT,
  specialties       TEXT[],
  commission_rate   NUMERIC(5,2),
  google_calendar_refresh_token TEXT,
  google_calendar_id            TEXT,
  google_calendar_channel_id    TEXT,
  google_calendar_resource_id   TEXT,
  google_calendar_channel_expiry TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_default_payment_method_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);

CREATE TRIGGER trg_club_members_updated_at
  BEFORE UPDATE ON club_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_club_members_club_id ON club_members(club_id);
CREATE INDEX idx_club_members_user_id ON club_members(user_id);
CREATE INDEX idx_club_members_role ON club_members(club_id, role);
CREATE INDEX idx_club_members_name_trgm ON club_members USING gin(display_name gin_trgm_ops);

CREATE TABLE parent_child_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  parent_member_id  UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  child_member_id   UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  can_book          BOOLEAN DEFAULT TRUE,
  can_pay           BOOLEAN DEFAULT TRUE,
  can_view_progress BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_member_id, child_member_id)
);

CREATE INDEX idx_parent_child_parent ON parent_child_links(parent_member_id);
CREATE INDEX idx_parent_child_child ON parent_child_links(child_member_id);
CREATE INDEX idx_parent_child_club ON parent_child_links(club_id);

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
CREATE INDEX idx_bookings_coach_active_time ON bookings(coach_member_id, starts_at, ends_at)
  WHERE status IN ('confirmed', 'completed');

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

CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  booking_id            UUID REFERENCES bookings(id) ON DELETE SET NULL,
  payer_member_id       UUID NOT NULL REFERENCES club_members(id),
  player_member_id      UUID NOT NULL REFERENCES club_members(id),
  stripe_payment_intent_id TEXT,
  stripe_charge_id         TEXT,
  stripe_transfer_id       TEXT,
  amount_cents          INTEGER NOT NULL,
  platform_fee_cents    INTEGER DEFAULT 0,
  club_amount_cents     INTEGER NOT NULL,
  currency              TEXT DEFAULT 'usd',
  payment_type          TEXT NOT NULL DEFAULT 'lesson'
                          CHECK (payment_type IN (
                            'lesson', 'cancellation_fee', 'no_show_fee', 'refund'
                          )),
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending', 'processing', 'succeeded', 'failed',
                            'refunded', 'partially_refunded'
                          )),
  refund_amount_cents   INTEGER DEFAULT 0,
  stripe_refund_id      TEXT,
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payments_club ON payments(club_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_payer ON payments(payer_member_id);
CREATE INDEX idx_payments_status ON payments(club_id, status);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
CREATE INDEX idx_payments_type ON payments(club_id, payment_type);

ALTER TABLE booking_participants
  ADD COLUMN payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

CREATE TABLE coach_payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  coach_member_id     UUID NOT NULL REFERENCES club_members(id) ON DELETE RESTRICT,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  total_lesson_revenue_cents INTEGER NOT NULL,
  commission_rate     NUMERIC(5,2) NOT NULL,
  coach_payout_cents  INTEGER NOT NULL,
  club_retained_cents INTEGER NOT NULL,
  payout_method       TEXT DEFAULT 'manual'
                        CHECK (payout_method IN ('manual', 'stripe_transfer', 'bank_transfer')),
  stripe_transfer_id  TEXT,
  payout_reference    TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'paid', 'failed')),
  approved_by         UUID REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_coach_payouts_updated_at
  BEFORE UPDATE ON coach_payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payouts_club ON coach_payouts(club_id);
CREATE INDEX idx_payouts_coach ON coach_payouts(coach_member_id);
CREATE INDEX idx_payouts_period ON coach_payouts(period_start, period_end);
CREATE INDEX idx_payouts_status ON coach_payouts(club_id, status);

CREATE TABLE disputes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id          UUID REFERENCES payments(id),
  filed_by_member_id  UUID NOT NULL REFERENCES club_members(id),
  reason              TEXT NOT NULL,
  evidence_urls       TEXT[],
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN (
                          'open', 'under_review', 'resolved_for_player',
                          'resolved_for_club', 'dismissed'
                        )),
  resolved_by         UUID REFERENCES auth.users(id),
  resolved_at         TIMESTAMPTZ,
  resolution_notes    TEXT,
  refund_amount_cents INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_disputes_club ON disputes(club_id);
CREATE INDEX idx_disputes_booking ON disputes(booking_id);
CREATE INDEX idx_disputes_status ON disputes(club_id, status);
CREATE INDEX idx_disputes_filed_by ON disputes(filed_by_member_id);

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

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  recipient_member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT,
  data              JSONB,
  channel           TEXT NOT NULL DEFAULT 'in_app'
                      CHECK (channel IN ('in_app', 'email', 'push')),
  is_read           BOOLEAN DEFAULT FALSE,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_member_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_club ON notifications(club_id);
CREATE INDEX idx_notifications_type ON notifications(type);

CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     TEXT,
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT,
  summary         TEXT,
  diff_json       JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_club ON audit_log(club_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE strips ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Clubs
CREATE POLICY "clubs_select" ON clubs FOR SELECT TO authenticated USING (id = get_user_club_id());
CREATE POLICY "clubs_update" ON clubs FOR UPDATE TO authenticated USING (id = get_user_club_id() AND get_user_role() = 'admin') WITH CHECK (id = get_user_club_id());
CREATE POLICY "clubs_insert" ON clubs FOR INSERT TO authenticated WITH CHECK (true);

-- Club Members
CREATE POLICY "club_members_select" ON club_members FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "club_members_insert" ON club_members FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id() OR get_user_club_id() IS NULL);
CREATE POLICY "club_members_update" ON club_members FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());

-- Parent-Child Links
CREATE POLICY "parent_child_select" ON parent_child_links FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "parent_child_insert" ON parent_child_links FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "parent_child_delete" ON parent_child_links FOR DELETE TO authenticated USING (club_id = get_user_club_id());

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

-- Payments
CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());

-- Coach Payouts
CREATE POLICY "payouts_select" ON coach_payouts FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "payouts_insert" ON coach_payouts FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "payouts_update" ON coach_payouts FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());

-- Disputes
CREATE POLICY "disputes_select" ON disputes FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "disputes_insert" ON disputes FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "disputes_update" ON disputes FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());

-- Waitlist
CREATE POLICY "waitlist_select" ON waitlist_entries FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "waitlist_insert" ON waitlist_entries FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "waitlist_update" ON waitlist_entries FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "waitlist_delete" ON waitlist_entries FOR DELETE TO authenticated USING (club_id = get_user_club_id());

-- Lesson Logs
CREATE POLICY "lesson_logs_select" ON lesson_logs FOR SELECT TO authenticated USING (club_id = get_user_club_id());
CREATE POLICY "lesson_logs_insert" ON lesson_logs FOR INSERT TO authenticated WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "lesson_logs_update" ON lesson_logs FOR UPDATE TO authenticated USING (club_id = get_user_club_id()) WITH CHECK (club_id = get_user_club_id());

-- Notifications
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (club_id = get_user_club_id() AND recipient_member_id IN (
    SELECT id FROM club_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (club_id = get_user_club_id() AND recipient_member_id IN (
    SELECT id FROM club_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (club_id = get_user_club_id());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (club_id = get_user_club_id());

-- Audit Log
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated
  USING (club_id = get_user_club_id() AND get_user_role() = 'admin');
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (club_id = get_user_club_id());
