'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CsvImport } from '@/components/onboarding/csv-import';

const STEPS = [
  { key: 'club-info', label: 'Club Info' },
  { key: 'venues', label: 'Venues' },
  { key: 'lesson-types', label: 'Lesson Types' },
  { key: 'coaches', label: 'Coaches' },
  { key: 'players', label: 'Players' },
] as const;

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const DEFAULT_LESSON_TYPES = [
  { name: 'Private Lesson', category: 'private' as const, duration: 30, max: 1, price: 8000, color: '#3b82f6' },
  { name: 'Private Lesson (60 min)', category: 'private' as const, duration: 60, max: 1, price: 15000, color: '#6366f1' },
  { name: 'Group Lesson', category: 'group' as const, duration: 60, max: 8, price: 4000, color: '#22c55e' },
  { name: 'Clinic', category: 'clinic' as const, duration: 90, max: 20, price: 3000, color: '#f59e0b' },
];

interface VenueEntry {
  id?: string;
  name: string;
  address: string;
  strips: string[];
}

interface LessonTypeEntry {
  name: string;
  category: 'private' | 'group' | 'clinic';
  duration_minutes: number;
  max_participants: number;
  price_cents: number;
  color: string;
  description: string;
}

function SetupWizardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubId = searchParams.get('clubId');

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Club Info
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('US');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [commissionSplit, setCommissionSplit] = useState('70');

  // Step 2: Venues
  const [venues, setVenues] = useState<VenueEntry[]>([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');

  // Step 3: Lesson Types
  const [lessonTypes, setLessonTypes] = useState<LessonTypeEntry[]>([]);
  const [ltName, setLtName] = useState('');
  const [ltCategory, setLtCategory] = useState<'private' | 'group' | 'clinic'>('private');
  const [ltDuration, setLtDuration] = useState('30');
  const [ltMax, setLtMax] = useState('1');
  const [ltPrice, setLtPrice] = useState('');
  const [ltColor, setLtColor] = useState('#3b82f6');
  const [ltDescription, setLtDescription] = useState('');

  // Step 4 & 5: Import results
  const [coachesImported, setCoachesImported] = useState(false);
  const [playersImported, setPlayersImported] = useState(false);

  if (!clubId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg border border-border bg-white shadow-lg">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No club ID provided.</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-4">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const saveClubInfo = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address_line1: addressLine1 || null,
          address_line2: addressLine2 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          country: country || null,
          phone: phone || null,
          email: email || null,
          website: website || null,
          timezone,
          default_commission_split: parseFloat(commissionSplit) / 100,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setCurrentStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save club info');
    } finally {
      setSaving(false);
    }
  };

  const addVenue = async () => {
    if (!newVenueName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVenueName.trim(), address: newVenueAddress.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create venue');
      }
      const venue = await res.json();
      setVenues(prev => [...prev, { id: venue.id, name: venue.name, address: venue.address || '', strips: [] }]);
      setNewVenueName('');
      setNewVenueAddress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add venue');
    } finally {
      setSaving(false);
    }
  };

  const addStripToVenue = async (venueIndex: number, stripName: string) => {
    const venue = venues[venueIndex];
    if (!venue.id || !stripName.trim()) return;
    try {
      const res = await fetch(`/api/venues/${venue.id}/strips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: stripName.trim() }),
      });
      if (!res.ok) return;
      setVenues(prev => prev.map((v, i) =>
        i === venueIndex ? { ...v, strips: [...v.strips, stripName.trim()] } : v
      ));
    } catch {
      // Silent fail for strips
    }
  };

  const addLessonType = async () => {
    if (!ltName.trim() || !ltPrice) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/lesson-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ltName.trim(),
          category: ltCategory,
          duration_minutes: parseInt(ltDuration),
          max_participants: parseInt(ltMax),
          price_cents: Math.round(parseFloat(ltPrice) * 100),
          color: ltColor,
          description: ltDescription || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create lesson type');
      }
      setLessonTypes(prev => [...prev, {
        name: ltName.trim(),
        category: ltCategory,
        duration_minutes: parseInt(ltDuration),
        max_participants: parseInt(ltMax),
        price_cents: Math.round(parseFloat(ltPrice) * 100),
        color: ltColor,
        description: ltDescription,
      }]);
      setLtName('');
      setLtPrice('');
      setLtDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add lesson type');
    } finally {
      setSaving(false);
    }
  };

  const addDefaultLessonTypes = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const lt of DEFAULT_LESSON_TYPES) {
        // Skip if already added
        if (lessonTypes.some(existing => existing.name === lt.name)) continue;
        const res = await fetch('/api/lesson-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lt.name,
            category: lt.category,
            duration_minutes: lt.duration,
            max_participants: lt.max,
            price_cents: lt.price,
            color: lt.color,
          }),
        });
        if (res.ok) {
          setLessonTypes(prev => [...prev, {
            name: lt.name,
            category: lt.category,
            duration_minutes: lt.duration,
            max_participants: lt.max,
            price_cents: lt.price,
            color: lt.color,
            description: '',
          }]);
        }
      }
    } catch {
      setError('Failed to add some default lesson types');
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    setError(null);
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const finish = () => {
    router.push('/dashboard');
  };

  const step = STEPS[currentStep];

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 pt-8">
      {/* Progress bar */}
      <div className="mb-8 w-full max-w-2xl">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    i < currentStep
                      ? 'bg-primary text-primary-foreground'
                      : i === currentStep
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i < currentStep ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="20,6 9,17 4,12" /></svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`mt-1 text-[10px] sm:text-xs ${i === currentStep ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 ${i < currentStep ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card className="w-full max-w-2xl border border-border bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">{step.label}</CardTitle>
          <CardDescription>
            {step.key === 'club-info' && 'Add your club details. Everything here is optional.'}
            {step.key === 'venues' && 'Add the locations where your club operates.'}
            {step.key === 'lesson-types' && 'Define the types of lessons your club offers.'}
            {step.key === 'coaches' && 'Import your coaches. They will receive login access via email.'}
            {step.key === 'players' && 'Import your players. They will receive login access via email.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: Club Info */}
          {step.key === 'club-info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="address1">Address Line 1</Label>
                  <Input id="address1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="mt-1" placeholder="123 Main St" />
                </div>
                <div>
                  <Label htmlFor="address2">Address Line 2</Label>
                  <Input id="address2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="mt-1" placeholder="Suite 100" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="mb-3 text-sm font-medium">Contact Information</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="mt-1" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="commission">Default Coach Commission (%)</Label>
                    <Input
                      id="commission"
                      type="number"
                      min={0}
                      max={100}
                      value={commissionSplit}
                      onChange={(e) => setCommissionSplit(e.target.value)}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Percentage of lesson revenue that goes to the coach.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={saveClubInfo} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save & Continue'}
                </Button>
                <Button variant="ghost" onClick={goNext}>
                  Skip
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Venues */}
          {step.key === 'venues' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="venue-name">Venue Name</Label>
                  <Input id="venue-name" value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} className="mt-1" placeholder="Main Salle" />
                </div>
                <div>
                  <Label htmlFor="venue-address">Address (optional)</Label>
                  <Input id="venue-address" value={newVenueAddress} onChange={(e) => setNewVenueAddress(e.target.value)} className="mt-1" />
                </div>
              </div>
              <Button variant="outline" onClick={addVenue} disabled={!newVenueName.trim() || saving} className="w-full">
                {saving ? 'Adding...' : 'Add Venue'}
              </Button>

              {venues.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-sm font-medium">Added Venues ({venues.length})</h4>
                  {venues.map((venue, vi) => (
                    <VenueCard key={vi} venue={venue} onAddStrip={(name) => addStripToVenue(vi, name)} />
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={goBack}>Back</Button>
                <Button onClick={goNext} className="flex-1">
                  {venues.length > 0 ? 'Continue' : 'Skip'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Lesson Types */}
          {step.key === 'lesson-types' && (
            <div className="space-y-4">
              <Button variant="outline" onClick={addDefaultLessonTypes} disabled={saving} className="w-full">
                {saving ? 'Adding...' : 'Add Common Defaults'}
              </Button>

              <div className="border-t pt-4">
                <h4 className="mb-3 text-sm font-medium">Or add custom lesson types:</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="lt-name">Name</Label>
                    <Input id="lt-name" value={ltName} onChange={(e) => setLtName(e.target.value)} className="mt-1" placeholder="Private Lesson" />
                  </div>
                  <div>
                    <Label htmlFor="lt-category">Category</Label>
                    <Select value={ltCategory} onValueChange={(v) => setLtCategory(v as 'private' | 'group' | 'clinic')}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                        <SelectItem value="clinic">Clinic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="lt-duration">Duration (min)</Label>
                    <Input id="lt-duration" type="number" value={ltDuration} onChange={(e) => setLtDuration(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="lt-max">Max Participants</Label>
                    <Input id="lt-max" type="number" value={ltMax} onChange={(e) => setLtMax(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="lt-price">Price ($)</Label>
                    <Input id="lt-price" type="number" step="0.01" value={ltPrice} onChange={(e) => setLtPrice(e.target.value)} className="mt-1" placeholder="80.00" />
                  </div>
                  <div>
                    <Label htmlFor="lt-color">Color</Label>
                    <div className="mt-1 flex gap-2">
                      <Input id="lt-color" type="color" value={ltColor} onChange={(e) => setLtColor(e.target.value)} className="h-9 w-14 p-1" />
                      <Input value={ltColor} onChange={(e) => setLtColor(e.target.value)} className="flex-1" />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <Label htmlFor="lt-desc">Description (optional)</Label>
                  <Input id="lt-desc" value={ltDescription} onChange={(e) => setLtDescription(e.target.value)} className="mt-1" />
                </div>
                <Button variant="outline" onClick={addLessonType} disabled={!ltName.trim() || !ltPrice || saving} className="mt-3 w-full">
                  {saving ? 'Adding...' : 'Add Lesson Type'}
                </Button>
              </div>

              {lessonTypes.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h4 className="text-sm font-medium">Added Lesson Types ({lessonTypes.length})</h4>
                  {lessonTypes.map((lt, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <div className="h-4 w-4 rounded" style={{ backgroundColor: lt.color }} />
                      <span className="font-medium">{lt.name}</span>
                      <span className="text-muted-foreground">{lt.category} &middot; {lt.duration_minutes}min &middot; ${(lt.price_cents / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={goBack}>Back</Button>
                <Button onClick={goNext} className="flex-1">
                  {lessonTypes.length > 0 ? 'Continue' : 'Skip'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Coaches */}
          {step.key === 'coaches' && (
            <div className="space-y-4">
              {coachesImported ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
                  Coaches imported successfully!
                </div>
              ) : (
                <CsvImport
                  role="coach"
                  clubId={clubId}
                  onComplete={() => setCoachesImported(true)}
                />
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={goBack}>Back</Button>
                <Button onClick={goNext} className="flex-1">
                  {coachesImported ? 'Continue' : 'Skip'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Players */}
          {step.key === 'players' && (
            <div className="space-y-4">
              {playersImported ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
                  Players imported successfully!
                </div>
              ) : (
                <CsvImport
                  role="player"
                  clubId={clubId}
                  onComplete={() => setPlayersImported(true)}
                />
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={goBack}>Back</Button>
                <Button onClick={finish} className="flex-1">
                  Finish Setup
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skip setup link */}
      <button
        onClick={finish}
        className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Skip setup, go to dashboard
      </button>
    </div>
  );
}

function VenueCard({ venue, onAddStrip }: { venue: VenueEntry; onAddStrip: (name: string) => void }) {
  const [stripName, setStripName] = useState('');
  const [showStrips, setShowStrips] = useState(false);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{venue.name}</span>
          {venue.address && <span className="ml-2 text-sm text-muted-foreground">{venue.address}</span>}
        </div>
        <button
          onClick={() => setShowStrips(!showStrips)}
          className="text-xs text-primary hover:underline"
        >
          {showStrips ? 'Hide strips' : `Strips (${venue.strips.length})`}
        </button>
      </div>
      {showStrips && (
        <div className="mt-2 space-y-2 border-t pt-2">
          {venue.strips.map((s, i) => (
            <div key={i} className="text-sm text-muted-foreground pl-2">{s}</div>
          ))}
          <div className="flex gap-2">
            <Input
              value={stripName}
              onChange={(e) => setStripName(e.target.value)}
              placeholder="Strip name (e.g., Strip 1)"
              className="flex-1 h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (stripName.trim()) {
                  onAddStrip(stripName.trim());
                  setStripName('');
                }
              }}
              disabled={!stripName.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SetupClubPage() {
  return (
    <Suspense>
      <SetupWizardForm />
    </Suspense>
  );
}
