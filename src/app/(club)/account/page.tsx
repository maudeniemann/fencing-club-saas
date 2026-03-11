'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClub } from '@/providers/club-provider';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { PaymentMethodForm } from '@/components/payments/payment-method-form';

export default function AccountPage() {
  const { currentMember, role, isLoading: clubLoading, refetch } = useClub();
  const supabase = createClient();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const toggleAutoBillingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch('/api/members/auto-billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update auto-billing');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-context'] });
      refetch();
      toast.success('Auto-billing settings updated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update auto-billing');
    },
  });

  // Get user email from auth
  const { data: userEmail } = useQuery({
    queryKey: ['auth-user-email'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.email || '';
    },
  });

  // Initialize form fields when currentMember loads
  if (currentMember && !initialized) {
    setDisplayName(currentMember.display_name || '');
    setPhone(currentMember.phone || '');
    setBio(currentMember.bio || '');
    setSpecialties(currentMember.specialties?.join(', ') || '');
    setInitialized(true);
  }

  const handleSave = async () => {
    if (!currentMember) return;
    setSaving(true);

    try {
      const updates: Record<string, unknown> = {
        display_name: displayName,
        phone: phone || null,
      };

      if (role === 'coach') {
        updates.bio = bio || null;
        updates.specialties = specialties
          ? specialties.split(',').map((s) => s.trim()).filter(Boolean)
          : null;
      }

      await supabase
        .from('club_members')
        .update(updates)
        .eq('id', currentMember.id);

      await refetch();
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  if (clubLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!currentMember) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">No account found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile and preferences.
        </p>
      </div>

      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your personal information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role badge */}
          <div className="flex items-center gap-2">
            <Label>Role</Label>
            <Badge variant="secondary" className="capitalize">
              {role}
            </Badge>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={userEmail || ''} disabled />
          </div>

          <Separator />

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {/* Coach-specific fields */}
          {role === 'coach' && (
            <>
              <Separator />

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students about yourself..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialties">
                  Specialties{' '}
                  <span className="text-sm text-muted-foreground">(comma-separated)</span>
                </Label>
                <Input
                  id="specialties"
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                  placeholder="Epee, Foil, Footwork, Competition prep"
                />
              </div>

              {/* Commission rate (read-only) */}
              <div className="space-y-2">
                <Label>Commission Rate</Label>
                <Input
                  value={
                    currentMember.commission_rate != null
                      ? `${(currentMember.commission_rate * 100).toFixed(0)}%`
                      : 'Not set'
                  }
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Set by your club admin.
                </p>
              </div>
            </>
          )}

          <Separator />

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Payment Method (players only) */}
      {role === 'player' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>
              Manage your payment method for booking lessons
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodForm />
          </CardContent>
        </Card>
      )}

      {/* Auto-billing (players only) */}
      {role === 'player' && (
        <Card>
          <CardHeader>
            <CardTitle>Auto-billing</CardTitle>
            <CardDescription>
              Automatically charge your payment method monthly for completed lessons
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium">Enable Monthly Auto-billing</div>
                <div className="text-sm text-muted-foreground">
                  Your card will be charged at the beginning of each month for the previous month&apos;s completed lessons
                </div>
              </div>
              <Switch
                checked={currentMember.auto_billing_enabled || false}
                onCheckedChange={(checked) => toggleAutoBillingMutation.mutate(checked)}
                disabled={toggleAutoBillingMutation.isPending}
              />
            </div>
            {!currentMember.stripe_default_payment_method_id && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-200">
                Please set up a payment method before enabling auto-billing
              </div>
            )}
            {currentMember.auto_billing_enabled && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-900 dark:text-green-200">
                Auto-billing is active. Your card will be automatically charged for completed lessons at the end of each month.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sign out */}
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            Sign out of your account on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOut}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
