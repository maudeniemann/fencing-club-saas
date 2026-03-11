'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
import type { LessonType } from '@/types';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const categoryBadgeColors: Record<string, string> = {
  private: 'bg-violet-100 text-violet-800 border-violet-200',
  group: 'bg-sky-100 text-sky-800 border-sky-200',
  clinic: 'bg-amber-100 text-amber-800 border-amber-200',
};

export default function LessonTypesPage() {
  const { club } = useClub();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('private');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [maxParticipants, setMaxParticipants] = useState('1');
  const [priceDollars, setPriceDollars] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [color, setColor] = useState('#D4707A');
  const [description, setDescription] = useState('');

  const {
    data: lessonTypes,
    isLoading,
  } = useQuery({
    queryKey: ['lesson-types', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const res = await fetch('/api/lesson-types');
      if (!res.ok) throw new Error('Failed to fetch lesson types');
      const data = await res.json();
      return data as LessonType[];
    },
    enabled: !!club,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const priceCents = Math.round(parseFloat(priceDollars) * 100);
      const res = await fetch('/api/lesson-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          duration_minutes: parseInt(durationMinutes, 10),
          max_participants: parseInt(maxParticipants, 10),
          price_cents: priceCents,
          currency,
          color,
          description: description || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to add lesson type');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-types', club?.id] });
      setName('');
      setCategory('private');
      setDurationMinutes('60');
      setMaxParticipants('1');
      setPriceDollars('');
      setCurrency('usd');
      setColor('#D4707A');
      setDescription('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !priceDollars) return;
    addMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading lesson types...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lesson Types</h1>
        <p className="text-muted-foreground">
          Configure the types of lessons your club offers.
        </p>
      </div>

      {/* Add Lesson Type Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Lesson Type</CardTitle>
          <CardDescription>
            Define a new lesson type with pricing and details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lt-name">Name</Label>
                <Input
                  id="lt-name"
                  placeholder="e.g. Private Epee Lesson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="lt-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                    <SelectItem value="clinic">Clinic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-duration">Duration (minutes)</Label>
                <Input
                  id="lt-duration"
                  type="number"
                  min="15"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-max">Max Participants</Label>
                <Input
                  id="lt-max"
                  type="number"
                  min="1"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-price">Price ($)</Label>
                <Input
                  id="lt-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 75.00"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-currency">Currency</Label>
                <Input
                  id="lt-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="usd"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-color">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="lt-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground">{color}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lt-description">Description</Label>
              <Textarea
                id="lt-description"
                placeholder="Describe this lesson type..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={!name.trim() || !priceDollars || addMutation.isPending}
            >
              {addMutation.isPending ? 'Adding...' : 'Add Lesson Type'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Lesson Types List */}
      {!lessonTypes || lessonTypes.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              No lesson types yet. Add your first lesson type above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lessonTypes.map((lt) => (
            <Card key={lt.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {lt.color ? (
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: lt.color as string }}
                    />
                  ) : null}
                  <CardTitle className="text-lg">{lt.name}</CardTitle>
                </div>
                <CardDescription>{lt.description ?? 'No description'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={categoryBadgeColors[lt.category] ?? ''}
                  >
                    {lt.category}
                  </Badge>
                  <Badge variant="secondary">
                    {lt.duration_minutes} min
                  </Badge>
                  <Badge variant="secondary">
                    Max {lt.max_participants}
                  </Badge>
                </div>
                <p className="text-xl font-semibold">
                  ${(lt.price_cents / 100).toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {lt.currency.toUpperCase()}
                  </span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
