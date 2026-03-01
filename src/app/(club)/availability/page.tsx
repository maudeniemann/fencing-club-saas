'use client';

import { useState } from 'react';
import { useClub } from '@/providers/club-provider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { RoleGate } from '@/components/layout/role-gate';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AvailabilitySlot, Venue } from '@/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilityPage() {
  const { club, currentMember, role, isLoading: clubLoading } = useClub();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [isRecurring, setIsRecurring] = useState(true);
  const [dayOfWeek, setDayOfWeek] = useState<string>('1');
  const [recurrenceStart, setRecurrenceStart] = useState('');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [slotDate, setSlotDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [venueId, setVenueId] = useState<string>('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch availability slots
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['availability-slots', currentMember?.id, role],
    queryFn: async () => {
      if (!currentMember || !club) return [];

      let query = supabase
        .from('availability_slots')
        .select('*, venue:venues(name)')
        .eq('club_id', club.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      // Coaches see only their own; admins see all
      if (role === 'coach') {
        query = query.eq('coach_member_id', currentMember.id);
      }

      const { data } = await query;
      return (data || []) as (AvailabilitySlot & { venue: { name: string } | null })[];
    },
    enabled: !!currentMember && !!club && (role === 'coach' || role === 'admin'),
  });

  // Fetch venues for the form
  const { data: venues = [] } = useQuery({
    queryKey: ['venues', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const { data } = await supabase
        .from('venues')
        .select('*')
        .eq('club_id', club.id)
        .eq('is_active', true)
        .order('name');
      return (data || []) as Venue[];
    },
    enabled: !!club,
  });

  const resetForm = () => {
    setIsRecurring(true);
    setDayOfWeek('1');
    setRecurrenceStart('');
    setRecurrenceEnd('');
    setSlotDate('');
    setStartTime('09:00');
    setEndTime('10:00');
    setVenueId('');
    setIsBlocked(false);
  };

  const handleSubmit = async () => {
    if (!currentMember || !club) return;
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        club_id: club.id,
        coach_member_id: currentMember.id,
        is_recurring: isRecurring,
        start_time: startTime,
        end_time: endTime,
        venue_id: venueId || null,
        is_blocked: isBlocked,
      };

      if (isRecurring) {
        payload.day_of_week = parseInt(dayOfWeek);
        payload.recurrence_start = recurrenceStart || null;
        payload.recurrence_end = recurrenceEnd || null;
      } else {
        payload.slot_date = slotDate || null;
      }

      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to add availability');
      }

      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error adding availability:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    const { error } = await supabase
      .from('availability_slots')
      .delete()
      .eq('id', slotId);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
    }
  };

  if (clubLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <RoleGate allowedRoles={['coach', 'admin']} fallback={<div className="p-8 text-center text-muted-foreground">Access restricted to coaches and admins.</div>}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Availability</h1>
            <p className="text-muted-foreground">
              {role === 'admin'
                ? 'Manage coach availability slots'
                : 'Manage your available time slots'}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add Availability</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Availability Slot</DialogTitle>
                <DialogDescription>
                  Create a new availability slot for lessons.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Recurring toggle */}
                <div className="flex items-center gap-4">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isRecurring ? 'default' : 'outline'}
                      onClick={() => setIsRecurring(true)}
                    >
                      Recurring
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!isRecurring ? 'default' : 'outline'}
                      onClick={() => setIsRecurring(false)}
                    >
                      One-off
                    </Button>
                  </div>
                </div>

                <Separator />

                {isRecurring ? (
                  <>
                    {/* Day of week */}
                    <div className="space-y-2">
                      <Label>Day of Week</Label>
                      <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_NAMES.map((name, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Recurrence start/end */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Recurrence Start</Label>
                        <Input
                          type="date"
                          value={recurrenceStart}
                          onChange={(e) => setRecurrenceStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Recurrence End</Label>
                        <Input
                          type="date"
                          value={recurrenceEnd}
                          onChange={(e) => setRecurrenceEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                    />
                  </div>
                )}

                {/* Time range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* Venue select */}
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Select value={venueId} onValueChange={setVenueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Blocked checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_blocked"
                    checked={isBlocked}
                    onChange={(e) => setIsBlocked(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="is_blocked">
                    Block this time (vacation / unavailable)
                  </Label>
                </div>

                <Separator />

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? 'Adding...' : 'Add Slot'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Slots list */}
        <Card>
          <CardHeader>
            <CardTitle>Current Slots</CardTitle>
            <CardDescription>
              Your configured availability and blocked times.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slotsLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading availability...
              </div>
            ) : slots.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No availability slots configured yet. Click &quot;Add Availability&quot; to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {slots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {slot.is_recurring && slot.day_of_week != null
                            ? DAY_NAMES[slot.day_of_week]
                            : slot.slot_date
                              ? format(new Date(slot.slot_date + 'T00:00:00'), 'MMM d, yyyy')
                              : 'Unknown'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {slot.venue?.name && <span>{slot.venue.name}</span>}
                        {slot.is_recurring && slot.recurrence_start && (
                          <span>
                            from {format(new Date(slot.recurrence_start + 'T00:00:00'), 'MMM d, yyyy')}
                            {slot.recurrence_end && ` to ${format(new Date(slot.recurrence_end + 'T00:00:00'), 'MMM d, yyyy')}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {slot.is_recurring && <Badge variant="secondary">Recurring</Badge>}
                      {slot.is_blocked && <Badge variant="destructive">Blocked</Badge>}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(slot.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
