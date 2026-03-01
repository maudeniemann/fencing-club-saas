'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserRole } from '@/types';

type OnboardingStep = 'role' | 'club-create' | 'club-join';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [clubName, setClubName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateClub = async () => {
    if (!clubName.trim() || !selectedRole) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-club', clubName: clubName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create club');

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClub = async () => {
    if (!joinCode.trim() || !selectedRole) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join-club', joinCode: joinCode.trim(), role: selectedRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join club');

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join club');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border border-border bg-white shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Fencing Club Manager</CardTitle>
          <CardDescription>
            {step === 'role' && 'How will you be using the platform?'}
            {step === 'club-create' && 'Create your club'}
            {step === 'club-join' && 'Join an existing club'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === 'role' && (
            <div className="space-y-3">
              {([
                { role: 'admin' as const, label: 'Club Admin', desc: 'I manage a fencing club and want to set it up on the platform.' },
                { role: 'coach' as const, label: 'Coach', desc: 'I teach fencing and want to join an existing club.' },
                { role: 'player' as const, label: 'Player', desc: 'I fence and want to book lessons at my club.' },
                { role: 'parent' as const, label: 'Parent', desc: 'I manage lessons and payments for my child(ren).' },
              ]).map(({ role, label, desc }) => (
                <button
                  key={role}
                  onClick={() => {
                    setSelectedRole(role);
                    setStep(role === 'admin' ? 'club-create' : 'club-join');
                  }}
                  className="w-full rounded-lg border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="font-medium">{label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === 'club-create' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="club-name">Club Name</Label>
                <Input
                  id="club-name"
                  placeholder="e.g., Manhattan Fencing Club"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleCreateClub}
                disabled={!clubName.trim() || loading}
                className="w-full"
              >
                {loading ? 'Creating...' : 'Create Club'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep('role')}
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}

          {step === 'club-join' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="join-code">Club Code</Label>
                <Input
                  id="join-code"
                  placeholder="Enter your club's invite code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask your club admin for the invite code (club slug).
                </p>
              </div>
              <Button
                onClick={handleJoinClub}
                disabled={!joinCode.trim() || loading}
                className="w-full"
              >
                {loading ? 'Joining...' : `Join as ${selectedRole}`}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep('role')}
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
