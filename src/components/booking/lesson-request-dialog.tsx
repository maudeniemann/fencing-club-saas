'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

interface LessonRequestDialogProps {
  coachId: string;
  lessonTypeId: string;
  playerId: string;
  trigger?: React.ReactNode;
}

export function LessonRequestDialog({
  coachId,
  lessonTypeId,
  playerId,
  trigger,
}: LessonRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState<'waitlist' | 'new-time'>('waitlist');
  const [desiredDate, setDesiredDate] = useState('');
  const [desiredStartTime, setDesiredStartTime] = useState('');
  const [desiredEndTime, setDesiredEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_member_id: coachId,
          lesson_type_id: lessonTypeId,
          player_member_id: playerId,
          desired_date: desiredDate,
          desired_start_time: desiredStartTime || undefined,
          desired_end_time: desiredEndTime || undefined,
          is_new_time_request: requestType === 'new-time',
          request_notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit request');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      toast.success('Request submitted successfully');
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to submit');
    },
  });

  const resetForm = () => {
    setRequestType('waitlist');
    setDesiredDate('');
    setDesiredStartTime('');
    setDesiredEndTime('');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desiredDate) {
      toast.error('Please select a date');
      return;
    }
    submitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Request Lesson</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request a Lesson</DialogTitle>
          <DialogDescription>
            Join the waitlist or request a new time slot
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Request Type */}
          <div className="space-y-3">
            <Label>Request Type</Label>
            <RadioGroup
              value={requestType}
              onValueChange={(value) => setRequestType(value as 'waitlist' | 'new-time')}
            >
              <div className="flex items-start space-x-2 rounded-md border p-3">
                <RadioGroupItem value="waitlist" id="waitlist" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="waitlist" className="font-medium cursor-pointer">
                    Join Waitlist
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Request an occupied time slot (hoping for cancellation)
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2 rounded-md border p-3">
                <RadioGroupItem value="new-time" id="new-time" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="new-time" className="font-medium cursor-pointer">
                    Request New Time
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Request a time slot not currently on the coach&apos;s calendar
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Desired Date */}
          <div className="space-y-2">
            <Label htmlFor="desired-date">Desired Date *</Label>
            <Input
              id="desired-date"
              type="date"
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              required
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={desiredStartTime}
                onChange={(e) => setDesiredStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={desiredEndTime}
                onChange={(e) => setDesiredEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes{' '}
              <span className="text-sm text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                requestType === 'new-time'
                  ? 'Explain why you need this specific time...'
                  : 'Add any relevant information...'
              }
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
