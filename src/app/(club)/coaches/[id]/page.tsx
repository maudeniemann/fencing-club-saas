'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
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

const categoryBadgeColors: Record<string, string> = {
  private: 'bg-violet-100 text-violet-800 border-violet-200',
  group: 'bg-sky-100 text-sky-800 border-sky-200',
  clinic: 'bg-amber-100 text-amber-800 border-amber-200',
};

export default function CoachProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: coachId } = use(params);
  const { role } = useClub();

  const { data: coach, isLoading: coachLoading } = useQuery({
    queryKey: ['coach', coachId],
    queryFn: async () => {
      const res = await fetch(`/api/coaches/${coachId}`);
      if (!res.ok) throw new Error('Coach not found');
      return res.json();
    },
  });

  const { data: lessonTypes = [] } = useQuery({
    queryKey: ['lesson-types'],
    queryFn: async () => {
      const res = await fetch('/api/lesson-types');
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (coachLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading coach profile...</div>
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Coach not found.</div>
      </div>
    );
  }

  const initials = (coach.display_name || '?')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const specialties = (coach.specialties as string[] | null) || [];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={coach.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{coach.display_name || 'Coach'}</h1>
              {coach.phone && (
                <p className="text-muted-foreground">{coach.phone}</p>
              )}
              {specialties.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                  {specialties.map((s: string) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-4 justify-center sm:justify-start">
                <Link href={`/coaches/${coachId}/availability`}>
                  <Button>View Availability & Book</Button>
                </Link>
                <Link href="/messages">
                  <Button variant="outline">Message</Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      {coach.bio && (
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{coach.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Lesson Types */}
      {lessonTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lesson Types</CardTitle>
            <CardDescription>
              Available lesson types at this club
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lessonTypes.map((lt: Record<string, unknown>) => (
                <div
                  key={lt.id as string}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    {lt.color ? (
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: lt.color as string }}
                      />
                    ) : null}
                    <span className="font-medium">{lt.name as string}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={
                        categoryBadgeColors[lt.category as string] || ''
                      }
                    >
                      {lt.category as string}
                    </Badge>
                    <Badge variant="secondary">
                      {lt.duration_minutes as number} min
                    </Badge>
                  </div>
                  <p className="text-xl font-semibold">
                    ${((lt.price_cents as number) / 100).toFixed(2)}
                  </p>
                  {lt.description ? (
                    <p className="text-xs text-muted-foreground">
                      {lt.description as string}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
