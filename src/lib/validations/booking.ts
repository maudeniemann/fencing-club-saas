import { z } from 'zod';

export const createBookingSchema = z.object({
  coach_member_id: z.string().uuid(),
  lesson_type_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  player_member_id: z.string().uuid(),
  venue_id: z.string().uuid().optional(),
  strip_id: z.string().uuid().optional(),
  is_recurring: z.boolean().optional().default(false),
  recurring_frequency: z.enum(['weekly', 'biweekly']).optional(),
  notes: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
