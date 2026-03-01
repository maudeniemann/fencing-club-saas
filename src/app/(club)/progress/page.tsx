'use client';

import { useClub } from '@/providers/club-provider';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

export default function ProgressPage() {
  const { club, currentMember, role, isLoading: clubLoading } = useClub();
  const supabase = createClient();

  // For parents: fetch linked child IDs
  const { data: childIds = [] } = useQuery({
    queryKey: ['parent-children', currentMember?.id],
    queryFn: async () => {
      if (!currentMember) return [];
      const { data } = await supabase
        .from('parent_child_links')
        .select('child_member_id')
        .eq('parent_member_id', currentMember.id);
      return (data || []).map((link: Record<string, unknown>) => link.child_member_id as string);
    },
    enabled: !!currentMember && role === 'parent',
  });

  const { data: lessonLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['lesson-logs', currentMember?.id, role, childIds],
    queryFn: async () => {
      if (!currentMember) return [];

      let query = supabase
        .from('lesson_logs')
        .select(
          '*, bookings(starts_at), coach:club_members!lesson_logs_coach_member_id_fkey(display_name)'
        )
        .order('created_at', { ascending: false });

      if (role === 'player') {
        query = query.eq('player_member_id', currentMember.id);
      } else if (role === 'coach') {
        query = query.eq('coach_member_id', currentMember.id);
      } else if (role === 'parent') {
        if (childIds.length === 0) return [];
        query = query.in('player_member_id', childIds);
      }
      // admin: no filter, gets all

      const { data } = await query;
      return data || [];
    },
    enabled: !!currentMember && !!club && (role !== 'parent' || childIds.length > 0),
  });

  const weaponColor = (weapon: string | null) => {
    switch (weapon) {
      case 'epee':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'foil':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'sabre':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return '';
    }
  };

  const renderStars = (rating: number | null) => {
    if (rating == null) return null;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={i <= rating ? 'text-yellow-500' : 'text-muted-foreground/30'}
        >
          &#9733;
        </span>
      );
    }
    return <div className="flex gap-0.5 text-sm">{stars}</div>;
  };

  if (clubLoading || logsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading progress...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {role === 'coach' ? 'Teaching Logs' : 'Lesson Progress'}
        </h1>
        <p className="text-muted-foreground">
          {role === 'coach'
            ? 'Your lesson teaching history'
            : role === 'parent'
              ? "Your child's lesson progress"
              : 'Track your fencing development'}
        </p>
      </div>

      {lessonLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No lesson logs yet.
          </CardContent>
        </Card>
      ) : (
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          {lessonLogs.map((log: Record<string, unknown>) => {
            const booking = log.bookings as Record<string, unknown> | null;
            const coach = log.coach as Record<string, unknown> | null;
            const focusAreas = (log.focus_areas as string[] | null) || [];
            const notes = log.notes as string | null;
            const truncatedNotes =
              notes && notes.length > 200 ? notes.slice(0, 200) + '...' : notes;
            const logDate = booking?.starts_at
              ? parseISO(booking.starts_at as string)
              : parseISO(log.created_at as string);

            return (
              <div key={log.id as string} className="relative pl-12">
                {/* Timeline dot */}
                <div className="absolute left-[14px] top-4 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-base">
                        {format(logDate, 'EEEE, MMMM d, yyyy')}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {log.weapon ? (
                          <Badge
                            className={weaponColor(log.weapon as string)}
                            variant="outline"
                          >
                            {(log.weapon as string).charAt(0).toUpperCase() +
                              (log.weapon as string).slice(1)}
                          </Badge>
                        ) : null}
                        {renderStars(log.rating as number | null)}
                      </div>
                    </div>
                    {coach?.display_name ? (
                      <CardDescription>
                        Coach: {coach.display_name as string}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {focusAreas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {focusAreas.map((area: string) => (
                          <Badge key={area} variant="secondary" className="text-xs">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {truncatedNotes && (
                      <p className="text-sm text-muted-foreground">{truncatedNotes}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
