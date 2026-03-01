-- Migration: Extensions and Helper Functions
-- Multi-tenant foundation for fencing club SaaS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Auto-update timestamps trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS helper: returns the club_id for the currently authenticated user
-- Used in every RLS policy for tenant isolation
CREATE OR REPLACE FUNCTION get_user_club_id()
RETURNS UUID AS $$
  SELECT club_id FROM public.club_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS helper: returns the role for the current user in their club
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.club_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: generate human-readable booking numbers (BK-000001, BK-000002, ...)
CREATE SEQUENCE IF NOT EXISTS booking_number_seq START WITH 1;

CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
  SELECT 'BK-' || lpad(nextval('booking_number_seq')::text, 6, '0');
$$ LANGUAGE plpgsql;
