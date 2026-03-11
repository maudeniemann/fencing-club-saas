'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { WEAPONS, FOCUS_AREAS, DRILL_TYPES } from '@/lib/constants';

interface LessonLogFormProps {
  bookingId: string;
  playerMemberId: string;
  onSuccess?: () => void;
}

export function LessonLogForm({
  bookingId,
  playerMemberId,
  onSuccess,
}: LessonLogFormProps) {
  const queryClient = useQueryClient();
  const [weapon, setWeapon] = useState<string>('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [drills, setDrills] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<string>('');
  const [isVisibleToPlayer, setIsVisibleToPlayer] = useState(true);

  const toggleFocusArea = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const toggleDrill = (drill: string) => {
    setDrills((prev) =>
      prev.includes(drill) ? prev.filter((d) => d !== drill) : [...prev, drill]
    );
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lesson-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          player_member_id: playerMemberId,
          weapon: weapon || undefined,
          focus_areas: focusAreas.length > 0 ? focusAreas : undefined,
          drills_performed: drills.length > 0 ? drills : undefined,
          notes: notes || undefined,
          rating: rating ? parseInt(rating, 10) : undefined,
          is_visible_to_player: isVisibleToPlayer,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save lesson log');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Lesson log saved — booking marked as completed');
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    },
  });

  return (
    <div className="space-y-4">
      {/* Weapon */}
      <div className="space-y-2">
        <Label>Weapon</Label>
        <Select value={weapon} onValueChange={setWeapon}>
          <SelectTrigger>
            <SelectValue placeholder="Select weapon" />
          </SelectTrigger>
          <SelectContent>
            {WEAPONS.map((w) => (
              <SelectItem key={w} value={w}>
                {w.charAt(0).toUpperCase() + w.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Focus Areas */}
      <div className="space-y-2">
        <Label>Focus Areas</Label>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREAS.map((area) => (
            <Badge
              key={area}
              variant={focusAreas.includes(area) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleFocusArea(area)}
            >
              {area}
            </Badge>
          ))}
        </div>
      </div>

      {/* Drills */}
      <div className="space-y-2">
        <Label>Drills Performed</Label>
        <div className="flex flex-wrap gap-2">
          {DRILL_TYPES.map((drill) => (
            <Badge
              key={drill}
              variant={drills.includes(drill) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleDrill(drill)}
            >
              {drill.replace(/-/g, ' ')}
            </Badge>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <Label>Rating (1-5)</Label>
        <Select value={rating} onValueChange={setRating}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Rate" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} — {['Poor', 'Fair', 'Good', 'Great', 'Excellent'][n - 1]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          placeholder="Add lesson notes, observations, homework..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </div>

      {/* Visibility */}
      <div className="flex items-center gap-3">
        <Switch
          checked={isVisibleToPlayer}
          onCheckedChange={setIsVisibleToPlayer}
        />
        <Label className="text-sm">Visible to player</Label>
      </div>

      <Button
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending}
        className="w-full"
      >
        {submitMutation.isPending ? 'Saving...' : 'Save Lesson Log'}
      </Button>
    </div>
  );
}
