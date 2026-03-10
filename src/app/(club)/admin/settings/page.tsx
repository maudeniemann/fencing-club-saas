'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';

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

export default function SettingsPage() {
  const { club, isLoading, refetch } = useClub();

  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [timezone, setTimezone] = useState('');
  const [commissionSplit, setCommissionSplit] = useState('');

  // Populate form fields when club data loads
  useEffect(() => {
    if (club) {
      setName(club.name ?? '');
      setAddressLine1(club.address_line1 ?? '');
      setAddressLine2(club.address_line2 ?? '');
      setCity(club.city ?? '');
      setState(club.state ?? '');
      setZip(club.zip ?? '');
      setCountry(club.country ?? '');
      setPhone(club.phone ?? '');
      setEmail(club.email ?? '');
      setWebsite(club.website ?? '');
      setTimezone(club.timezone ?? '');
      setCommissionSplit(String(club.default_commission_split ?? ''));
    }
  }, [club]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!club) throw new Error('No club loaded');
      const res = await fetch(`/api/clubs/${club.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address_line1: addressLine1 || null,
          address_line2: addressLine2 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          country: country || 'US',
          phone: phone || null,
          email: email || null,
          website: website || null,
          timezone,
          default_commission_split: parseFloat(commissionSplit) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save settings');
      }
    },
    onSuccess: () => {
      refetch();
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No club found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Club Settings</h1>
        <p className="text-muted-foreground">
          Manage your club configuration and integrations.
        </p>
      </div>

      {/* Club Info */}
      <Card>
        <CardHeader>
          <CardTitle>Club Information</CardTitle>
          <CardDescription>
            Update your club details and contact information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="club-name">Club Name</Label>
                <Input
                  id="club-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-slug">Slug (read-only)</Label>
                <Input id="club-slug" value={club.slug} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-address1">Address Line 1</Label>
                <Input
                  id="club-address1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-address2">Address Line 2</Label>
                <Input
                  id="club-address2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-city">City</Label>
                <Input
                  id="club-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-state">State</Label>
                <Input
                  id="club-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-zip">ZIP Code</Label>
                <Input
                  id="club-zip"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-country">Country</Label>
                <Input
                  id="club-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-phone">Phone</Label>
                <Input
                  id="club-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-email">Email</Label>
                <Input
                  id="club-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-website">Website</Label>
                <Input
                  id="club-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-timezone">Timezone</Label>
                <Input
                  id="club-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. America/New_York"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2 max-w-sm">
              <Label htmlFor="club-commission">Default Commission Split</Label>
              <Input
                id="club-commission"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={commissionSplit}
                onChange={(e) => setCommissionSplit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Decimal between 0 and 1 (e.g. 0.7 means coach gets 70%).
              </p>
            </div>

            <Button
              type="submit"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>

            {saveMutation.isSuccess && (
              <p className="text-sm text-green-600">Settings saved successfully.</p>
            )}
            {saveMutation.isError && (
              <p className="text-sm text-red-600">
                Failed to save settings. Please try again.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Stripe Connect Status */}
      <Card>
        <CardHeader>
          <CardTitle>Stripe Connect</CardTitle>
          <CardDescription>
            Connect your Stripe account to accept payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {club.stripe_account_id && club.stripe_onboarding_complete ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
                  &#10003;
                </div>
                <span className="text-sm">Stripe Connected</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Connected
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {club.stripe_charges_enabled ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
                    &#10003;
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs">
                    &#10007;
                  </div>
                )}
                <span className="text-sm">Charges Enabled</span>
              </div>
              <div className="flex items-center gap-2">
                {club.stripe_payouts_enabled ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
                    &#10003;
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs">
                    &#10007;
                  </div>
                )}
                <span className="text-sm">Payouts Enabled</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Not Connected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your Stripe account to start accepting payments from members.
              </p>
              <Button asChild>
                <a href="/api/stripe/onboarding">Connect Stripe</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancellation Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Default Cancellation Policy</CardTitle>
          <CardDescription>
            Current cancellation policy configuration (read-only).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {club.default_cancellation_policy ? (
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
              {JSON.stringify(club.default_cancellation_policy, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No cancellation policy configured.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Subscription Info */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>
            Your current plan and subscription status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-sm font-medium">Plan</Label>
              <p className="text-lg font-semibold capitalize">
                {club.subscription_plan}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={
                    club.subscription_status === 'active'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : club.subscription_status === 'trialing'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  }
                >
                  {club.subscription_status}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
