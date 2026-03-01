'use client';

import { useState } from 'react';
import { useClub } from '@/providers/club-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO, formatDistanceToNow, isPast } from 'date-fns';

export default function WaitlistPage() {
  const { club, currentMember, role, isLoading: clubLoading } = useClub();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['waitlist-entries', currentMember?.id],
    queryFn: async () => {
      if (!currentMember) return [];
      const { data } = await supabase
        .from('waitlist_entries')
        .select(
          '*, coach:club_members!waitlist_entries_coach_member_id_fkey(display_name), lesson_type:lesson_types(name)'
        )
        .eq('player_member_id', currentMember.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!currentMember && !!club,
  });

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAccept = async (entryId: string) => {
    setActionLoading(entryId);
    try {
      await fetch(`/api/waitlist/${entryId}/accept`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['waitlist-entries'] });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (entryId: string) => {
    setActionLoading(entryId);
    try {
      await fetch(`/api/waitlist/${entryId}/decline`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['waitlist-entries'] });
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'notified':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'accepted':
      case 'fulfilled':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'declined':
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return '';
    }
  };

  if (clubLoading || entriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading waitlist...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Waitlist</h1>
        <p className="text-muted-foreground">
          Track your waitlist entries and respond to openings
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You&apos;re not on any waitlists.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry: Record<string, unknown>) => {
            const coach = entry.coach as Record<string, unknown> | null;
            const lessonType = entry.lesson_type as Record<string, unknown> | null;
            const status = entry.status as string;
            const acceptDeadline = entry.accept_deadline as string | null;
            const isNotified = status === 'notified';
            const deadlinePassed = acceptDeadline ? isPast(parseISO(acceptDeadline)) : false;
            const isProcessing = actionLoading === (entry.id as string);

            return (
              <Card key={entry.id as string}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base">
                      {(lessonType?.name as string) || 'Lesson'}
                    </CardTitle>
                    <Badge className={statusBadgeClass(status)} variant="outline">
                      {status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {coach?.display_name
                      ? `Coach: ${coach.display_name as string}`
                      : 'Any available coach'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Desired Date</div>
                      <div className="font-medium">
                        {entry.desired_date
                          ? format(parseISO(entry.desired_date as string), 'MMM d, yyyy')
                          : 'Flexible'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Desired Time</div>
                      <div className="font-medium">
                        {entry.desired_start_time
                          ? `${entry.desired_start_time as string}${entry.desired_end_time ? ` - ${entry.desired_end_time as string}` : ''}`
                          : 'Flexible'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Priority Score</div>
                      <div className="font-medium">{entry.priority_score as number}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Requested</div>
                      <div className="font-medium">
                        {format(parseISO(entry.created_at as string), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>

                  {isNotified && acceptDeadline && !deadlinePassed && (
                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-3 space-y-3">
                      <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        A spot has opened up! Respond before{' '}
                        {format(parseISO(acceptDeadline), 'MMM d, h:mm a')} (
                        {formatDistanceToNow(parseISO(acceptDeadline), { addSuffix: true })})
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAccept(entry.id as string)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? 'Processing...' : 'Accept'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecline(entry.id as string)}
                          disabled={isProcessing}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  )}

                  {isNotified && acceptDeadline && deadlinePassed && (
                    <div className="text-sm text-muted-foreground italic">
                      The response deadline has passed.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
