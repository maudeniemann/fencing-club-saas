// Manually defined types matching our schema.
// Replace with `npx supabase gen types` output once Supabase project is connected.

export type UserRole = 'admin' | 'coach' | 'player' | 'parent';
export type LessonCategory = 'private' | 'group' | 'clinic';
export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'disputed';
export type PaymentType = 'lesson' | 'cancellation_fee' | 'no_show_fee' | 'refund';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'failed';
export type DisputeStatus = 'open' | 'under_review' | 'resolved_for_player' | 'resolved_for_club' | 'dismissed';
export type WaitlistStatus = 'waiting' | 'notified' | 'accepted' | 'declined' | 'expired' | 'fulfilled' | 'cancelled';
export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';
export type Weapon = 'epee' | 'foil' | 'sabre';
export type RecurrenceFrequency = 'weekly' | 'biweekly';

export interface Club {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_customer_id: string | null;
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  subscription_stripe_id: string | null;
  default_cancellation_policy: {
    free_cancel_hours: number;
    late_cancel_charge_percent: number;
    no_show_charge_percent: number;
  };
  default_commission_split: number;
  created_at: string;
  updated_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: UserRole;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  bio: string | null;
  specialties: string[] | null;
  commission_rate: number | null;
  google_calendar_refresh_token: string | null;
  google_calendar_id: string | null;
  google_calendar_channel_id: string | null;
  google_calendar_resource_id: string | null;
  google_calendar_channel_expiry: string | null;
  stripe_customer_id: string | null;
  stripe_default_payment_method_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentChildLink {
  id: string;
  club_id: string;
  parent_member_id: string;
  child_member_id: string;
  can_book: boolean;
  can_pay: boolean;
  can_view_progress: boolean;
  created_at: string;
}

export interface Venue {
  id: string;
  club_id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Strip {
  id: string;
  club_id: string;
  venue_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonType {
  id: string;
  club_id: string;
  name: string;
  category: LessonCategory;
  duration_minutes: number;
  max_participants: number;
  price_cents: number;
  currency: string;
  color: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  id: string;
  club_id: string;
  coach_member_id: string;
  venue_id: string | null;
  strip_id: string | null;
  is_recurring: boolean;
  day_of_week: number | null;
  recurrence_start: string | null;
  recurrence_end: string | null;
  slot_date: string | null;
  start_time: string;
  end_time: string;
  allowed_lesson_type_ids: string[] | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  club_id: string;
  booking_number: string;
  coach_member_id: string;
  lesson_type_id: string;
  venue_id: string | null;
  strip_id: string | null;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  recurring_booking_id: string | null;
  status: BookingStatus;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_fee_cents: number;
  no_show_reported_at: string | null;
  no_show_reported_by: string | null;
  google_event_id_coach: string | null;
  google_event_id_player: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BookingParticipant {
  id: string;
  club_id: string;
  booking_id: string;
  player_member_id: string;
  booked_by_member_id: string | null;
  payment_id: string | null;
  price_charged_cents: number;
  status: BookingStatus;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringBooking {
  id: string;
  club_id: string;
  coach_member_id: string;
  lesson_type_id: string;
  venue_id: string | null;
  strip_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  recurrence_start: string;
  recurrence_end: string | null;
  frequency: RecurrenceFrequency;
  is_active: boolean;
  payment_failures: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  club_id: string;
  booking_id: string | null;
  payer_member_id: string;
  player_member_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  amount_cents: number;
  platform_fee_cents: number;
  club_amount_cents: number;
  currency: string;
  payment_type: PaymentType;
  status: PaymentStatus;
  refund_amount_cents: number;
  stripe_refund_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachPayout {
  id: string;
  club_id: string;
  coach_member_id: string;
  period_start: string;
  period_end: string;
  total_lesson_revenue_cents: number;
  commission_rate: number;
  coach_payout_cents: number;
  club_retained_cents: number;
  payout_method: string;
  stripe_transfer_id: string | null;
  payout_reference: string | null;
  status: PayoutStatus;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  club_id: string;
  booking_id: string;
  payment_id: string | null;
  filed_by_member_id: string;
  reason: string;
  evidence_urls: string[] | null;
  status: DisputeStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  refund_amount_cents: number;
  created_at: string;
  updated_at: string;
}

export interface WaitlistEntry {
  id: string;
  club_id: string;
  coach_member_id: string;
  lesson_type_id: string;
  desired_date: string;
  desired_start_time: string | null;
  desired_end_time: string | null;
  player_member_id: string;
  booked_by_member_id: string | null;
  proximity_score: number;
  booking_history_count: number;
  priority_score: number;
  status: WaitlistStatus;
  notified_at: string | null;
  accept_deadline: string | null;
  responded_at: string | null;
  resulting_booking_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonLog {
  id: string;
  club_id: string;
  booking_id: string;
  coach_member_id: string;
  player_member_id: string;
  weapon: Weapon | null;
  focus_areas: string[] | null;
  drills_performed: string[] | null;
  notes: string | null;
  rating: number | null;
  bout_scores: Array<{
    opponent: string;
    score_for: number;
    score_against: number;
  }> | null;
  is_visible_to_player: boolean;
  is_visible_to_parent: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  club_id: string;
  recipient_member_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  channel: 'in_app' | 'email' | 'push';
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
