export * from './database';

// Joined/enriched types used in the application layer

import type {
  Booking,
  BookingParticipant,
  ClubMember,
  LessonType,
  Venue,
  Strip,
  Payment,
  LessonLog,
} from './database';

export interface BookingWithDetails extends Booking {
  coach: ClubMember;
  lesson_type: LessonType;
  venue: Venue | null;
  strip: Strip | null;
  participants: BookingParticipantWithPlayer[];
}

export interface BookingParticipantWithPlayer extends BookingParticipant {
  player: ClubMember;
  payment: Payment | null;
}

export interface CoachWithAvailability extends ClubMember {
  lesson_types: LessonType[];
  available_slots: ComputedSlot[];
}

export interface ComputedSlot {
  date: string;
  start_time: string;
  end_time: string;
  coach_member_id: string;
  venue_id: string | null;
  strip_id: string | null;
  is_booked: boolean;
  allowed_lesson_type_ids: string[] | null;
}

export interface PlayerProgress {
  player: ClubMember;
  total_lessons: number;
  lessons_by_weapon: Record<string, number>;
  recent_logs: LessonLog[];
  focus_area_frequency: Record<string, number>;
}

export interface EarningsForecast {
  current_month_projected: number;
  next_month_projected: number;
  monthly_trend: Array<{
    month: string;
    actual: number;
    projected: number;
  }>;
  average_fill_rate: number;
  upcoming_confirmed_revenue: number;
}

export interface PayoutPreview {
  coach_member_id: string;
  coach_name: string;
  period_start: string;
  period_end: string;
  total_lessons: number;
  total_revenue_cents: number;
  commission_rate: number;
  coach_amount_cents: number;
  club_retained_cents: number;
  bookings: Booking[];
}
