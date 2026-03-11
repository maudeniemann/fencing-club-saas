'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MemberEntry {
  name: string;
  email: string;
  phone: string;
}

interface CsvImportProps {
  role: 'coach' | 'player';
  clubId: string;
  onComplete: (results: { success: number; failed: number; errors: Array<{ email: string; error: string }> }) => void;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseLines(text: string): MemberEntry[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const entries: MemberEntry[] = [];

  for (const line of lines) {
    // Skip header rows
    if (/^name/i.test(line) && /email/i.test(line)) continue;

    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 2 && parts[0] && isValidEmail(parts[1])) {
      entries.push({
        name: parts[0],
        email: parts[1],
        phone: parts[2] || '',
      });
    }
  }

  return entries;
}

export function CsvImport({ role, clubId, onComplete }: CsvImportProps) {
  const [entries, setEntries] = useState<MemberEntry[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: Array<{ email: string; error: string }> } | null>(null);

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  // Paste state
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const roleLabel = role === 'coach' ? 'Coaches' : 'Players';

  const addManualEntry = () => {
    if (!manualName.trim() || !manualEmail.trim()) return;
    if (!isValidEmail(manualEmail.trim())) return;

    // Check for duplicate email
    if (entries.some(e => e.email === manualEmail.trim())) return;

    setEntries(prev => [...prev, {
      name: manualName.trim(),
      email: manualEmail.trim(),
      phone: manualPhone.trim(),
    }]);
    setManualName('');
    setManualEmail('');
    setManualPhone('');
  };

  const handleParse = () => {
    setParseError(null);
    const parsed = parseLines(pasteText);
    if (parsed.length === 0) {
      setParseError('No valid entries found. Use format: name, email, phone (one per line)');
      return;
    }
    // Merge with existing, skip duplicates
    const existingEmails = new Set(entries.map(e => e.email));
    const newEntries = parsed.filter(e => !existingEmails.has(e.email));
    setEntries(prev => [...prev, ...newEntries]);
    setPasteText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseLines(text);
      if (parsed.length === 0) {
        setParseError('No valid entries found in CSV file.');
        return;
      }
      const existingEmails = new Set(entries.map(e => e.email));
      const newEntries = parsed.filter(e => !existingEmails.has(e.email));
      setEntries(prev => [...prev, ...newEntries]);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
    setExcluded(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const toggleExclude = (index: number) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleImport = async () => {
    const toImport = entries.filter((_, i) => !excluded.has(i));
    if (toImport.length === 0) return;

    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/members/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members: toImport.map(e => ({
            name: e.name,
            email: e.email,
            phone: e.phone || undefined,
          })),
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setImportResult(data);
      onComplete(data);
    } catch (err) {
      setImportResult({
        success: 0,
        failed: toImport.length,
        errors: [{ email: '', error: err instanceof Error ? err.message : 'Import failed' }],
      });
    } finally {
      setImporting(false);
    }
  };

  const includedCount = entries.length - excluded.size;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="manual">
        <TabsList className="w-full">
          <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
          <TabsTrigger value="paste" className="flex-1">Paste</TabsTrigger>
          <TabsTrigger value="csv" className="flex-1">CSV Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <Label htmlFor="manual-name">Name</Label>
                <Input
                  id="manual-name"
                  placeholder="John Smith"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="manual-email">Email</Label>
                <Input
                  id="manual-email"
                  type="email"
                  placeholder="john@example.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="manual-phone">Phone (optional)</Label>
                <Input
                  id="manual-phone"
                  placeholder="555-1234"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addManualEntry}
              disabled={!manualName.trim() || !manualEmail.trim() || !isValidEmail(manualEmail.trim())}
              className="w-full"
            >
              Add {role === 'coach' ? 'Coach' : 'Player'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="paste" className="mt-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="paste-area">Paste entries (one per line: name, email, phone)</Label>
              <textarea
                id="paste-area"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`John Smith, john@example.com, 555-1234\nJane Doe, jane@example.com`}
                className="mt-1 flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={5}
              />
            </div>
            {parseError && (
              <p className="text-sm text-destructive">{parseError}</p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleParse}
              disabled={!pasteText.trim()}
              className="w-full"
            >
              Parse Entries
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="csv" className="mt-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="csv-upload">Upload CSV file</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Format: name, email, phone (phone is optional). Header row is auto-detected.
              </p>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="mt-1"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview table */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {roleLabel} to import ({includedCount} of {entries.length})
            </h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setEntries([]); setExcluded(new Set()); }}
            >
              Clear All
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      checked={excluded.size === 0}
                      onChange={() => {
                        if (excluded.size === 0) {
                          setExcluded(new Set(entries.map((_, i) => i)));
                        } else {
                          setExcluded(new Set());
                        }
                      }}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, i) => (
                  <TableRow key={i} className={excluded.has(i) ? 'opacity-40' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!excluded.has(i)}
                        onChange={() => toggleExclude(i)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>{entry.name}</TableCell>
                    <TableCell>{entry.email}</TableCell>
                    <TableCell>{entry.phone || '—'}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => removeEntry(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={includedCount === 0 || importing}
              className="w-full"
            >
              {importing ? 'Importing...' : `Import ${includedCount} ${roleLabel}`}
            </Button>
          )}
        </div>
      )}

      {/* Import results */}
      {importResult && (
        <div className="rounded-md border p-4 space-y-2">
          <div className="flex items-center gap-2">
            {importResult.success > 0 && (
              <span className="text-sm text-green-600 font-medium">
                {importResult.success} imported successfully
              </span>
            )}
            {importResult.failed > 0 && (
              <span className="text-sm text-destructive font-medium">
                {importResult.failed} failed
              </span>
            )}
          </div>
          {importResult.errors.length > 0 && (
            <div className="space-y-1">
              {importResult.errors.map((err, i) => (
                <p key={i} className="text-xs text-destructive">
                  {err.email ? `${err.email}: ` : ''}{err.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
