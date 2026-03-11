'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { UserRole } from '@/types';

type OnboardingStep = 'role' | 'club-choice' | 'club-create' | 'club-join';

const VALID_ROLES: UserRole[] = ['admin', 'coach', 'player'];

function getInitialStep(role: string | null): { step: OnboardingStep; role: UserRole | null } {
  if (role && VALID_ROLES.includes(role as UserRole)) {
    const validRole = role as UserRole;
    if (validRole === 'admin') return { step: 'club-choice', role: validRole };
    return { step: 'club-join', role: validRole };
  }
  return { step: 'role', role: null };
}

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');

  const initial = getInitialStep(roleParam);
  const [step, setStep] = useState<OnboardingStep>(initial.step);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(initial.role);
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

      router.push(`/auth/setup-club?clubId=${data.clubId}`);
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

  const roleLabel = selectedRole === 'admin' ? 'Admin' : selectedRole === 'coach' ? 'Coach' : selectedRole === 'player' ? 'Player' : '';

  const goBack = () => {
    if (step === 'club-create' || step === 'club-join') {
      // If role came from URL, go back to club-choice (admin) or role step
      if (roleParam && selectedRole === 'admin') {
        setStep('club-choice');
      } else {
        setStep('role');
        setSelectedRole(null);
      }
    } else if (step === 'club-choice') {
      setStep('role');
      setSelectedRole(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border border-border bg-white shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Fencing Club Manager</CardTitle>
          <CardDescription>
            {step === 'role' && 'How will you be using the platform?'}
            {step === 'club-choice' && 'What would you like to do?'}
            {step === 'club-create' && 'Create your club'}
            {step === 'club-join' && `Join an existing club as ${roleLabel}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: Role selection (shown only if no role param) */}
          {step === 'role' && (
            <div className="space-y-3">
              {([
                { role: 'admin' as const, label: 'Club Admin', desc: 'I manage a fencing club and want to set it up on the platform.' },
                { role: 'coach' as const, label: 'Coach', desc: 'I teach fencing and want to join an existing club.' },
                { role: 'player' as const, label: 'Player', desc: 'I fence and want to book lessons at my club.' },
              ]).map(({ role, label, desc }) => (
                <button
                  key={role}
                  onClick={() => {
                    setSelectedRole(role);
                    setStep(role === 'admin' ? 'club-choice' : 'club-join');
                  }}
                  className="w-full rounded-lg border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
                >
                  <div className="font-medium">{label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 (admin only): Create or Join choice */}
          {step === 'club-choice' && (
            <div className="space-y-3">
              <button
                onClick={() => setStep('club-create')}
                className="w-full rounded-lg border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <div className="font-medium">Create a New Club</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Start fresh and set up your own fencing club.
                </div>
              </button>
              <button
                onClick={() => setStep('club-join')}
                className="w-full rounded-lg border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <div className="font-medium">Join an Existing Club</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Join a club that&apos;s already on the platform as an admin.
                </div>
              </button>
              <Button
                variant="ghost"
                onClick={goBack}
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}

          {/* Create club form */}
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
                onClick={goBack}
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}

          {/* Join club form */}
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
                {loading ? 'Joining...' : `Join as ${roleLabel}`}
              </Button>
              <Button
                variant="ghost"
                onClick={goBack}
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

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}
