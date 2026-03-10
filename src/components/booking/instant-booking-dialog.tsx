'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parse } from 'date-fns';
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

      return res.json();
    },
    onSuccess: () => {
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
