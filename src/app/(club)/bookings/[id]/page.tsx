'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
import { format, isPast } from 'date-fns';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { LessonLogForm } from '@/components/booking/lesson-log-form';

const statusColors: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  disputed: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  succeeded: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: bookingId } = use(params);
  const { currentMember, role } = useClub();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) throw new Error('Booking not found');
      return res.json();
    },
  });

  const { data: lessonLogs = [] } = useQuery({
    queryKey: ['lesson-logs', bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/lesson-logs?booking_id=${bookingId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!booking,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to cancel');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking cancelled');
      setCancelOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    },
  });

  const noShowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/no-show`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to mark as no-show');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Marked as no-show');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading booking...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Booking not found.</div>
      </div>
    );
  }

  const lessonType = booking.lesson_types;
  const coach = booking.coach;
  const venue = booking.venue;
  const participants = booking.booking_participants || [];
  const payments = booking.payments || [];
  const status = booking.status as string;
  const isConfirmed = status === 'confirmed';
  const lessonPast = isPast(new Date(booking.ends_at || booking.starts_at));
  const isCoachOrAdmin = role === 'coach' || role === 'admin';
  const isPlayer = role === 'player';

  const coachInitials = (coach?.display_name || '?')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
          &larr; Back
        </Button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">
            {lessonType?.name || 'Lesson'}
          </h1>
          <Badge variant="outline" className={statusColors[status] || ''}>
            {status.replace('_', ' ')}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Booking #{booking.booking_number || bookingId.slice(0, 8)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lesson Info */}
        <Card>
          <CardHeader>
            <CardTitle>Lesson Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Date</div>
                <div className="font-medium">
                  {format(new Date(booking.starts_at), 'EEEE, MMMM d, yyyy')}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Time</div>
                <div className="font-medium">
                  {format(new Date(booking.starts_at), 'h:mm a')}
                  {booking.ends_at &&
                    ` – ${format(new Date(booking.ends_at), 'h:mm a')}`}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div className="font-medium">
                  {booking.duration_minutes || lessonType?.duration_minutes} min
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Category</div>
                <div className="font-medium capitalize">
                  {lessonType?.category || '—'}
                </div>
              </div>
              {venue && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Venue</div>
                  <div className="font-medium">{venue.name}</div>
                  {venue.address && (
                    <div className="text-xs text-muted-foreground">{venue.address}</div>
                  )}
                </div>
              )}
            </div>
            {booking.notes && (
              <>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Notes</div>
                  <p className="text-sm">{booking.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Coach Info */}
        <Card>
          <CardHeader>
            <CardTitle>Coach</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={coach?.avatar_url || undefined} />
                <AvatarFallback className="text-lg">{coachInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-lg">
                  {coach?.display_name || 'Coach'}
                </div>
                {coach?.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{coach.bio}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              {coach?.id && (
                <Link href={`/coaches/${coach.id}`}>
                  <Button variant="outline" size="sm">
                    View Profile
                  </Button>
                </Link>
              )}
              <Link href="/messages">
                <Button variant="outline" size="sm">
                  Message Coach
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
            <CardDescription>
              {participants.length} player{participants.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participants recorded.</p>
            ) : (
              <div className="space-y-3">
                {participants.map((p: Record<string, unknown>) => {
                  const player = p.player as Record<string, unknown> | null;
                  const pInitials = ((player?.display_name as string) || '?')
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                  return (
                    <div key={p.id as string} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={(player?.avatar_url as string) || undefined} />
                        <AvatarFallback className="text-xs">{pInitials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {(player?.display_name as string) || 'Player'}
                        </div>
                      </div>
                      {p.price_charged_cents != null && (
                        <span className="text-sm text-muted-foreground">
                          ${((p.price_charged_cents as number) / 100).toFixed(2)}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={statusColors[(p.status as string)] || ''}
                      >
                        {(p.status as string).replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Info */}
        {payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {payments.map((payment: Record<string, unknown>) => (
                  <div
                    key={payment.id as string}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {((payment.payment_type as string) || 'lesson').replace('_', ' ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.currency
                          ? (payment.currency as string).toUpperCase()
                          : 'USD'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          paymentStatusColors[(payment.status as string)] || ''
                        }
                      >
                        {payment.status as string}
                      </Badge>
                      <span className="font-semibold">
                        ${((payment.amount_cents as number) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actions */}
      <Separator />
      <div className="flex flex-wrap gap-3">
        {/* Player: Cancel booking */}
        {isPlayer && isConfirmed && (
          <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Cancel Booking</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cancellation fees may apply based on your club&apos;s policy.
                  Cancellations within 24 hours of the lesson may incur a 50% fee.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Coach/Admin: Mark no-show */}
        {isCoachOrAdmin && isConfirmed && lessonPast && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Mark as No-Show</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as no-show?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will record the player as a no-show and may trigger a
                  no-show fee.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => noShowMutation.mutate()}
                  disabled={noShowMutation.isPending}
                >
                  {noShowMutation.isPending ? 'Processing...' : 'Confirm No-Show'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Coach: Log lesson */}
        {role === 'coach' && lessonLogs.length === 0 && (status === 'completed' || (isConfirmed && lessonPast)) && (
          <Button variant="outline" onClick={() => setShowLogForm(true)}>
            Log Lesson
          </Button>
        )}
      </div>

      {/* Lesson Log: inline form for coaches */}
      {showLogForm && role === 'coach' && lessonLogs.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Log Lesson</CardTitle>
            <CardDescription>
              Record lesson details, drills, and notes. This will also mark the booking as completed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LessonLogForm
              bookingId={bookingId}
              playerMemberId={
                participants[0]?.player_member_id ||
                (participants[0]?.player as Record<string, unknown>)?.id as string ||
                ''
              }
              onSuccess={() => setShowLogForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Lesson Log: display existing logs */}
      {lessonLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lesson Log</CardTitle>
          </CardHeader>
          <CardContent>
            {lessonLogs
              .filter((log: Record<string, unknown>) =>
                role === 'coach' || role === 'admin' || log.is_visible_to_player
              )
              .map((log: Record<string, unknown>) => (
                <div key={log.id as string} className="space-y-3">
                  {log.weapon ? (
                    <div>
                      <div className="text-sm text-muted-foreground">Weapon</div>
                      <div className="text-sm font-medium capitalize">{log.weapon as string}</div>
                    </div>
                  ) : null}
                  {(log.focus_areas as string[] | null)?.length ? (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Focus Areas</div>
                      <div className="flex flex-wrap gap-1">
                        {(log.focus_areas as string[]).map((a) => (
                          <Badge key={a} variant="secondary">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {(log.drills_performed as string[] | null)?.length ? (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Drills</div>
                      <div className="flex flex-wrap gap-1">
                        {(log.drills_performed as string[]).map((d) => (
                          <Badge key={d} variant="outline">{d.replace(/-/g, ' ')}</Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {log.rating ? (
                    <div>
                      <div className="text-sm text-muted-foreground">Rating</div>
                      <div className="text-sm font-medium">
                        {log.rating as number} / 5
                      </div>
                    </div>
                  ) : null}
                  {log.notes ? (
                    <div>
                      <div className="text-sm text-muted-foreground">Notes</div>
                      <p className="text-sm whitespace-pre-wrap">{log.notes as string}</p>
                    </div>
                  ) : null}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
