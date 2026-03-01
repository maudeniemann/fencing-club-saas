'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { isPast } from 'date-fns';
import type { CalendarEvent } from './calendar-types';
import { formatTimeRange, formatStatusLabel, getStatusColor, format } from './calendar-utils';

interface EventPopoverProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string | null;
}

export function EventPopover({
  event,
  open,
  onOpenChange,
  role,
}: EventPopoverProps) {
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!event) return null;

  const isConfirmed = event.status === 'confirmed';
  const isPastEvent = isPast(event.end);
  const canCancel = isConfirmed && (role === 'admin' || role === 'coach');
  const canNoShow = isConfirmed && isPastEvent && (role === 'admin' || role === 'coach');

  async function handleAction(action: 'cancel' | 'no-show') {
    if (!event) return;
    setActionLoading(action);
    try {
      const res = await fetch(`/api/bookings/${event.bookingId}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['calendar-bookings'] });
        onOpenChange(false);
      }
    } finally {
      setActionLoading(null);
    }
  }

  const statusClasses = getStatusColor(event.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0">
        {/* Color stripe */}
        {event.color && (
          <div
            className="h-1.5 rounded-t-lg"
            style={{ backgroundColor: event.color }}
            aria-hidden
          />
        )}

        <div className="p-5 space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="text-base">
                {event.lessonTypeName}
              </DialogTitle>
              <Badge
                variant="outline"
                className={cn('text-[10px] shrink-0', statusClasses)}
              >
                {formatStatusLabel(event.status)}
              </Badge>
            </div>
            <DialogDescription>
              {format(event.start, 'EEEE, MMMM d, yyyy')}
              {' \u00B7 '}
              {formatTimeRange(event.start, event.end)}
            </DialogDescription>
          </DialogHeader>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <DetailRow label="Coach" value={event.coachName} />
            {event.venueName && (
              <DetailRow label="Venue" value={event.venueName} />
            )}
            <DetailRow
              label="Duration"
              value={`${event.durationMinutes} min`}
            />
            {event.priceCents > 0 && (
              <DetailRow
                label="Price"
                value={`$${(event.priceCents / 100).toFixed(2)}`}
              />
            )}
          </div>

          {/* Participants */}
          {event.participants.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Participants ({event.participants.length})
              </p>
              <div className="space-y-1">
                {event.participants.map((p, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <p className="text-sm text-muted-foreground italic border-t pt-3">
              {event.notes}
            </p>
          )}

          {/* Actions */}
          {(canCancel || canNoShow) && (
            <div className="flex gap-2 border-t pt-3">
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => handleAction('cancel')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Booking'}
                </Button>
              )}
              {canNoShow && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAction('no-show')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'no-show' ? 'Marking...' : 'Mark No Show'}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
