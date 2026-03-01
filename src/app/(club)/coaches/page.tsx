'use client';

import { useClub } from '@/providers/club-provider';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CoachesPage() {
  const { club, isLoading: clubLoading } = useClub();
  const supabase = createClient();

  const { data: coaches = [], isLoading: coachesLoading } = useQuery({
    queryKey: ['coaches', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const { data } = await supabase
        .from('club_members')
        .select('*')
        .eq('club_id', club.id)
        .eq('role', 'coach')
        .eq('is_active', true)
        .order('display_name', { ascending: true });
      return data || [];
    },
    enabled: !!club,
  });

  const { data: lessonTypes = [] } = useQuery({
    queryKey: ['lesson-types', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const { data } = await supabase
        .from('lesson_types')
        .select('*')
        .eq('club_id', club.id)
        .eq('is_active', true)
        .order('name', { ascending: true });
      return data || [];
    },
    enabled: !!club,
  });

  if (clubLoading || coachesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading coaches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coaches</h1>
        <p className="text-muted-foreground">
          Meet our coaching staff
        </p>
      </div>

      {/* Available lesson types */}
      {lessonTypes.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Available lesson types
          </h2>
          <div className="flex flex-wrap gap-2">
            {lessonTypes.map((lt: Record<string, unknown>) => (
              <Badge key={lt.id as string} variant="secondary">
                {lt.name as string}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {coaches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No coaches found for this club.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((coach: Record<string, unknown>) => {
            const initials = (coach.display_name as string || '?')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            const specialties = (coach.specialties as string[] | null) || [];
            const bio = coach.bio as string | null;
            const truncatedBio =
              bio && bio.length > 120 ? bio.slice(0, 120) + '...' : bio;

            return (
              <Card key={coach.id as string} className="flex flex-col">
                <CardHeader className="flex-row items-center gap-4">
                  {coach.avatar_url ? (
                    <img
                      src={coach.avatar_url as string}
                      alt={coach.display_name as string}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {(coach.display_name as string) || 'Coach'}
                    </CardTitle>
                    {coach.phone ? (
                      <CardDescription className="truncate">
                        {coach.phone as string}
                      </CardDescription>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {truncatedBio && (
                    <p className="text-sm text-muted-foreground">{truncatedBio}</p>
                  )}
                  {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {specialties.map((specialty: string) => (
                        <Badge key={specialty} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {specialties.length === 0 && !truncatedBio && (
                    <p className="text-sm text-muted-foreground italic">
                      No additional details available.
                    </p>
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
