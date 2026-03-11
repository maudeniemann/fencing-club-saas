'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parse } from 'date-fns';
import { loadStripe } from '@stripe/stripe-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useClub } from '@/providers/club-provider';
import Link from 'next/link';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface SlotInfo {
  date: string;
  start_time: string;
  end_time: string;
  coach_member_id: string;
  venue_id: string | null;
}

interface LessonType {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  player_visible: boolean;
}

interface InstantBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: SlotInfo | null;
  coachName: string;
}

export function InstantBookingDialog({
  open,
  onOpenChange,
  slot,
  coachName,
}: InstantBookingDialogProps) {
  const { currentMember } = useClub();
  const queryClient = useQueryClient();
  const [lessonTypeId, setLessonTypeId] = useState<string>('');

  const hasPaymentMethod = !!currentMember?.stripe_default_payment_method_id;

  // Fetch saved payment method details
  const { data: pmData } = useQuery({
    queryKey: ['payment-method'],
    queryFn: async () => {
      const res = await fetch('/api/payments/payment-method');
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open && hasPaymentMethod,
  });

  const savedCard = pmData?.payment_method;

  // Fetch lesson types for the club
  const { data: lessonTypes = [] } = useQuery({
    queryKey: ['lesson-types'],
    queryFn: async () => {
      const res = await fetch('/api/lesson-types');
      if (!res.ok) return [];
      return (await res.json()) as LessonType[];
    },
    enabled: open,
  });

  // Filter to player-visible lesson types with duration <= 30 min
  const availableTypes = lessonTypes.filter(
    (lt) => lt.player_visible !== false && lt.duration_minutes <= 30
  );

  const selectedType = lessonTypes.find((lt) => lt.id === lessonTypeId);

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!slot || !currentMember || !lessonTypeId) throw new Error('Missing data');

      const startsAt = parse(
        `${slot.date} ${slot.start_time}`,
        'yyyy-MM-dd HH:mm:ss',
        new Date()
      ).toISOString();

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_member_id: slot.coach_member_id,
          lesson_type_id: lessonTypeId,
          starts_at: startsAt,
          player_member_id: currentMember.id,
          venue_id: slot.venue_id || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Booking failed');
      }

      const data = await res.json();

      // Confirm payment with Stripe if a payment intent was created
      if (data.payment_intent_client_secret) {
        const stripe = await stripePromise;
        if (stripe) {
          const { error } = await stripe.confirmPayment({
            clientSecret: data.payment_intent_client_secret,
            confirmParams: {
              return_url: `${window.location.origin}/bookings/${data.booking.id}`,
            },
            redirect: 'if_required',
          });
          if (error) {
            toast.error(error.message || 'Payment confirmation failed');
            // Booking was created but payment failed — still navigate to it
          }
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['coach-availability'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Lesson booked!');
      onOpenChange(false);
      setLessonTypeId('');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Booking failed');
    },
  });

  if (!slot) return null;

  const slotStart = parse(`${slot.date} ${slot.start_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
  const slotEnd = parse(`${slot.date} ${slot.end_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
  const dateLabel = format(slotStart, 'EEEE, MMMM d, yyyy');
  const timeLabel = `${format(slotStart, 'h:mm a')} – ${format(slotEnd, 'h:mm a')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Book Lesson</DialogTitle>
          <DialogDescription>
            Confirm your lesson with {coachName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Slot info */}
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 space-y-1">
            <div className="font-medium text-sm">{dateLabel}</div>
            <div className="text-sm text-muted-foreground">{timeLabel}</div>
            <div className="text-sm text-muted-foreground">Coach: {coachName}</div>
          </div>

          {/* Lesson type selector */}
          <div className="space-y-2">
            <Label>Lesson Type</Label>
            {availableTypes.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">
                No lesson types available. Ask your club admin to set up lesson types.
              </div>
            ) : (
              <Select value={lessonTypeId} onValueChange={setLessonTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select lesson type" />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.name} — ${(lt.price_cents / 100).toFixed(2)} ({lt.duration_minutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Price summary */}
          {selectedType && (
            <div className="flex items-center justify-between text-sm py-2 border-t">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold text-lg">
                ${(selectedType.price_cents / 100).toFixed(2)}
              </span>
            </div>
          )}

          {/* Payment method info */}
          {selectedType && (
            hasPaymentMethod ? (
              <div className="rounded-lg border px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-medium">
                  {savedCard
                    ? `${savedCard.brand} ending in ${savedCard.last4}`
                    : 'Card on file'}
                </span>
              </div>
            ) : (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2 text-sm space-y-1">
                <p className="text-yellow-800 dark:text-yellow-200">
                  No payment method on file. Add one to enable automatic billing.
                </p>
                <Link href="/account" className="text-primary text-xs underline">
                  Add Payment Method
                </Link>
              </div>
            )
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={bookMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => bookMutation.mutate()}
              disabled={!lessonTypeId || bookMutation.isPending}
            >
              {bookMutation.isPending ? 'Booking...' : 'Book Now'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
