-- Migration: Notifications and Audit Log

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
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

-- ============================================================
-- AUDIT LOG
-- ============================================================
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
-- RLS
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Notifications: users see only their own
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (club_id = get_user_club_id() AND recipient_member_id IN (
    SELECT id FROM club_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (club_id = get_user_club_id() AND recipient_member_id IN (
    SELECT id FROM club_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (club_id = get_user_club_id());

-- Notifications insert: system only (via service role), but allow for edge functions
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (club_id = get_user_club_id());

-- Audit log: admins only
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated
  USING (club_id = get_user_club_id() AND get_user_role() = 'admin');

CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (club_id = get_user_club_id());
