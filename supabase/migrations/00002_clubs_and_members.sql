-- Migration: Clubs, Club Members, and Parent-Child Links
-- Core multi-tenant entities

-- ============================================================
-- CLUBS: The tenant entity
-- ============================================================
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

  -- Stripe Connect (club as connected account)
  stripe_account_id     TEXT,
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,

  -- Subscription billing (club pays platform)
  stripe_customer_id    TEXT,
  subscription_plan     TEXT DEFAULT 'free'
                          CHECK (subscription_plan IN ('free', 'starter', 'pro', 'enterprise')),
  subscription_status   TEXT DEFAULT 'trialing'
                          CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  subscription_stripe_id TEXT,

  -- Club-level settings
  default_cancellation_policy JSONB DEFAULT '{
    "free_cancel_hours": 24,
    "late_cancel_charge_percent": 50,
    "no_show_charge_percent": 100
  }'::jsonb,
  default_commission_split NUMERIC(5,2) DEFAULT 70.00,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_clubs_slug ON clubs(slug);
CREATE INDEX idx_clubs_stripe_account_id ON clubs(stripe_account_id);

-- ============================================================
-- CLUB MEMBERS: Join table auth.users <-> clubs with roles
-- ============================================================
CREATE TABLE club_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'player', 'parent')),
  display_name TEXT,
  avatar_url  TEXT,
  phone       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,

  -- Coach-specific fields (NULL for non-coaches)
  bio               TEXT,
  specialties       TEXT[],
  commission_rate   NUMERIC(5,2),

  -- Google Calendar sync
  google_calendar_refresh_token TEXT,
  google_calendar_id            TEXT,
  google_calendar_channel_id    TEXT,
  google_calendar_resource_id   TEXT,
  google_calendar_channel_expiry TIMESTAMPTZ,

  -- Stripe customer (for players/parents who pay)
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

-- ============================================================
-- PARENT-CHILD LINKS: Both have independent logins
-- ============================================================
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

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child_links ENABLE ROW LEVEL SECURITY;

-- Clubs: members can see their own club
CREATE POLICY "clubs_select" ON clubs
  FOR SELECT TO authenticated
  USING (id = get_user_club_id());

CREATE POLICY "clubs_update" ON clubs
  FOR UPDATE TO authenticated
  USING (id = get_user_club_id() AND get_user_role() = 'admin')
  WITH CHECK (id = get_user_club_id());

-- Allow insert for any authenticated user (club creation during onboarding)
CREATE POLICY "clubs_insert" ON clubs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Club members: can see members of their own club
CREATE POLICY "club_members_select" ON club_members
  FOR SELECT TO authenticated
  USING (club_id = get_user_club_id());

CREATE POLICY "club_members_insert" ON club_members
  FOR INSERT TO authenticated
  WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "club_members_update" ON club_members
  FOR UPDATE TO authenticated
  USING (club_id = get_user_club_id())
  WITH CHECK (club_id = get_user_club_id());

-- Parent-child links: visible within club
CREATE POLICY "parent_child_select" ON parent_child_links
  FOR SELECT TO authenticated
  USING (club_id = get_user_club_id());

CREATE POLICY "parent_child_insert" ON parent_child_links
  FOR INSERT TO authenticated
  WITH CHECK (club_id = get_user_club_id());

CREATE POLICY "parent_child_delete" ON parent_child_links
  FOR DELETE TO authenticated
  USING (club_id = get_user_club_id());
