-- Migration: Financial Tables
-- Payments, coach payouts, disputes

-- ============================================================
-- PAYMENTS
-- ============================================================
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

-- Link payments to booking_participants
ALTER TABLE booking_participants
  ADD COLUMN payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

-- ============================================================
-- COACH PAYOUTS
-- ============================================================
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

-- ============================================================
-- DISPUTES
-- ============================================================
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

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

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
